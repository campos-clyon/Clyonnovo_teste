/**
 * A FOLHA DA MEDIÇÃO DA d7, NA BASE — d14 (27-11-2026). A regra e o formato
 * estão em `folha-d7-mudancas.ts`. Só leitura, só colunas do pedido e das
 * negociações: nada de nome, telefone, email ou morada.
 */

import { getPool } from "./db";
import { DIAS_DA_MEDICAO_D7, folhaD7, type LinhaDaFolhaD7, type PedidoParaAFolhaD7 } from "./folha-d7-mudancas";
import { horasPrevistasDaLinha } from "./horas-do-trabalho";

/** Todas as mudanças dos últimos 30 dias (e, com `dias`, outra janela até 120). */
export async function folhaD7DasMudancas(dias: number = DIAS_DA_MEDICAO_D7): Promise<LinhaDaFolhaD7[]> {
  const pool = await getPool();
  if (!pool) return [];
  const janela = Math.max(1, Math.min(120, Math.floor(dias) || DIAS_DA_MEDICAO_D7));
  const [pedidos] = (await pool.query(
    `SELECT o.id, o.createdAt, o.baseDoPreco, o.status, o.valorUnicoCliente, o.precoAceiteEm,
            o.motivoDoFecho, o.quantoQueriaPagar, o.description AS descricaoDasHoras,
            CASE WHEN JSON_VALID(o.rawOrderJson) THEN CAST(JSON_OBJECT(
              'tipologia', JSON_EXTRACT(o.rawOrderJson, '$.tipologia'),
              'needsDismantling', JSON_EXTRACT(o.rawOrderJson, '$.needsDismantling')
            ) AS CHAR) ELSE NULL END AS rawDasHoras
       FROM simulatorOrders o
      WHERE o.serviceType = 'mudanca' AND o.createdAt > UTC_TIMESTAMP() - INTERVAL ${janela} DAY
      ORDER BY o.id DESC LIMIT 500`,
  )) as [Array<Record<string, unknown>>, unknown];
  if (pedidos.length === 0) return [];
  const ids = pedidos.map((p) => Number(p.id));
  const [negs] = (await pool.query(
    `SELECT pedidoId, estado, propostasJson, valorAcordado FROM negociacoes WHERE pedidoId IN (${ids.map(() => "?").join(",")})`,
    ids,
  )) as [Array<Record<string, unknown>>, unknown];
  const porPedido = new Map<number, PedidoParaAFolhaD7["negociacoes"][number][]>();
  for (const n of negs) {
    const l = porPedido.get(Number(n.pedidoId)) ?? [];
    l.push({
      estado: String(n.estado ?? ""),
      propostasJson: (n.propostasJson as string | null) ?? null,
      valorAcordado: (n.valorAcordado as number | string | null) ?? null,
    });
    porPedido.set(Number(n.pedidoId), l);
  }
  return folhaD7(
    pedidos.map((p) => ({
      id: Number(p.id),
      createdAt: p.createdAt as string | Date | null,
      baseDoPreco: (p.baseDoPreco as string | null) ?? null,
      status: (p.status as string | null) ?? null,
      horasPrevistas: horasPrevistasDaLinha({ serviceType: "mudanca", description: p.descricaoDasHoras, rawOrderJson: p.rawDasHoras }),
      valorUnicoCliente: (p.valorUnicoCliente as number | string | null) ?? null,
      precoAceiteEm: (p.precoAceiteEm as string | Date | null) ?? null,
      motivoDoFecho: (p.motivoDoFecho as string | null) ?? null,
      quantoQueriaPagar: (p.quantoQueriaPagar as number | string | null) ?? null,
      negociacoes: porPedido.get(Number(p.id)) ?? [],
    })),
  );
}
