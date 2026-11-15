import { ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "./db";

/**
 * OS PEDIDOS COM VALOR ÚNICO POR DECIDIR — 15-11-2026 (d39, a parte da
 * Vitória). Dos pedidos dados (os deste número), os que têm o valor único
 * enviado (`valorUnicoCliente`), estão abertos e ainda não têm parceiro
 * escolhido (nenhuma negociação «acordada»). Na dúvida — a base a falhar —
 * devolve vazio, e a conversa segue como antes.
 */
export async function pedidosComValorUnicoPorDecidir(pedidos: readonly number[]): Promise<number[]> {
  const ids = pedidos.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return [];
  try {
    await ensureSimulatorOrdersTable();
    await ensureNegociacoesTable();
    const pool = await getPool();
    if (!pool) return [];
    const [rows] = (await pool.execute(
      `SELECT o.id FROM simulatorOrders o
        WHERE o.id IN (${ids.map(() => "?").join(",")})
          AND o.valorUnicoCliente IS NOT NULL
          AND o.valorFixoClyon IS NULL
          AND (o.status IS NULL OR o.status NOT IN ('cancelado', 'rejeitado', 'arquivado', 'concluido'))
          AND NOT EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'acordada')
        ORDER BY o.id DESC`,
      ids,
    )) as [Array<{ id: number }>, unknown];
    return rows.map((r) => Number(r.id));
  } catch (e) {
    console.error("[pedidosComValorUnicoPorDecidir]", e instanceof Error ? e.message : e);
    return [];
  }
}
