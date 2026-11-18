import { appendOrderHistory, ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "./db";
import { arrumarDias, diasDeJson, diasParaGravar, diasPorExtenso, type DiaDoTrabalho } from "./varios-dias";

/**
 * OS VÁRIOS DIAS NA BASE — d64 (18-11-2026). Ver `varios-dias.ts`.
 *
 * A lista vive em `simulatorOrders.diasDoTrabalhoJson` (migração aditiva, v34).
 * Gravar uma lista põe o PRIMEIRO dia em `dataAgendada` e na `dataCombinada`
 * de quem tem o trabalho: tudo o que lê essas colunas continua a ler o dia 1.
 * As cargas feitas que o profissional já registou ficam com o dia delas.
 */

/** Os dias gravados de um pedido (a lista), ou `[]`. */
export async function diasGravadosDoPedido(pedidoId: number): Promise<DiaDoTrabalho[]> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute("SELECT diasDoTrabalhoJson FROM simulatorOrders WHERE id = ? LIMIT 1", [pedidoId])) as [
    Array<{ diasDoTrabalhoJson: string | null }>,
    unknown,
  ];
  return diasDeJson(rows[0]?.diasDoTrabalhoJson ?? null);
}

export type ResultadoDosDias = { ok: true; dias: DiaDoTrabalho[] } | { ok: false; erro: string };

/**
 * GRAVAR OS DIAS (o backoffice). Uma lista de um dia só limpa a lista e fica o
 * dia de sempre. Nunca mexe num pedido cancelado.
 */
export async function gravarDiasDoPedido(pedidoId: number, lista: unknown, porQuem: string): Promise<ResultadoDosDias> {
  const dias = arrumarDias(lista);
  if (dias.length === 0) return { ok: false, erro: "Indique pelo menos um dia." };
  const limite = Date.now() + 2 * 365 * 86_400_000;
  if (dias.some((d) => new Date(d.inicio).getTime() > limite)) {
    return { ok: false, erro: "Um dos dias está demasiado longe. Confirme o ano." };
  }
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return { ok: false, erro: "Base indisponível." };
  const [rows] = (await pool.execute("SELECT status, diasDoTrabalhoJson FROM simulatorOrders WHERE id = ? LIMIT 1", [pedidoId])) as [
    Array<{ status: string | null; diasDoTrabalhoJson: string | null }>,
    unknown,
  ];
  const linha = rows[0];
  if (!linha) return { ok: false, erro: "Pedido não encontrado." };
  if (linha.status === "cancelado") return { ok: false, erro: "Este pedido está cancelado." };

  // As cargas feitas que o profissional já registou ficam com o dia delas.
  const antes = new Map(diasDeJson(linha.diasDoTrabalhoJson).map((d) => [d.dia, d]));
  const finais = dias.map((d) => ({ ...d, cargasFeitas: d.cargasFeitas ?? antes.get(d.dia)?.cargasFeitas ?? null }));
  const primeiro = new Date(finais[0].inicio);

  await pool.execute("UPDATE simulatorOrders SET diasDoTrabalhoJson = ?, dataAgendada = ? WHERE id = ?", [
    diasParaGravar(finais),
    primeiro,
    pedidoId,
  ]);
  // Quem tem o trabalho: o dia combinado passa a ser o dia 1.
  await pool.execute("UPDATE negociacoes SET dataCombinada = ? WHERE pedidoId = ? AND estado = 'acordada'", [primeiro, pedidoId]);

  const texto =
    finais.length > 1
      ? `Vários dias (${finais.length}): ${diasPorExtenso(finais)} — por ${porQuem}.`
      : `Um dia só: ${diasPorExtenso(finais)} — por ${porQuem}.`;
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: texto }).catch(() => {});
  return { ok: true, dias: finais };
}

/**
 * AS CARGAS DE UM DIA (o profissional). Só num trabalho dele, contratado, num
 * dos dias da lista, e até esse dia (não se registam cargas do futuro).
 */
export async function gravarCargasDoDia(
  negociacaoId: number,
  providerId: number,
  dia: string,
  cargas: number,
  agora: Date = new Date(),
): Promise<ResultadoDosDias> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, erro: "Dia inválido." };
  if (!Number.isFinite(cargas) || cargas < 0 || cargas > 99) return { ok: false, erro: "Número de cargas inválido." };
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return { ok: false, erro: "Base indisponível." };
  const [rows] = (await pool.execute(
    `SELECT n.pedidoId, n.estado, n.execucaoEnviadaEm, o.diasDoTrabalhoJson
       FROM negociacoes n JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.id = ? AND n.providerId = ? LIMIT 1`,
    [negociacaoId, providerId],
  )) as [Array<{ pedidoId: number; estado: string; execucaoEnviadaEm: Date | null; diasDoTrabalhoJson: string | null }>, unknown];
  const l = rows[0];
  if (!l) return { ok: false, erro: "Trabalho não encontrado." };
  if (l.estado !== "acordada" || l.execucaoEnviadaEm) return { ok: false, erro: "Este trabalho já não recebe cargas." };
  const dias = diasDeJson(l.diasDoTrabalhoJson);
  const i = dias.findIndex((d) => d.dia === dia);
  if (i < 0) return { ok: false, erro: "Esse dia não é deste trabalho." };
  const { diaEmLisboa } = await import("./hora-de-lisboa");
  if (dia > diaEmLisboa(agora)) return { ok: false, erro: "As cargas registam-se a partir desse dia." };
  const novos = dias.map((d, k) => (k === i ? { ...d, cargasFeitas: Math.round(cargas * 10) / 10 } : d));
  await pool.execute("UPDATE simulatorOrders SET diasDoTrabalhoJson = ? WHERE id = ?", [diasParaGravar(novos), l.pedidoId]);
  await appendOrderHistory(Number(l.pedidoId), {
    type: "note",
    by: null,
    message: `Registadas ${String(cargas).replace(".", ",")} carga(s) no dia ${dia.slice(8, 10)}/${dia.slice(5, 7)}, por quem tem o trabalho.`,
  }).catch(() => {});
  return { ok: true, dias: novos };
}
