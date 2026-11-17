/**
 * NO MODELO DE 15-11 NÃO HÁ REFERÊNCIA AO CLIENTE — d54 (CEO e dono, 17-11-2026).
 *
 * O cliente paga o trabalho diretamente ao parceiro (`novo-modelo.ts`); a única
 * referência que a CLYON gera num trabalho do modelo novo é a da taxa, ao
 * PROFISSIONAL (a da confirmação, ou a dos Pagamentos › A receber dos
 * profissionais). Vale para as negociações e para os Trabalhos CLYON criados a
 * partir de 15-11: a adjudicação, os «valores para pagamento» e o «Gerar
 * referência» do backoffice passam todos por aqui.
 *
 * Puro: a rota (`/api/admin/pagamentos/criar`) dá-lhe o que já leu.
 */

/** De onde vem o pedido de referência: o «Enviar adjudicação», os «valores para pagamento», ou o cliente. */
export const ORIGENS_DO_CLIENTE = ["adjudicacao", "valores", "cliente"] as const;

export const REFERENCIA_AO_CLIENTE_NO_NOVO_MODELO =
  "No modelo de 15-11 o cliente paga ao parceiro: não se gera referência ao cliente. A única referência deste trabalho é a da taxa, que o parceiro passa à CLYON.";

export const VALORES_PARA_PAGAMENTO_NO_NOVO_MODELO =
  "No modelo de 15-11 o cliente paga ao parceiro: use «Enviar adjudicação», que leva o total e o link do pedido com os dados do parceiro.";

export const ADJUDICACAO_SEM_CONTA_NO_NOVO_MODELO =
  "No modelo de 15-11 a adjudicação leva o total a pagar ao parceiro, e este trabalho ainda não o tem. Confira o valor e o perfil do parceiro e tente outra vez.";

/**
 * Porque não se gera esta referência — ou `null`, quando se pode. No modelo
 * novo: nunca com origem do lado do cliente, e nunca quando quem pagaria é o
 * cliente (só a taxa, ao profissional).
 */
export function porqueNaoHaReferenciaNoNovoModelo(
  t: { novoModelo: boolean },
  origem: unknown,
  quemPaga: "cliente" | "profissional",
): string | null {
  if (!t.novoModelo) return null;
  if (typeof origem === "string" && (ORIGENS_DO_CLIENTE as readonly string[]).includes(origem)) {
    return REFERENCIA_AO_CLIENTE_NO_NOVO_MODELO;
  }
  if (quemPaga !== "profissional") return REFERENCIA_AO_CLIENTE_NO_NOVO_MODELO;
  return null;
}
