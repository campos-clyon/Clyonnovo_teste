/**
 * O CLIENTE QUE ESTÁ A PERDER A PACIÊNCIA — passa-se a uma pessoa, já.
 *
 * *«Nós temos muito entulho que precisa de sair hoje urgentemente. Tentei
 * ligar várias vezes, se estiverem ocupados vou ter de avançar com outra
 * empresa.»* — o Afonso, a 29-09-2026.
 *
 * A resposta do assistente foi «Bom dia. Aqui é a CLYON. Com quem estou a
 * falar?» — duas vezes. Para quem acabou de dizer que tentou ligar e ninguém
 * atendeu, um robô a pedir o nome é a confirmação de que ninguém está lá.
 * Foi ele que teve de escrever «Preciso de falar com assistente».
 *
 * Um formulário não é a resposta certa a isto. Uma pessoa é — e o mais
 * depressa possível, porque a frase seguinte deste cliente é à concorrência.
 *
 * O QUE CONTA como sinal: dizer que tentou contactar e não conseguiu, ou que
 * vai a outra empresa. São frases de quem já está a sair, não de quem está a
 * perguntar. «Urgente» sozinho NÃO conta — muita gente escreve «urgente» num
 * pedido normal, e o assistente sabe tratar de um pedido urgente.
 *
 * PURO E SEM ADIVINHAÇÃO: palavras que uma pessoa lê e concorda. Um modelo a
 * decidir quem está zangado passava conversas normais a pessoas, e ensinava a
 * equipa a ignorar a etiqueta.
 */

const SINAIS: RegExp[] = [
  // Tentou contactar e não conseguiu.
  /\btentei\s+(?:vos\s+|lhes?\s+)?(?:ligar|contactar|telefonar|falar)/,
  /\bj[aá]\s+(?:vos\s+|lhes?\s+)?liguei\b/,
  /\bliguei\s+(?:v[aá]rias|muitas|imensas|diversas)\s+vezes/,
  /\bningu[eé]m\s+(?:me\s+)?(?:atende|responde|diz\s+nada)/,
  /\bn[aã]o\s+(?:me\s+)?(?:atendem|respondem)\b/,
  /\bsem\s+resposta\s+(?:h[aá]|desde)/,
  // Vai à concorrência.
  /\boutra\s+empresa\b/,
  /\b(?:vou|vamos)\s+(?:ter\s+de\s+|ter\s+que\s+)?(?:avan[cç]ar|ir|seguir)\s+com\s+outr[ao]s?\b/,
  /\b(?:vou|vamos)\s+(?:procurar|contratar|chamar)\s+outr[ao]s?\b/,
];

/** Sem acentos, minúsculas e espaços simples — é assim que as regras lêem. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function estaAPerderAPaciencia(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const t = normalizar(texto);
  // Os padrões estão escritos com acentos opcionais; o texto já não os tem.
  return SINAIS.some((r) => r.test(t) || r.test(texto.toLowerCase()));
}

/** O que lhe dizemos — curto, sem formulário, e com a promessa que se cumpre. */
export const RESPOSTA_A_QUEM_ESPEROU =
  "Peço desculpa pela espera. Vou passar a sua mensagem já a uma pessoa da CLYON, " +
  "que lhe responde por aqui o mais depressa possível.";

/** A etiqueta que a equipa vê no painel — tem de dizer PORQUÊ é urgente. */
export const MOTIVO_NO_PAINEL = "Cliente a perder a paciência — responder já";
