/**
 * CORRIGIR O VALOR DE UM TRABALHO CLYON JÁ FECHADO — 19-10-2026.
 *
 * *«Atualizei o valor da Cristina mas ele não mudou em cima»* — o dono, no
 * #447. O «Corrigir o valor» dos Pagamentos muda o valor da negociação
 * (`negociacoes.valorAcordado`), e o «TRSul passa a receber» mudou. Mas a
 * conta do pagamento de um Trabalho CLYON lê o preço do pedido
 * (`simulatorOrders.valorFixoClyon`/`precoClienteClyon`), e esse ficou nos
 * 260 €: o cartão dizia 319,80 € ao cliente e 221 € ao profissional, ao lado
 * de «TRSul: 255 €».
 *
 * Aqui decide-se o que acompanha a correcção, sem base de dados:
 *
 *   · Trabalho CLYON de hoje (`taxaClyon` escrita): o valor é o preço ao
 *     cliente sem IVA — `valorFixoClyon` e `precoClienteClyon` passam os dois
 *     para o valor novo, como faz a edição dos Trabalhos CLYON.
 *   · Trabalho CLYON antigo (`taxaClyon` NULL): `valorFixoClyon` era o que o
 *     profissional recebia, e o preço ao cliente é outro — só o primeiro muda.
 *   · Negociação do site: nada no pedido muda.
 */

export type PrecoDoTrabalhoClyon = {
  ofertaClyon: string | null;
  valorFixoClyon: number | null;
  taxaClyon: number | null;
  precoClienteClyon: number | null;
};

export type MudancaNoPedido = { valorFixoClyon: number; precoClienteClyon?: number };

/** O que muda no pedido quando o valor da negociação passa a `novo` — ou nada. */
export function precoClyonAcompanha(t: PrecoDoTrabalhoClyon, novo: number): MudancaNoPedido | null {
  if (!t.ofertaClyon || t.valorFixoClyon == null) return null;
  if (t.taxaClyon != null) return { valorFixoClyon: novo, precoClienteClyon: novo };
  return { valorFixoClyon: novo };
}

/**
 * O preço do pedido não bate com o valor da negociação — o #447 ficou assim
 * antes desta correcção. Gravar o mesmo valor acerta-o, e por isso não conta
 * como «o valor é o mesmo».
 */
export function precoClyonDesalinhado(t: PrecoDoTrabalhoClyon, acordado: number): boolean {
  const mudanca = precoClyonAcompanha(t, acordado);
  if (!mudanca) return false;
  const difere = (a: number | null) => a == null || Math.abs(a - acordado) >= 0.005;
  if (difere(t.valorFixoClyon)) return true;
  return mudanca.precoClienteClyon !== undefined && difere(t.precoClienteClyon);
}

/** Os números do pedido como a base os devolve (DECIMAL chega como texto). */
export function precoDoTrabalhoClyonDaLinha(l: Record<string, unknown>): PrecoDoTrabalhoClyon {
  const n = (v: unknown) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    ofertaClyon: typeof l.ofertaClyon === "string" && l.ofertaClyon !== "" ? l.ofertaClyon : null,
    valorFixoClyon: n(l.valorFixoClyon),
    taxaClyon: n(l.taxaClyon),
    precoClienteClyon: n(l.precoClienteClyon),
  };
}
