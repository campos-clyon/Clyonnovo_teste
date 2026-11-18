import { appendOrderHistory, ensureSimulatorOrdersTable, getPool } from "./db";
import { horasEmPalavrasCurtas, horasFeitas, lerRegistoReal, registoRealDeJson, registoRealEmPalavras, type DiaReal } from "./registo-real";

/**
 * O REGISTO REAL NA BASE — d67 (18-11-2026). Ver `registo-real.ts`. Vive em
 * `simulatorOrders.registoRealJson` (migração aditiva, v34). Escrevem-no a
 * folha final e o «Registo real» do backoffice (admin e assistentes); o
 * profissional ainda não (os botões «Comecei/Pausa/Acabei» da app são um
 * passo seguinte).
 */

export async function registoRealDoPedido(pedidoId: number): Promise<DiaReal[]> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute("SELECT registoRealJson FROM simulatorOrders WHERE id = ? LIMIT 1", [pedidoId])) as [
    Array<{ registoRealJson: string | null }>,
    unknown,
  ];
  return registoRealDeJson(rows[0]?.registoRealJson ?? null);
}

export type ResultadoDoRegisto = { ok: true; dias: DiaReal[]; horas: number } | { ok: false; erro: string };

/** Grava o registo (ou limpa-o com uma lista vazia). Fica no histórico do pedido. */
export async function gravarRegistoReal(pedidoId: number, lista: unknown, porQuem: string): Promise<ResultadoDoRegisto> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return { ok: false, erro: "Base indisponível." };
  if (Array.isArray(lista) && lista.length === 0) {
    await pool.execute("UPDATE simulatorOrders SET registoRealJson = NULL WHERE id = ?", [pedidoId]);
    await appendOrderHistory(pedidoId, { type: "note", by: null, message: `Registo real apagado — por ${porQuem}.` }).catch(() => {});
    return { ok: true, dias: [], horas: 0 };
  }
  const r = lerRegistoReal(lista);
  if (!r.ok) return r;
  const [res] = (await pool.execute("UPDATE simulatorOrders SET registoRealJson = ? WHERE id = ?", [JSON.stringify(r.dias), pedidoId])) as [
    { affectedRows: number },
    unknown,
  ];
  if (Number(res.affectedRows) !== 1) return { ok: false, erro: "Pedido não encontrado." };
  const horas = horasFeitas(r.dias);
  await appendOrderHistory(pedidoId, {
    type: "note",
    by: null,
    message: `Registo real: ${registoRealEmPalavras(r.dias)} (${horasEmPalavrasCurtas(horas)}) — por ${porQuem}.`,
  }).catch(() => {});
  return { ok: true, dias: r.dias, horas };
}
