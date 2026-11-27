/**
 * A MUDANÇA À HORA SEM O VALOR ENVIADO, NA BASE — d14 (27-11-2026). A regra e
 * o texto-modelo estão em `mudanca-a-hora-sem-valor.ts`. Só leitura: devolve o
 * n.º do pedido e a data de entrada, nada de dados de pessoas.
 */

import { getPool } from "./db";
import { ESTADOS_DE_PEDIDO_FECHADO_SQL } from "./pedido-arrumado";
import {
  mudancaAHoraSemValor,
  type MudancaSemValorParaOLado,
  type PedidoDeMudancaParaOSelo,
} from "./mudanca-a-hora-sem-valor";

/** Os pedidos dos últimos 30 dias (o mesmo alcance dos «sem propostas»). */
export async function mudancasAHoraSemValorNaMesa(agora: Date = new Date()): Promise<MudancaSemValorParaOLado[]> {
  try {
    const pool = await getPool();
    if (!pool) return [];
    const [rows] = (await pool.query(
      `SELECT o.id, o.serviceType, o.baseDoPreco, o.status, o.propostaEnviadaEm, o.createdAt
         FROM simulatorOrders o
        WHERE o.serviceType = 'mudanca' AND o.baseDoPreco = 'hora'
          AND o.propostaEnviadaEm IS NULL AND o.anonimizadoEm IS NULL
          AND o.createdAt > UTC_TIMESTAMP() - INTERVAL 30 DAY
          AND COALESCE(o.status, '') NOT IN ${ESTADOS_DE_PEDIDO_FECHADO_SQL}
        ORDER BY o.id DESC LIMIT 200`,
    )) as [Array<Record<string, unknown>>, unknown];
    const out: MudancaSemValorParaOLado[] = [];
    for (const r of rows) {
      const p: PedidoDeMudancaParaOSelo = {
        id: Number(r.id),
        serviceType: (r.serviceType as string | null) ?? null,
        baseDoPreco: (r.baseDoPreco as string | null) ?? null,
        status: (r.status as string | null) ?? null,
        propostaEnviadaEm: (r.propostaEnviadaEm as string | Date | null) ?? null,
        createdAt: (r.createdAt as string | Date | null) ?? null,
      };
      const m = mudancaAHoraSemValor(p, agora);
      if (m) out.push({ pedidoId: m.pedidoId, desde: m.desde.toISOString() });
    }
    return out;
  } catch (e) {
    console.error("[mudanca-sem-valor] a Mesa não leu as mudanças sem valor:", e instanceof Error ? e.message : e);
    return [];
  }
}
