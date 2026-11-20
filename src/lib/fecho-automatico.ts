import {
  appendOrderHistory,
  ensureNegociacoesTable,
  ensureSimulatorOrdersTable,
  getPool,
  getSimulatorOrderById,
  registarSemFalhar,
  updateSimulatorOrder,
} from "@/lib/db";
import { trabalhosParaGerir, type TrabalhoParaGerir } from "@/lib/trabalhos-para-gerir";
import {
  HISTORICO_DO_FECHO_AUTOMATICO,
  ORIGEM_DO_FECHO_AUTOMATICO,
  porqueNaoFecha,
  type PagoPorRealizar,
  type PorqueNaoFecha,
} from "@/lib/pedido-concluido";

export type { PagoPorRealizar };

/**
 * O PEDIDO PAGO DOS DOIS LADOS PASSA A «CONCLUÍDO» SOZINHO — d76 (CEO e dono,
 * 20-11-2026). A regra é `pedido-concluido.ts`; aqui só se lê a base e se
 * escreve.
 *
 * O FECHO É O DO «REALIZADO» da lista de Pedidos: `updateSimulatorOrder` com
 * `status: "concluido"` — a data do fecho, a exportação para a folha do Google,
 * o aviso e o pedido de avaliação ao cliente. Não há outro caminho.
 *
 * Quem chama: cada sítio que regista o segundo pagamento (o do cliente, o do
 * profissional, a taxa do parceiro, o webhook do euPago e a conferência), e a
 * conferência de hora a hora (`conferir-pagamentos`), que fecha os de data
 * futura depois do dia. NUNCA LANÇA: um fecho que falha não pode desfazer o
 * pagamento que acabou de se gravar.
 *
 * Um pagamento desfeito depois NÃO reabre o pedido: nada aqui volta atrás.
 */

type Trabalho = TrabalhoParaGerir & { pedidoId: number; negociacaoId: number; contaDeTeste?: boolean; agendadoPara?: string | null };

/** As negociações acordadas de um pedido, pela conta de sempre (`trabalhosParaGerir`). */
async function trabalhosDoPedido(pedidoId: number): Promise<Trabalho[]> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];
  const [r] = (await pool.execute(
    `SELECT id FROM negociacoes WHERE pedidoId = ? AND estado = 'acordada' AND valorAcordado IS NOT NULL`,
    [pedidoId],
  )) as [Array<{ id: number }>, unknown];
  const linhas = await Promise.all(r.map((n) => trabalhosParaGerir(Number(n.id))));
  return linhas.flat() as Trabalho[];
}

export type ResultadoDoFecho = { fechou: boolean; porque: PorqueNaoFecha | null };

/**
 * MARCA O PEDIDO COMO REALIZADO — o mesmo fecho do «Realizado», com as guardas
 * d27 relidas na hora (um cancelado fica cancelado; um concluído não volta a
 * exportar). `origem` diz quem: o fecho automático, ou o admin pela lista.
 */
export async function marcarComoRealizado(
  pedidoId: number,
  quem: { origem: "automático" } | { origem: "admin"; colab: { id: number; nome: string; papel: string } | null },
): Promise<boolean> {
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return false;
  const antes = String(pedido.status ?? "");
  if (antes === "concluido" || ["cancelado", "arquivado", "rejeitado"].includes(antes)) return false;

  await updateSimulatorOrder(pedidoId, { status: "concluido" });

  const automatico = quem.origem === "automático";
  const nome = automatico ? ORIGEM_DO_FECHO_AUTOMATICO : (quem.colab?.nome ?? "admin");
  await appendOrderHistory(pedidoId, {
    type: "note",
    by: automatico || !quem.colab ? null : { id: quem.colab.id, nome: quem.colab.nome, role: quem.colab.papel },
    message: automatico
      ? HISTORICO_DO_FECHO_AUTOMATICO
      : `Realizado por ${nome}, na lista «Pagos dos dois lados, ainda não realizados»: cliente e profissional pagos`,
  }).catch((e) => console.error("[fecho-automatico] histórico:", e instanceof Error ? e.message : e));
  await registarSemFalhar({
    acontecimento: "pedido_concluido",
    pedidoId,
    autorTipo: automatico ? "sistema" : "clyon",
    autorNome: nome,
    estadoAntes: antes || null,
    estadoDepois: "concluido",
    resumo: automatico ? HISTORICO_DO_FECHO_AUTOMATICO : `Realizado por ${nome}: cliente e profissional pagos`,
    detalhe: { origem: automatico ? ORIGEM_DO_FECHO_AUTOMATICO : "admin", decisao: "d76" },
  });
  return true;
}

/**
 * DEPOIS DE UM PAGAMENTO: o pedido fecha se ficou pago dos dois lados. Pela
 * negociação (é o que quem paga sabe) ou pelo pedido. Nunca lança.
 */
export async function fecharSePagoDosDoisLados(
  alvo: { negociacaoId: number } | { pedidoId: number },
  agora: Date = new Date(),
): Promise<ResultadoDoFecho> {
  try {
    let pedidoId = "pedidoId" in alvo ? alvo.pedidoId : 0;
    if (!pedidoId) {
      const pool = await getPool();
      if (!pool) return { fechou: false, porque: null };
      const [r] = (await pool.execute(`SELECT pedidoId FROM negociacoes WHERE id = ? LIMIT 1`, [
        (alvo as { negociacaoId: number }).negociacaoId,
      ])) as [Array<{ pedidoId: number | null }>, unknown];
      pedidoId = Number(r[0]?.pedidoId ?? 0);
    }
    if (!pedidoId) return { fechou: false, porque: "sem_trabalho" };
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return { fechou: false, porque: "sem_trabalho" };
    const trabalhos = await trabalhosDoPedido(pedidoId);
    const porque = porqueNaoFecha({ status: pedido.status, trabalhos }, agora);
    if (porque) return { fechou: false, porque };
    const fechou = await marcarComoRealizado(pedidoId, { origem: "automático" });
    return { fechou, porque: fechou ? null : "ja_concluido" };
  } catch (e) {
    console.error("[fecho-automatico]", e instanceof Error ? e.message : e);
    return { fechou: false, porque: null };
  }
}


/**
 * OS QUE JÁ ESTÃO PAGOS DOS DOIS LADOS E NÃO FICARAM REALIZADOS — os de antes
 * da d76, para o dono fechar com um clique. Os candidatos saem de uma consulta
 * larga (acordados, pedido por fechar, pagos ou confirmados) e a regra decide
 * cada um pela conta de sempre. Só lê.
 */
export async function pagosDosDoisLadosPorRealizar(agora: Date = new Date(), limite = 200): Promise<PagoPorRealizar[]> {
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return [];
  const [r] = (await pool.execute(
    `SELECT DISTINCT o.id
       FROM simulatorOrders o
       JOIN negociacoes n ON n.pedidoId = o.id AND n.estado = 'acordada' AND n.valorAcordado IS NOT NULL
      WHERE (o.status IS NULL OR o.status NOT IN ('concluido', 'cancelado', 'arquivado', 'rejeitado'))
        AND (n.pagoEm IS NOT NULL OR n.confirmadoEm IS NOT NULL)
      ORDER BY o.id DESC
      LIMIT ${Math.max(1, Math.min(500, Math.floor(limite)))}`,
  )) as [Array<{ id: number }>, unknown];

  const lista: PagoPorRealizar[] = [];
  for (const { id } of r) {
    const pedido = await getSimulatorOrderById(Number(id));
    if (!pedido) continue;
    const trabalhos = await trabalhosDoPedido(Number(id));
    const porque = porqueNaoFecha({ status: pedido.status, trabalhos }, agora);
    if (porque !== null && porque !== "data_futura") continue;
    const t = trabalhos[0] as Trabalho & { profissional?: string; clientePaga?: number; servico?: string | null; cidade?: string | null };
    lista.push({
      pedidoId: Number(id),
      estado: String(pedido.status ?? ""),
      servico: t?.servico ?? null,
      cidade: t?.cidade ?? null,
      profissional: String(t?.profissional ?? ""),
      clientePaga: typeof t?.clientePaga === "number" ? t.clientePaga : null,
      agendadoPara: t?.agendadoPara ?? null,
      dataFutura: porque === "data_futura",
      pagoDosDoisLadosEm: trabalhos.reduce<number | null>((m, x) => {
        const q = quandoFicouPago(x);
        return q == null ? m : m == null ? q : Math.max(m, q);
      }, null),
    });
  }
  return lista;
}

/**
 * DESDE QUANDO HÁ FECHO AUTOMÁTICO — a publicação da d76. Um pedido cujo
 * segundo pagamento entrou antes disto é «de antes»: não se fecha por rotina,
 * fica na lista para o dono (ordem da d76: os parados não se mudam por script).
 */
export const FECHO_AUTOMATICO_DESDE = "2026-11-20T21:00:00Z";

/** Quando ficou pago dos dois lados — o mais tardio dos marcos do dinheiro. */
export function quandoFicouPago(t: TrabalhoParaGerir): number | null {
  const ms = [t.clientePagouEm, t.pagoEm, t.confirmadoEm]
    .map((v) => (v ? new Date(v as string).getTime() : NaN))
    .filter((n) => Number.isFinite(n));
  return ms.length ? Math.max(...ms) : null;
}

/**
 * A CONFERÊNCIA DE HORA A HORA fecha, depois do dia, os que ficaram pagos dos
 * dois lados com a data por chegar — sem cron novo (vive em
 * `conferir-pagamentos`). Só os pagos depois de `FECHO_AUTOMATICO_DESDE`.
 */
export async function fecharOsQueChegaramADia(agora: Date = new Date()): Promise<number> {
  try {
    const lista = await pagosDosDoisLadosPorRealizar(agora, 100);
    const desde = new Date(FECHO_AUTOMATICO_DESDE).getTime();
    let n = 0;
    for (const l of lista) {
      if (l.dataFutura || l.pagoDosDoisLadosEm == null || l.pagoDosDoisLadosEm < desde) continue;
      const r = await fecharSePagoDosDoisLados({ pedidoId: l.pedidoId }, agora);
      if (r.fechou) n++;
    }
    return n;
  } catch (e) {
    console.error("[fecho-automatico] conferência:", e instanceof Error ? e.message : e);
    return 0;
  }
}
