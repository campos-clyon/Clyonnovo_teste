/**
 * AS PERGUNTAS AOS PARCEIROS FECHAM COM O PEDIDO — d146b (27-11-2026).
 *
 * Contratado (ou cancelado, arquivado, apagado), as perguntas abertas da
 * Vitória aos parceiros desse pedido (a d97 e as rondas das datas da d136)
 * ficam «encerrada»: nem prazo, nem equipa, nem cliente. Módulo leve de
 * propósito: é chamado em cada contratação e em cada fim de pedido, e não
 * carrega o agente. Sem a tabela (nunca houve perguntas), não faz nada.
 */

import type { FechoDoPedido } from "./disponibilidade";

/** Devolve quantas fechou. Nunca lança. */
export async function fecharAsPerguntasDoPedido(pedidoId: number, fecho: FechoDoPedido): Promise<number> {
  try {
    const { getPool } = await import("../db");
    const pool = await getPool();
    if (!pool) return 0;
    const [u] = (await pool.execute("UPDATE vitoriaPerguntasAoParceiro SET estado = 'encerrada' WHERE pedidoId = ? AND estado = 'aberta'", [pedidoId])) as unknown as [
      { affectedRows?: number },
      unknown,
    ];
    const n = Number(u?.affectedRows ?? 0);
    if (n > 0) {
      const { registarAccao } = await import("./na-base");
      await registarAccao({ ferramenta: "perguntas_fechadas", resultado: { pedidoId, fecho, quantas: n }, pedidoId, ensaio: false });
    }
    return n;
  } catch (e) {
    const code = (e as { code?: string; errno?: number })?.code;
    if (code !== "ER_NO_SUCH_TABLE") console.error("[vitoria-agente] as perguntas do pedido não fecharam:", e instanceof Error ? e.message : e);
    return 0;
  }
}
