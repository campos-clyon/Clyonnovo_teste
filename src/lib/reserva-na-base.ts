import { appendOrderHistory, getPool } from "./db";
import { reservaDoValorUnico, reservaEmTexto, RESERVA_EM_PALAVRAS } from "./reserva";
import { taxasDaNegociacao } from "./taxas-plataforma";

/**
 * A RESERVA NA BASE — d39 (`reserva.ts`). Coluna nova `negociacoes.reservaCent`
 * (só a acrescentar, criada aqui), gravada UMA vez, quando a CLYON fecha a
 * negociação num pedido com valor único (o «Aceitar»/«Contratar» da Mesa).
 * Nula = sem valor único (ou fechada antes disto): a conta é a de sempre.
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

/**
 * Grava a reserva de uma negociação acabada de fechar, se o pedido tem valor
 * único. Não mexe numa reserva já gravada. Devolve a reserva gravada (cêntimos)
 * ou null.
 */
export async function gravarReservaAoFechar(pedidoId: number, negociacaoId: number, porQuem: string): Promise<number | null> {
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

/** As reservas gravadas, por negociação (só as que têm). Na dúvida, vazio. */
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
  } catch (e) {
    console.error("[reservasDe]", e instanceof Error ? e.message : e);
  }
  return mapa;
}
