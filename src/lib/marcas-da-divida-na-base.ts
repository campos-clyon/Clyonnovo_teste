import { getPool } from "./db";
import { eParteDaDivida, type MarcaDaParte, type OrigemDaMarca } from "./cobrancas-ao-profissional";

/**
 * A TABELA DAS PARTES DA DÍVIDA MARCADAS, E A LEITURA DELA — 11-11-2026. À
 * parte de `cobrancas-na-base.ts` para a carteira (`trabalhosDaCarteira`) a
 * poder ler sem um ciclo de importações. Ver `cobrancas-ao-profissional.ts`.
 */

let tabelaPronta = false;

export async function garantirTabelaDasCobrancas(): Promise<void> {
  if (tabelaPronta) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS cobrancasAoProfissional (
      id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      negociacaoId    INT UNSIGNED NOT NULL,
      providerId      INT UNSIGNED NOT NULL,
      pedidoId        INT NULL DEFAULT NULL,
      parte           VARCHAR(10) NOT NULL,
      valor           DECIMAL(10,2) NOT NULL,
      pagoEm          DATETIME NOT NULL,
      metodo          VARCHAR(20) NOT NULL,
      nota            VARCHAR(255) NULL DEFAULT NULL,
      marcadoPor      VARCHAR(120) NULL DEFAULT NULL,
      origem          VARCHAR(20) NOT NULL DEFAULT 'marcacao',
      pagamentoId     INT UNSIGNED NULL DEFAULT NULL,
      activa          TINYINT(1) NULL DEFAULT 1,
      desfeitoEm      DATETIME NULL DEFAULT NULL,
      desfeitoPor     VARCHAR(120) NULL DEFAULT NULL,
      motivoDesfeito  VARCHAR(255) NULL DEFAULT NULL,
      criadoEm        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_parte_activa (negociacaoId, parte, activa),
      KEY idx_profissional (providerId, activa),
      KEY idx_pagamento (pagamentoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelaPronta = true;
}

export function origemLida(v: unknown): OrigemDaMarca {
  return v === "bloco" ? "bloco" : v === "abatimento" ? "abatimento" : "marcacao";
}

/** As marcas activas destas negociações. Sem a tabela (ainda), nenhuma. */
export async function marcasDasNegociacoes(ids: number[]): Promise<Map<number, MarcaDaParte[]>> {
  const mapa = new Map<number, MarcaDaParte[]>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return mapa;
  const pool = await getPool();
  if (!pool) return mapa;
  try {
    const [linhas] = (await pool.query(
      `SELECT id, negociacaoId, parte, valor, pagoEm, metodo, nota, marcadoPor, origem, pagamentoId
         FROM cobrancasAoProfissional
        WHERE activa = 1 AND negociacaoId IN (?)`,
      [limpos],
    )) as [Array<Record<string, unknown>>, unknown];
    for (const l of linhas) {
      if (!eParteDaDivida(l.parte)) continue;
      const n = Number(l.negociacaoId);
      if (!mapa.has(n)) mapa.set(n, []);
      mapa.get(n)!.push({
        id: Number(l.id),
        negociacaoId: n,
        parte: l.parte,
        valor: Number(l.valor),
        pagoEm: (l.pagoEm as Date | string | null) ?? null,
        metodo: (l.metodo as string | null) ?? null,
        nota: (l.nota as string | null) ?? null,
        marcadoPor: (l.marcadoPor as string | null) ?? null,
        pagamentoId: l.pagamentoId != null ? Number(l.pagamentoId) : null,
        origem: origemLida(l.origem),
      });
    }
  } catch (e) {
    if ((e as { code?: string })?.code !== "ER_NO_SUCH_TABLE") throw e;
  }
  return mapa;
}


/** As partes pagas que só esta tabela conhece (sem linha em `pagamentos`) — para as Finanças. */
export async function partesPagasSemLinha(): Promise<Array<Record<string, unknown>>> {
  const pool = await getPool();
  if (!pool) return [];
  try {
    const [linhas] = (await pool.execute(
      `SELECT c.id, c.pedidoId, c.parte, c.valor, c.pagoEm, c.metodo,
              pr.name AS profissional, COALESCE(pr.contaDeTeste, 0) AS contaDeTeste
         FROM cobrancasAoProfissional c
         LEFT JOIN providers pr ON pr.id = c.providerId
        WHERE c.activa = 1 AND c.pagamentoId IS NULL`,
    )) as [Array<Record<string, unknown>>, unknown];
    return linhas;
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_NO_SUCH_TABLE") return [];
    throw e;
  }
}
