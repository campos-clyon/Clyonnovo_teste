/**
 * O PAGAMENTO COMO O CLIENTE O VÊ NA PÁGINA DO PEDIDO — 27-10-2026 (d16).
 *
 * Puro, para o ecrã (`PagarTrabalho.tsx`). Duas regras:
 *
 *   · O MÉTODO CERTO. Até aqui, tudo o que não era MB WAY dizia «por
 *     Multibanco» — também uma transferência ou numerário registados à mão.
 *   · SÓ O QUE O CLIENTE PAGOU. Em dinheiro com IVA incluído, o pagamento
 *     registado é a dívida do PROFISSIONAL à CLYON (o cliente pagou-lhe em
 *     mão): não é o cliente a pagar, e não se lhe mostra como tal. O mesmo
 *     para o abatimento no saldo do profissional.
 */

/** Como se diz, na frase «Recebemos 120,00 € …». `null` quando não se diz. */
export function comoORecebemos(metodo: string | null | undefined): string | null {
  switch ((metodo ?? "").trim()) {
    case "mbway":
      return "por MB WAY";
    case "multibanco":
      return "por Multibanco";
    case "transferencia":
      return "por transferência";
    case "numerario":
      return "em numerário";
    default:
      return null;
  }
}

/** Métodos que não são o cliente a pagar à CLYON. */
const NAO_SAO_DO_CLIENTE = new Set(["abatimento", "ao_profissional"]);

/** O pagamento pago, se for do cliente. */
export function pagamentoDoClienteParaMostrar<T extends { estado: string; metodo: string }>(
  pagamentos: T[],
  doCliente: boolean,
): T | null {
  if (!doCliente) return null;
  return pagamentos.find((p) => p.estado === "pago" && !NAO_SAO_DO_CLIENTE.has(p.metodo)) ?? null;
}
