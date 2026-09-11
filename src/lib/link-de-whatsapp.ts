/**
 * O LINK QUE ABRE O WHATSAPP NA CONVERSA CERTA, COM O TEXTO JÁ ESCRITO.
 *
 * Parece uma linha e não é. Os telefones nesta base estão gravados como o
 * cliente os escreveu: «966190556», «966 190 556», «+351 966190556»,
 * «00351966190556». O `wa.me` exige o número internacional sem sinais — e se
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

  // Nove dígitos: é português, e falta-lhe o indicativo.
  if (d.length === 9) return INDICATIVO + d;

  /*
   * Qualquer outra coisa fica de fora. Um número com 11 ou 15 dígitos pode ser
   * estrangeiro, pode ser um engano de escrita, pode ser uma extensão colada ao
   * fim — e nenhuma dessas hipóteses se resolve a adivinhar.
   */
  return null;
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
