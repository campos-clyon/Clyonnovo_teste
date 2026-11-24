import { appendOrderHistory, ensureRegistoTable, getPool, registarNaTransaccao } from "./db";
import {
  CHAVE_DO_INTERRUPTOR_DA_RESERVA,
  NOME_DO_INTERRUPTOR_DA_RESERVA,
  reservaDoValorUnico,
  reservaEmTexto,
  RESERVA_EM_PALAVRAS,
  semAReserva,
} from "./reserva";
import { taxasDaNegociacao } from "./taxas-plataforma";

/**
 * A RESERVA NA BASE — d39 (`reserva.ts`). Coluna nova `negociacoes.reservaCent`
 * (só a acrescentar, criada aqui), gravada UMA vez, quando a CLYON fecha a
 * negociação num pedido com valor único (o «Aceitar»/«Contratar» da Mesa).
 * Nula = sem valor único (ou fechada antes disto): a conta é a de sempre.
 *
 * d101 (dono, 24-11-2026): tudo isto só vale com o interruptor «Reserva do
 * valor único» LIGADO. Desligado (por omissão e na dúvida), nada se grava e as
 * reservas já gravadas lêem-se a nulo — a coluna e os valores ficam na base.
 */

let pronta = false;

export async function ensureColunaDaReserva(): Promise<void> {
  if (pronta) return;
  const pool = await getPool();
  if (!pool) return;
  try {
    await pool.execute("ALTER TABLE negociacoes ADD COLUMN reservaCent INT NULL DEFAULT NULL");
  } catch (e) {
    if (!/Duplicate column/i.test(e instanceof Error ? e.message : String(e))) throw e;
  }
  pronta = true;
}

/* ── O interruptor (Configs) — DESLIGADO por omissão e na dúvida ───────────── */

export type InterruptorDaReserva = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

/** Quanto tempo uma leitura do interruptor vale nesta instância. */
export const VALIDADE_DA_LEITURA_DO_INTERRUPTOR_MS = 30_000;
let lido: { ligado: boolean; em: number } | null = null;

const SQL_DA_TABELA_DOS_INTERRUPTORES = `CREATE TABLE IF NOT EXISTS retencaoInterruptores (
    chave     VARCHAR(40) NOT NULL PRIMARY KEY,
    ligado    TINYINT(1) NOT NULL DEFAULT 0,
    mudadoEm  DATETIME NULL DEFAULT NULL,
    porQuem   VARCHAR(120) NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/** Lê o interruptor na base. DESLIGADO NA DÚVIDA: sem linha, sem tabela, ou com a base a falhar. */
export async function interruptorDaReserva(): Promise<InterruptorDaReserva> {
  const desligado: InterruptorDaReserva = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const pool = await getPool();
    if (!pool) {
      lido = { ligado: false, em: Date.now() };
      return desligado;
    }
    const [rows] = (await pool.execute("SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1", [
      CHAVE_DO_INTERRUPTOR_DA_RESERVA,
    ])) as unknown as [Array<{ ligado: unknown; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = Array.isArray(rows) ? rows[0] : undefined;
    const ligado = l != null && Number(l.ligado) === 1;
    lido = { ligado, em: Date.now() };
    if (!l) return desligado;
    return {
      ligado,
      mudadoEm: l.mudadoEm ? new Date(l.mudadoEm).toISOString() : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[reserva] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    lido = { ligado: false, em: Date.now() };
    return desligado;
  }
}

/** O interruptor, com a leitura guardada uns segundos (é lido em cada lista de negociações com reserva). */
export async function reservaLigada(): Promise<boolean> {
  if (lido && Date.now() - lido.em < VALIDADE_DA_LEITURA_DO_INTERRUPTOR_MS) return lido.ligado;
  return (await interruptorDaReserva()).ligado;
}

/**
 * As linhas da base, sem a reserva quando o interruptor está desligado. Só vai
 * ler o interruptor quando alguma linha traz reserva.
 */
export async function semAReservaSeDesligada<T>(linhas: T[]): Promise<T[]> {
  if (!Array.isArray(linhas) || !linhas.some((l) => (l as { reservaCent?: unknown } | null)?.reservaCent != null)) return linhas;
  return (await reservaLigada()) ? linhas : semAReserva(linhas);
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDaReserva(ligar: boolean, porQuem: string): Promise<InterruptorDaReserva> {
  const pool = await getPool();
  if (!pool) throw new Error("[reserva] base de dados indisponível");
  await pool.execute(SQL_DA_TABELA_DOS_INTERRUPTORES);
  await ensureRegistoTable();
  const antes = await interruptorDaReserva();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_INTERRUPTOR_DA_RESERVA, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "reserva_valor_unico_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DA_RESERVA}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d101).`,
    });
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* já houve rollback */
    }
    throw e;
  } finally {
    conn.release();
  }
  lido = null;
  return interruptorDaReserva();
}

/* ── Gravar e ler ─────────────────────────────────────────────────────────── */

/**
 * Grava a reserva de uma negociação acabada de fechar, se o pedido tem valor
 * único e o interruptor está ligado. Não mexe numa reserva já gravada. Devolve
 * a reserva gravada (cêntimos) ou null.
 */
export async function gravarReservaAoFechar(pedidoId: number, negociacaoId: number, porQuem: string): Promise<number | null> {
  // d101: desligado, não se grava nada.
  if (!(await reservaLigada())) return null;
  await ensureColunaDaReserva();
  const pool = await getPool();
  if (!pool) return null;
  const [linhas] = (await pool.execute(
    `SELECT n.estado, n.valorAcordado, n.taxaCliente, n.taxaProfissional, n.reservaCent, o.valorUnicoCliente
       FROM negociacoes n JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.id = ? AND n.pedidoId = ? LIMIT 1`,
    [negociacaoId, pedidoId],
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  const l = linhas[0];
  if (!l || l.estado !== "acordada" || l.valorUnicoCliente == null || l.reservaCent != null) return null;
  const reserva = reservaDoValorUnico(Number(l.valorUnicoCliente), Number(l.valorAcordado), taxasDaNegociacao(l));
  if (reserva == null) return null;
  const [r] = (await pool.execute("UPDATE negociacoes SET reservaCent = ? WHERE id = ? AND reservaCent IS NULL", [reserva, negociacaoId])) as unknown as [
    { affectedRows?: number },
    unknown,
  ];
  if (Number(r?.affectedRows ?? 0) === 0) return null;
  await appendOrderHistory(pedidoId, {
    type: "created",
    by: null,
    message:
      `Valor único: ${RESERVA_EM_PALAVRAS} de ${reservaEmTexto(reserva)} (negociação #${negociacaoId}, fechada por ${porQuem}). ` +
      (reserva >= 0
        ? "Fica na parte da CLYON; o parceiro fatura a parte dele."
        : "O parceiro pediu mais do que o valor único: a parte da CLYON desce."),
  }).catch(() => {});
  return reserva;
}

/** As reservas que contam, por negociação (só as que têm). Desligado ou na dúvida, vazio. */
export async function reservasDe(negociacaoIds: number[]): Promise<Map<number, number>> {
  const ids = [...new Set(negociacaoIds.filter((i) => Number.isInteger(i) && i > 0))];
  const mapa = new Map<number, number>();
  if (ids.length === 0) return mapa;
  try {
    await ensureColunaDaReserva();
    const pool = await getPool();
    if (!pool) return mapa;
    const [linhas] = (await pool.execute(
      `SELECT id, reservaCent FROM negociacoes WHERE reservaCent IS NOT NULL AND id IN (${ids.map(() => "?").join(",")})`,
      ids,
    )) as unknown as [Array<{ id: number; reservaCent: unknown }>, unknown];
    for (const l of linhas) {
      const v = Number(l.reservaCent);
      if (Number.isInteger(v)) mapa.set(Number(l.id), v);
    }
    // d101: desligado, as gravadas não contam.
    if (mapa.size > 0 && !(await reservaLigada())) return new Map<number, number>();
  } catch (e) {
    console.error("[reservasDe]", e instanceof Error ? e.message : e);
    return new Map<number, number>();
  }
  return mapa;
}

/**
 * As negociações com reserva gravada — para a rota de admin da d101, que as
 * refaz. Lê a coluna mesmo com o interruptor desligado (é o histórico).
 */
export async function negociacoesComReservaGravada(): Promise<
  Array<{ negociacaoId: number; pedidoId: number; reservaCent: number; valorAcordado: number | null; valorUnicoCliente: number | null }>
> {
  await ensureColunaDaReserva();
  const pool = await getPool();
  if (!pool) return [];
  const [linhas] = (await pool.execute(
    `SELECT n.id AS negociacaoId, n.pedidoId, n.reservaCent, n.valorAcordado, o.valorUnicoCliente
       FROM negociacoes n LEFT JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.reservaCent IS NOT NULL
      ORDER BY n.pedidoId DESC, n.id DESC`,
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  const num = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  return linhas.map((l) => ({
    negociacaoId: Number(l.negociacaoId),
    pedidoId: Number(l.pedidoId),
    reservaCent: Number(l.reservaCent),
    valorAcordado: num(l.valorAcordado),
    valorUnicoCliente: num(l.valorUnicoCliente),
  }));
}
