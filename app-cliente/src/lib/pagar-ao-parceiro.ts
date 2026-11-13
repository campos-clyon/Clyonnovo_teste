/**
 * PAGAR AO PARCEIRO NA APP DE CLIENTE — d10, o modelo de 15-11-2026.
 *
 * O cliente paga o trabalho diretamente ao parceiro que contratou
 * (transferência, MB WAY ou dinheiro no local — escolhe ele) e recebe duas
 * faturas no pedido: a do trabalho, do parceiro, e a da taxa da plataforma.
 *
 * A DATA NÃO VIVE AQUI. Quem diz se um trabalho é do modelo novo é o site:
 * `novoModelo` em cada negociação da R5 (antes de contratar: o tipo de fatura do
 * parceiro), `pagamento.pagaAoParceiro` e `GET /api/pagamentos/ao-parceiro`
 * (depois de contratar: o IBAN, o MB WAY, a escolha e as faturas). Antes de
 * 15-11 vêm `null`/falso e a app fica como hoje.
 *
 * Puro: os testes do site importam-no.
 */

/** O bloco `novoModelo` de uma negociação (`NovoModeloNaVista`, src/lib/negociacao-na-vista.ts). */
export type NovoModeloDaNegociacao = {
  perfilFiscal: { tipoDeFatura: "com_iva" | "isento" | "a_confirmar"; fatura: string; emiteGuia: boolean; guia: string | null };
  total: number | null;
  pagarAoParceiroPor: "transferencia" | "mbway" | "dinheiro" | null;
};

/** O que `GET/POST /api/pagamentos/ao-parceiro` devolve ao cliente que contratou. */
export type VistoDoPagarAoParceiro = {
  pagaAoParceiro: boolean;
  frase?: string;
  parceiro?: string;
  paraPagar?: { iban: string | null; titular: string | null; mbway: string | null } | null;
  perfilFiscal?: { fatura: string; guia: string | null };
  conta?: { semIva: number; total: number | null; faturaDoParceiro: number; faturaDaTaxa: number } | null;
  comoPagar?: string | null;
  opcoes?: Array<{ id: string; curta: string; cliente: string }>;
  faturas?: {
    frase: string;
    daTaxa: { url: string; nome: string | null } | null;
    doTrabalho: { url: string; nome: string | null } | null;
  };
};

export const ROTA_DE_PAGAR_AO_PARCEIRO = "/api/pagamentos/ao-parceiro";

export function rotaDePagarAoParceiro(pedidoId: number, negociacaoId: number): string {
  return `${ROTA_DE_PAGAR_AO_PARCEIRO}?pedidoId=${pedidoId}&negociacaoId=${negociacaoId}`;
}

/** A linha que o cliente lê ao escolher: «Fatura com IVA · Emite guia de resíduos». `null` fora do modelo novo. */
export function linhaDaFaturaDoParceiro(nm: NovoModeloDaNegociacao | null | undefined): string | null {
  if (!nm?.perfilFiscal) return null;
  return nm.perfilFiscal.guia ? `${nm.perfilFiscal.fatura} · ${nm.perfilFiscal.guia}` : nm.perfilFiscal.fatura;
}

/** A mesma frase do bloco do site (`PagarAoParceiro.tsx`): só se paga para os dados do pedido. */
export const SO_PARA_ESTES_DADOS =
  "Pague só para estes dados. Se alguém lhe pedir que pague para outra conta ou outro número, não pague e fale connosco.";

/*
 * O PREÇO NÃO SE ESCREVE AQUI (a regra da app de cliente: nenhum preço, taxa ou
 * imposto escrito na app). O total e as três linhas já vêm da R5 no cartão do
 * parceiro contratado (`preco`); este bloco diz só para onde e como pagar.
 */
