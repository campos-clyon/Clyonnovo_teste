/**
 * QUEM SÓ TEM O LINK NÃO VÊ OS DADOS DE PAGAMENTO — d4 (21-11-2026).
 *
 * O link do pedido passa de mão em mão (WhatsApp, email). O IBAN e o MB WAY do
 * parceiro vão só a quem tem conta, onde fica também o registo do pagamento.
 * Quem abre o link sem sessão (no site ou na app) lê este cartão: o parceiro, o
 * total e o caminho para criar a conta. Uma lista própria de campos — nunca a
 * vista completa com campos tirados à mão.
 */

export const PAGAR_SEM_CONTA =
  "Paga diretamente a {parceiro}. Para ver os dados de pagamento e registar o pagamento, crie a sua conta — leva um minuto.";

export const CRIAR_CONTA_PARA_PAGAR = "Criar conta";

export const PAGAR_SO_COM_CONTA = "Para ver os dados de pagamento e registar o pagamento, entre na sua conta.";

export type CartaoDePagarSemConta = { titulo: string; texto: string };

const emEuros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** «Pagar a {parceiro} · {total}» e a frase de criar conta; sem total, só o parceiro. */
export function cartaoDePagarSemConta(parceiro: string, total: number | null): CartaoDePagarSemConta {
  const nome = parceiro.trim() || "o parceiro";
  return {
    titulo: `Pagar a ${nome}${total != null && Number.isFinite(total) ? ` · ${emEuros(total)}` : ""}`,
    texto: PAGAR_SEM_CONTA.replace("{parceiro}", nome),
  };
}

/** O que `GET /api/pagamentos/ao-parceiro` devolve a quem só tem o link: sem IBAN, sem MB WAY, sem escolha. */
export function vistoParaQuemSoTemOLink(visto: {
  parceiro: string;
  conta?: { total: number | null } | null;
}) {
  return {
    pagaAoParceiro: true as const,
    convidado: true as const,
    parceiro: visto.parceiro,
    cartao: cartaoDePagarSemConta(visto.parceiro, visto.conta?.total ?? null),
  };
}
