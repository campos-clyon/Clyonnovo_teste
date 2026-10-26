/**
 * O LINK QUE ABRE O WHATSAPP NA CONVERSA CERTA, COM O TEXTO JÁ ESCRITO.
 *
 * Parece uma linha e não é. Os telefones nesta base estão gravados como o
 * cliente os escreveu: «960000556», «960 000 556», «+351 960000556»,
 * «00351960000556». O `wa.me` exige o número internacional sem sinais — e se
 * lhe dermos nove dígitos sem indicativo, ele abre uma conversa com um número
 * que não existe, ou pior, com o número de outra pessoa noutro país.
 *
 * Era a diferença entre mandar o orçamento e pensar que o tinha mandado.
 */

/** Portugal. Se um dia houver clientes noutro país, isto passa a parâmetro. */
const INDICATIVO = "351";

/**
 * O número pronto para o `wa.me`, ou null se não der para lá chegar.
 *
 * Devolve null em vez de adivinhar: um número a menos é um telefonema; um
 * número errado é uma mensagem com o orçamento de um cliente a cair no
 * telemóvel de um estranho.
 */
export function numeroParaWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;

  let d = telefone.replace(/\D/g, "");
  if (!d) return null;

  // 00351... — a forma internacional antiga, ainda escrita por muita gente.
  if (d.startsWith("00")) d = d.slice(2);

  // Já traz indicativo e um número plausível a seguir.
  if (d.startsWith(INDICATIVO) && d.length === INDICATIVO.length + 9) return d;

  /*
   * DE OUTRO PAÍS, ESCRITO COM «+» OU «00» — 21-10-2026. Um pedido tinha
   * «+44 7700 900123» e ficava sem os botões da proposta. Com o sinal à
   * frente, o indicativo está escrito e não há nada a adivinhar: vai como
   * está, se tiver o tamanho de um número internacional (8 a 15 algarismos).
   * Sem o sinal, só pela regra mais apertada de `deForaSemSinal`.
   */
  const comIndicativoEscrito = /^[\s(]*(\+|00)/.test(telefone);
  if (comIndicativoEscrito && !d.startsWith(INDICATIVO)) {
    return d.length >= 8 && d.length <= 15 ? d : null;
  }

  // Nove dígitos: é português, e falta-lhe o indicativo.
  if (d.length === 9) return INDICATIVO + d;

  // De outro país, mas sem o «+» — ver `deForaSemSinal`.
  if (!comIndicativoEscrito && deForaSemSinal(d)) return d;

  // Qualquer outra coisa fica de fora: não se resolve a adivinhar.
  return null;
}

/*
 * DE OUTRO PAÍS, SEM «+» NEM «00» — 26-10-2026. A ponte do WhatsApp entrega o
 * número inteiro sem o sinal (um da Rússia: «79000000000»), e um pedido gravado
 * assim ficava sem o link. Conta como de fora quando, só com algarismos:
 *   · tem 10 a 15 algarismos (o E.164 vai até 15);
 *   · não começa por 0 (um «06…» é um número nacional de algum sítio, sem país);
 *   · não é português: nada que comece por 351 (com 12 é português e já
 *     passou acima; com outro tamanho é um +351 mal escrito);
 *   · e não é um português com um algarismo a mais: 10 algarismos a começar
 *     por 9 ou 2 continuam de fora.
 * Fica também de fora um país cujo número inteiro tem 10 algarismos e começa
 * por 2 ou 9 (Cabo Verde, São Tomé): esses só passam com o «+».
 */
function deForaSemSinal(d: string): boolean {
  if (d.length < 10 || d.length > 15) return false;
  if (d.startsWith("0") || d.startsWith(INDICATIVO)) return false;
  if (d.length === 10 && /^[29]/.test(d)) return false;
  return true;
}

/** O endereço que abre a conversa com o texto por enviar. */
export function linkDeWhatsApp(
  telefone: string | null | undefined,
  texto: string,
): string | null {
  const numero = numeroParaWhatsApp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
