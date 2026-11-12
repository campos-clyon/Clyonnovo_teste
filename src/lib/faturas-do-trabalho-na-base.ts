import { getPool } from "./db";
import { deQuemValido, type DeQuemEAFatura, type FaturaDoTrabalho } from "./faturas-do-trabalho";

/**
 * AS FATURAS DO TRABALHO NA BASE — d10 (`faturas-do-trabalho.ts`).
 *
 * Tabela nova, só a acrescentar: `activa` 1 na fatura que vale e NULL nas que
 * foram substituídas (o índice único deixa uma só activa por trabalho e por
 * parte, e quantas inactivas houver). Nada se apaga.
 */

let pronta = false;

export async function ensureFaturasDoTrabalho(): Promise<void> {
  if (pronta) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS faturasDoTrabalho (
      id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      negociacaoId INT UNSIGNED NOT NULL,
      pedidoId     INT UNSIGNED NOT NULL,
      deQuem       VARCHAR(10)  NOT NULL,
      url          VARCHAR(600) NOT NULL,
      nome         VARCHAR(160) NULL DEFAULT NULL,
      carregadaEm  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      carregadaPor VARCHAR(120) NULL DEFAULT NULL,
      activa       TINYINT      NULL DEFAULT 1,
      KEY faturasDoTrabalho_negociacao (negociacaoId),
      UNIQUE KEY faturasDoTrabalho_uma_activa (negociacaoId, deQuem, activa)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  pronta = true;
}

/** Guarda a fatura de uma parte; a anterior da mesma parte fica inactiva. Devolve o URL da anterior, se havia. */
export async function guardarFaturaDoTrabalho(f: {
  negociacaoId: number;
  pedidoId: number;
  deQuem: DeQuemEAFatura;
  url: string;
  nome: string | null;
  carregadaPor: string;
}): Promise<{ anterior: string | null }> {
  await ensureFaturasDoTrabalho();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [antes] = (await conn.execute(
      "SELECT id, url FROM faturasDoTrabalho WHERE negociacaoId = ? AND deQuem = ? AND activa = 1 FOR UPDATE",
      [f.negociacaoId, f.deQuem],
    )) as unknown as [Array<{ id: number; url: string }>, unknown];
    const anterior = antes[0] ?? null;
    if (anterior) await conn.execute("UPDATE faturasDoTrabalho SET activa = NULL WHERE id = ?", [anterior.id]);
    await conn.execute(
      `INSERT INTO faturasDoTrabalho (negociacaoId, pedidoId, deQuem, url, nome, carregadaPor, activa)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [f.negociacaoId, f.pedidoId, f.deQuem, f.url, f.nome, f.carregadaPor.slice(0, 120)],
    );
    await conn.commit();
    return { anterior: anterior?.url ?? null };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** As faturas activas de uma negociação (no máximo duas). */
export async function faturasDaNegociacao(negociacaoId: number): Promise<FaturaDoTrabalho[]> {
  await ensureFaturasDoTrabalho();
  const pool = await getPool();
  if (!pool) return [];
  const [linhas] = (await pool.execute(
    `SELECT id, negociacaoId, pedidoId, deQuem, url, nome, carregadaEm
       FROM faturasDoTrabalho WHERE negociacaoId = ? AND activa = 1 ORDER BY id`,
    [negociacaoId],
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  return linhas
    .filter((l) => deQuemValido(l.deQuem))
    .map((l) => ({
      id: Number(l.id),
      negociacaoId: Number(l.negociacaoId),
      pedidoId: Number(l.pedidoId),
      deQuem: l.deQuem as DeQuemEAFatura,
      url: String(l.url),
      nome: l.nome == null ? null : String(l.nome),
      carregadaEm: l.carregadaEm instanceof Date ? l.carregadaEm.toISOString() : l.carregadaEm == null ? null : String(l.carregadaEm),
    }));
}
