import { getPool } from "./db";
import type { EntradaLida, OQueGravar, PreviaDaFolhaFinal } from "./folha-final";
import type { ContaDaFolhaFinal } from "./conta-da-mudanca";

/**
 * A FOLHA FINAL NA BASE — d38 v2, commit b (`folha-final.ts`).
 *
 * Tabela nova, só a acrescentar: cada gravação é uma linha; `activa` 1 na que
 * vale e NULL nas anteriores (o índice único deixa uma só activa por
 * negociação). Nada se apaga: é o histórico do valor final — o antes, o
 * depois, quem e porquê.
 *
 * A gravação é uma transacção: a negociação passa ao valor final (e, num
 * trabalho à hora, as horas ficam confirmadas pela CLYON, como no
 * «Corrigir»), o preço do Trabalho CLYON acompanha, e a linha entra aqui.
 * Se o valor da negociação mudou entre a pré-visualização e o gravar, não
 * grava nada (`mudou`).
 */

let pronta = false;

export async function ensureFolhasFinais(): Promise<void> {
  if (pronta) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS folhasFinais (
      id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
      negociacaoId       INT UNSIGNED  NOT NULL,
      pedidoId           INT UNSIGNED  NOT NULL,
      entradaJson        TEXT          NOT NULL,
      contaJson          TEXT          NOT NULL,
      previaJson         TEXT          NOT NULL,
      taxaBase           DECIMAL(6,4)  NOT NULL,
      valorAntes         DECIMAL(10,2) NULL DEFAULT NULL,
      taxaAntes          DECIMAL(10,8) NULL DEFAULT NULL,
      valorDepois        DECIMAL(10,2) NOT NULL,
      taxaDepois         DECIMAL(10,8) NOT NULL,
      profissionalAntes  DECIMAL(10,2) NULL DEFAULT NULL,
      profissionalDepois DECIMAL(10,2) NOT NULL,
      jaPago             TINYINT(1)    NOT NULL DEFAULT 0,
      porQuem            VARCHAR(120)  NULL DEFAULT NULL,
      motivo             VARCHAR(300)  NULL DEFAULT NULL,
      criadaEm           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      activa             TINYINT       NULL DEFAULT 1,
      KEY folhasFinais_pedido (pedidoId),
      UNIQUE KEY folhasFinais_uma_activa (negociacaoId, activa)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  pronta = true;
}

export type FolhaFinalGravada = {
  id: number;
  negociacaoId: number;
  pedidoId: number;
  entrada: EntradaLida | null;
  conta: ContaDaFolhaFinal | null;
  previa: PreviaDaFolhaFinal | null;
  taxaBase: number;
  valorAntes: number | null;
  valorDepois: number;
  taxaDepois: number;
  profissionalAntes: number | null;
  profissionalDepois: number;
  jaPago: boolean;
  porQuem: string | null;
  motivo: string | null;
  criadaEm: string | null;
  activa: boolean;
};

const json = <T>(t: unknown): T | null => {
  try {
    return typeof t === "string" ? (JSON.parse(t) as T) : null;
  } catch {
    return null;
  }
};
const n = (v: unknown): number | null => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function daLinha(r: Record<string, unknown>): FolhaFinalGravada {
  const em = r.criadaEm instanceof Date ? r.criadaEm.toISOString() : r.criadaEm == null ? null : String(r.criadaEm);
  return {
    id: Number(r.id),
    negociacaoId: Number(r.negociacaoId),
    pedidoId: Number(r.pedidoId),
    entrada: json<EntradaLida>(r.entradaJson),
    conta: json<ContaDaFolhaFinal>(r.contaJson),
    previa: json<PreviaDaFolhaFinal>(r.previaJson),
    taxaBase: Number(r.taxaBase),
    valorAntes: n(r.valorAntes),
    valorDepois: Number(r.valorDepois),
    taxaDepois: Number(r.taxaDepois),
    profissionalAntes: n(r.profissionalAntes),
    profissionalDepois: Number(r.profissionalDepois),
    jaPago: Number(r.jaPago) === 1,
    porQuem: (r.porQuem as string | null) ?? null,
    motivo: (r.motivo as string | null) ?? null,
    criadaEm: em,
    activa: Number(r.activa) === 1,
  };
}

/** As folhas finais de uma negociação, da mais recente para a mais antiga. */
export async function folhasFinaisDe(negociacaoId: number): Promise<FolhaFinalGravada[]> {
  await ensureFolhasFinais();
  const pool = await getPool();
  if (!pool) return [];
  const [linhas] = (await pool.execute("SELECT * FROM folhasFinais WHERE negociacaoId = ? ORDER BY id DESC LIMIT 50", [
    negociacaoId,
  ])) as unknown as [Array<Record<string, unknown>>, unknown];
  return linhas.map(daLinha);
}

/** A folha final que vale, por negociação (para os ecrãs que mostram o que o profissional recebe). */
export async function folhasFinaisActivas(negociacaoIds: number[]): Promise<Map<number, FolhaFinalGravada>> {
  const ids = [...new Set(negociacaoIds.filter((i) => Number.isInteger(i) && i > 0))];
  const mapa = new Map<number, FolhaFinalGravada>();
  if (ids.length === 0) return mapa;
  await ensureFolhasFinais();
  const pool = await getPool();
  if (!pool) return mapa;
  const [linhas] = (await pool.execute(
    `SELECT * FROM folhasFinais WHERE activa = 1 AND negociacaoId IN (${ids.map(() => "?").join(",")})`,
    ids,
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  for (const l of linhas) {
    const f = daLinha(l);
    mapa.set(f.negociacaoId, f);
  }
  return mapa;
}

export type GravarFolhaFinal = {
  negociacaoId: number;
  pedidoId: number;
  /** O valor e a taxa que a equipa viu — se mudaram entretanto, não grava. */
  antes: { valorAcordado: number | null; taxaProfissional: number | null; profissional: number | null };
  gravar: OQueGravar;
  entrada: EntradaLida;
  conta: ContaDaFolhaFinal;
  previa: PreviaDaFolhaFinal;
  /** Trabalho à hora: as horas ficam confirmadas pela CLYON com este valor. */
  porHora: boolean;
  /** Trabalho CLYON com taxa: o preço do pedido acompanha. */
  precoClyonAcompanha: boolean;
  jaPago: boolean;
  porQuem: string;
  motivo: string | null;
};

const iguais = (a: number | null, b: unknown) => (a == null ? b == null : b != null && Math.abs(a - Number(b)) < 0.000000005);

export async function gravarFolhaFinal(g: GravarFolhaFinal): Promise<{ ok: true; id: number } | { ok: false; porque: "mudou" | "fechado" }> {
  await ensureFolhasFinais();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [agora] = (await conn.execute(
      "SELECT estado, valorAcordado, taxaProfissional FROM negociacoes WHERE id = ? AND pedidoId = ? FOR UPDATE",
      [g.negociacaoId, g.pedidoId],
    )) as unknown as [Array<{ estado: string; valorAcordado: unknown; taxaProfissional: unknown }>, unknown];
    const l = agora[0];
    if (!l || l.estado !== "acordada") {
      await conn.rollback();
      return { ok: false, porque: "fechado" };
    }
    if (!iguais(g.antes.valorAcordado, l.valorAcordado) || !iguais(g.antes.taxaProfissional, l.taxaProfissional)) {
      await conn.rollback();
      return { ok: false, porque: "mudou" };
    }
    /*
     * Num trabalho à hora sem horas confirmadas, o valor acordado é o preço da
     * hora: guarda-se em `valorPorHora` ANTES de o valor passar a ser o total
     * (o MySQL avalia as atribuições da esquerda para a direita).
     */
    await conn.execute(
      g.porHora
        ? `UPDATE negociacoes
              SET valorPorHora = CASE WHEN horasConfirmadasEm IS NULL THEN COALESCE(valorPorHora, valorAcordado) ELSE valorPorHora END,
                  valorDasHoras = ?,
                  horasMarcadasEm = COALESCE(horasMarcadasEm, NOW()),
                  horasConfirmadasEm = COALESCE(horasConfirmadasEm, NOW()),
                  horasConfirmadasPor = COALESCE(horasConfirmadasPor, 'clyon'),
                  horasContestadasEm = NULL, horasContestacao = NULL,
                  valorAcordado = ?, taxaProfissional = ?
            WHERE id = ?`
        : "UPDATE negociacoes SET valorAcordado = ?, taxaProfissional = ? WHERE id = ?",
      g.porHora
        ? [g.gravar.valorAcordado, g.gravar.valorAcordado, g.gravar.taxaProfissional, g.negociacaoId]
        : [g.gravar.valorAcordado, g.gravar.taxaProfissional, g.negociacaoId],
    );
    if (g.precoClyonAcompanha) {
      await conn.execute(
        `UPDATE simulatorOrders SET valorFixoClyon = ?, precoClienteClyon = ?, valorDesejadoCliente = ?
          WHERE id = ? AND valorFixoClyon IS NOT NULL`,
        [g.gravar.valorAcordado, g.gravar.valorAcordado, g.gravar.valorAcordado, g.pedidoId],
      );
    }
    await conn.execute("UPDATE folhasFinais SET activa = NULL WHERE negociacaoId = ? AND activa = 1", [g.negociacaoId]);
    const [ins] = (await conn.execute(
      `INSERT INTO folhasFinais (negociacaoId, pedidoId, entradaJson, contaJson, previaJson, taxaBase, valorAntes, taxaAntes,
                                 valorDepois, taxaDepois, profissionalAntes, profissionalDepois, jaPago, porQuem, motivo, activa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        g.negociacaoId,
        g.pedidoId,
        JSON.stringify(g.entrada),
        JSON.stringify(g.conta),
        JSON.stringify(g.previa),
        g.gravar.taxaBase,
        g.antes.valorAcordado,
        g.antes.taxaProfissional,
        g.gravar.valorAcordado,
        g.gravar.taxaProfissional,
        g.antes.profissional,
        g.previa.profissional,
        g.jaPago ? 1 : 0,
        g.porQuem.slice(0, 120),
        g.motivo ? g.motivo.slice(0, 300) : null,
      ],
    )) as unknown as [{ insertId: number }, unknown];
    await conn.commit();
    return { ok: true, id: Number(ins.insertId) };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * O QUE SE TRANSFERIU AO PROFISSIONAL ANTES DA FOLHA FINAL — d38 v2, commit c.
 *
 * Num trabalho já pago ao profissional, a primeira folha final gravada «já
 * pago» guarda em `profissionalAntes` o que ele tinha recebido. A carteira
 * usa-o para o «pago ao profissional» sair pelo que saiu de facto: se a folha
 * final lhe deu mais, a diferença fica-lhe disponível (o acerto a favor).
 */
export async function transferidoAntesDasFolhasFinais(negociacaoIds: number[]): Promise<Map<number, number>> {
  const ids = [...new Set(negociacaoIds.filter((i) => Number.isInteger(i) && i > 0))];
  const mapa = new Map<number, number>();
  if (ids.length === 0) return mapa;
  await ensureFolhasFinais();
  const pool = await getPool();
  if (!pool) return mapa;
  const [linhas] = (await pool.execute(
    `SELECT f.negociacaoId, f.profissionalAntes FROM folhasFinais f
       JOIN (SELECT negociacaoId, MIN(id) AS id FROM folhasFinais
              WHERE jaPago = 1 AND profissionalAntes IS NOT NULL
                AND negociacaoId IN (${ids.map(() => "?").join(",")})
              GROUP BY negociacaoId) p ON p.id = f.id`,
    ids,
  )) as unknown as [Array<{ negociacaoId: number; profissionalAntes: unknown }>, unknown];
  for (const l of linhas) {
    const v = Number(l.profissionalAntes);
    if (Number.isFinite(v) && v >= 0) mapa.set(Number(l.negociacaoId), v);
  }
  return mapa;
}
