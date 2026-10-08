import { modeloDaNegociacao } from "./iva-incluido";
import type { ComoPagou, ParaQue } from "./pagamento-declarado";

/**
 * CONFIRMAR VÁRIOS TRABALHOS FEITOS DE UMA VEZ, nas Negociações — 08-10-2026.
 *
 * *«Sim, também nas Negociações»* — o «aprovar todos» dos Pagamentos, no bloco
 * «Feitos, à espera de confirmação».
 *
 * É o «Está feito» de cada cartão, com as MESMAS duas perguntas (para que foi
 * o pagamento e como o cliente pagou), respondidas uma vez para todos os
 * marcados, e a mesma rota (`/api/admin/negociacoes/agir`, `confirmar`), um
 * pedido de cada vez. Quem decide se a CLYON pode confirmar é a mesma regra do
 * cartão (`clyonPodeConfirmar`): se o cliente tem email, confirma ele pelo
 * link, e o pedido fica de fora com o porquê.
 *
 * O ecrã dá a esta função o que já sabe de cada pedido — a negociação à espera
 * de confirmação (pela `esperaConfirmacao` dele) e se a CLYON pode confirmar —
 * para a regra não ter duas cópias.
 */

export type PedidoAConfirmar = {
  pedidoId: number;
  /** A negociação feita e por confirmar, ou nula se o pedido não tem nenhuma. */
  negociacao: { id: number; criadaEm: string | null } | null;
  /** `clyonPodeConfirmar(p)` — a CLYON responde pelo cliente neste pedido. */
  podeConfirmar: boolean;
};

export const ROTA_DE_CONFIRMAR = "/api/admin/negociacoes/agir";

export type PlanoDeConfirmacao = {
  /** Os que se confirmam, com o corpo de cada chamada. */
  aConfirmar: Array<{ pedidoId: number; corpo: Record<string, unknown> }>;
  /** Os que têm trabalho por confirmar mas não podem ser confirmados aqui. */
  deFora: Array<{ pedidoId: number; porque: string }>;
  /** Os marcados que não têm trabalho feito por confirmar — não são tocados. */
  semNada: number;
};

/**
 * Há algum que precise da pergunta «com ou sem factura»? Com IVA incluído há
 * factura em todas as vendas e não se pergunta (como no cartão).
 */
export function precisaDoParaQue(pedidos: readonly PedidoAConfirmar[]): boolean {
  return pedidos.some(
    (p) => p.negociacao && p.podeConfirmar && modeloDaNegociacao(p.negociacao.criadaEm) !== "iva_incluido",
  );
}

export function planoDeConfirmacao(
  pedidos: readonly PedidoAConfirmar[],
  respostas: { paraQue: ParaQue | null; como: ComoPagou },
): PlanoDeConfirmacao {
  const plano: PlanoDeConfirmacao = { aConfirmar: [], deFora: [], semNada: 0 };
  for (const p of pedidos) {
    if (!p.negociacao) {
      plano.semNada += 1;
      continue;
    }
    if (!p.podeConfirmar) {
      plano.deFora.push({ pedidoId: p.pedidoId, porque: "o cliente tem email e confirma pelo link" });
      continue;
    }
    const ivaIncluido = modeloDaNegociacao(p.negociacao.criadaEm) === "iva_incluido";
    const paraQue = ivaIncluido ? "com_factura" : respostas.paraQue;
    if (!paraQue) {
      plano.deFora.push({ pedidoId: p.pedidoId, porque: "falta dizer se foi com ou sem factura" });
      continue;
    }
    plano.aConfirmar.push({
      pedidoId: p.pedidoId,
      corpo: {
        pedidoId: p.pedidoId,
        negociacaoId: p.negociacao.id,
        accao: "confirmar",
        paraQue,
        como: respostas.como,
      },
    });
  }
  return plano;
}
