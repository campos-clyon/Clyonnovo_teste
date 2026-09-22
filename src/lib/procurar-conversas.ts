/**
 * Encontrar uma conversa do WhatsApp na mesa, pelo número.
 *
 * "Deve ter barra de pesquisa aqui para encontrar os trabalhos pelo número de
 * telefone" — 22-09-2026.
 *
 * A MESA TEM CENTO E SETE CONVERSAS e quatro separadores. Quem chega aqui com
 * um número na mão — o cliente ao telefone, o profissional a perguntar por um
 * trabalho — não sabe em qual deles ele está: com o assistente, entregue a
 * alguém, arquivado ou bloqueado. É justamente a pergunta que a procura vem
 * responder.
 *
 * POR ISSO A PROCURA ATRAVESSA OS SEPARADORES. Uma procura presa ao separador
 * aberto obrigava a repeti-la quatro vezes, e a quarta é a que ninguém faz —
 * ficava-se a pensar que o número não existia quando ele estava na lista do
 * lado. Sem termo escrito, manda o separador, como sempre mandou.
 *
 * Tudo aqui é puro e sem imports: a regra prova-se sem montar o painel.
 */

/** Os acentos decompostos, para os arrancar depois do NFD. */
const ACENTOS_COMBINANTES = new RegExp("[\u0300-\u036f]", "g");

/** Quantos dígitos chegam para procurar. Menos do que isto não separa nada. */
export const DIGITOS_MINIMOS = 3;

/** Quantas letras chegam para procurar por texto. */
export const LETRAS_MINIMAS = 2;

export function soDigitos(texto: string): string {
  return texto.replace(/[^0-9]/g, "");
}

/** Sem acentos e em minúsculas — «Estefânia» e «estefania» são a mesma pessoa. */
export function semEnfeites(texto: string): string {
  return texto.normalize("NFD").replace(ACENTOS_COMBINANTES, "").toLowerCase();
}

/**
 * O número bate com o que foi escrito?
 *
 * Compara-se pelos ÚLTIMOS NOVE DÍGITOS, como todo o WhatsApp desta casa: na
 * base o mesmo telemóvel aparece com indicativo e sem ele, e um `includes` na
 * cadeia inteira fazia o «351» de toda a gente bater com tudo.
 *
 * É `includes` e não `startsWith` de propósito: quem lê um número em voz alta
 * pelo telefone começa muitas vezes a meio («…100 966»).
 */
export function numeroBate(telefone: string, termo: string): boolean {
  const procurado = soDigitos(termo);
  if (procurado.length < DIGITOS_MINIMOS) return false;
  return soDigitos(telefone).slice(-9).includes(procurado.slice(-9));
}

/** O que está escrito na linha bate? A última mensagem e a nota. */
export function textoBate(
  linha: { ultimaMensagem?: string | null; nota?: string | null },
  termo: string,
): boolean {
  const procurado = semEnfeites(termo.trim());
  if (procurado.length < LETRAS_MINIMAS) return false;
  const onde = semEnfeites(`${linha.ultimaMensagem ?? ""} ${linha.nota ?? ""}`);
  return onde.includes(procurado);
}

/**
 * A lista que se mostra.
 *
 * `estado` é o separador aberto. Com o termo vazio é ele que manda; com termo
 * escrito, o separador deixa de contar e procura-se em tudo.
 */
export function conversasVisiveis<
  T extends { telefone: string; estado: string; ultimaMensagem?: string | null; nota?: string | null },
>(linhas: T[], separador: string, termo: string): T[] {
  const limpo = termo.trim();
  if (limpo === "") return linhas.filter((l) => l.estado === separador);
  return linhas.filter((l) => numeroBate(l.telefone, limpo) || textoBate(l, limpo));
}

/** A procura está mesmo a procurar? Um «9» sozinho não é uma procura. */
export function procuraActiva(termo: string): boolean {
  const limpo = termo.trim();
  if (limpo === "") return false;
  return soDigitos(limpo).length >= DIGITOS_MINIMOS || limpo.length >= LETRAS_MINIMAS;
}
