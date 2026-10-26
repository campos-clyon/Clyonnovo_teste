/**
 * O TELEMÓVEL COMO SE LÊ EM VOZ ALTA.
 *
 * *«Passe a colocar o número à frente dos nomes, para a fácil identificação do
 * pedido.»* — 21-09-2026.
 *
 * Na base, os números estão como o cliente os escreveu: «960000556»,
 * «960 000 556», «+351 960000556», «00351960000556». Um bloco de nove dígitos
 * colados não se compara de relance com a conversa que está aberta no
 * telemóvel ao lado — e é exactamente isso que quem gere está a fazer:
 * a olhar para o WhatsApp e a procurar de que pedido se trata.
 *
 * Três grupos de três é a forma como um número português se lê e se dita.
 *
 * ⚠️ O QUE NÃO SE PERCEBE MOSTRA-SE COMO VEIO. Um número estrangeiro (que só
 * ganha o «+» se o tiver perdido), uma extensão colada ao fim, um engano de
 * escrita — nada disso se arruma a adivinhar. Vale mais um número com ar
 * estranho, que se vê que está estranho, do que um número arrumado que já não
 * é o do cliente.
 */

import { numeroParaWhatsApp } from "./link-de-whatsapp";

const INDICATIVO = "+351 ";

/**
 * `960 000 556`, ou `+351 960 000 556` quando o indicativo importa.
 *
 * Devolve string vazia quando não há número — quem chama decide se mostra
 * alguma coisa no lugar.
 */
export function telefoneLegivel(
  telefone: string | null | undefined,
  opcoes: { comIndicativo?: boolean } = {},
): string {
  const bruto = (telefone ?? "").trim();
  if (!bruto) return "";

  /*
   * A mesma normalização do `wa.me`, de propósito: o número que aparece no
   * ecrã é o número para onde a mensagem vai. Duas regras diferentes para a
   * mesma coisa é como se mostra um e se manda para outro.
   */
  const inteiro = numeroParaWhatsApp(bruto);
  if (!inteiro) return bruto;
  if (!inteiro.startsWith("351")) {
    // De outro país (desde 21-10-2026 o `wa.me` aceita-o): com «+» ou «00»,
    // fica como foi escrito.
    if (/^[\s(]*(\+|00)/.test(bruto)) return bruto;
    /*
     * Sem o sinal (a ponte grava-os assim, 26-10-2026): ganha o «+», para quem
     * gere ver que é de fora e não um português mal escrito. Os algarismos são
     * os do `wa.me`; os espaços de quem o escreveu ficam, se os houver.
     */
    return /^\d[\d\s.-]*$/.test(bruto) ? `+${bruto}` : `+${inteiro}`;
  }

  const nove = inteiro.slice(3);
  const agrupado = `${nove.slice(0, 3)} ${nove.slice(3, 6)} ${nove.slice(6)}`;
  return opcoes.comIndicativo ? INDICATIVO + agrupado : agrupado;
}
