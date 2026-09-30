/**
 * O TELEFONE DE UM CLIENTE — português ou de fora.
 *
 * Os formulários públicos aceitavam qualquer texto neste campo: «abc», «123»,
 * um email colado no sítio errado. O pedido entrava à mesma, e para quem não
 * deixou email o telefone é o único caminho até ele — um número que não existe
 * é um cliente à espera de propostas que nunca lhe vão chegar.
 *
 * `telefoneValido` (inscricao-profissional.ts) não serve aqui: é dos
 * profissionais e só aceita números portugueses. Clientes de fora existem —
 * gente de passagem, estrangeiros a viver cá com o número de casa — e
 * recusá-los era perder o pedido.
 *
 * A REGRA
 *   · português: 9 dígitos a começar por 9, 2 ou 3, com ou sem +351/00351;
 *   · de fora: + ou 00, e 8 a 15 dígitos (o máximo do E.164);
 *   · espaços, pontos, hífenes e parênteses não contam.
 *
 * Um número com 351 à frente é português e tem de o parecer: «+351 12345» não
 * passa por estrangeiro só por ter o sinal de mais.
 *
 * SÓ PARA OS FORMULÁRIOS PÚBLICOS. O backoffice e a ponte do WhatsApp gravam
 * por outras rotas, com números que alguém já confirmou ao falar com a pessoa.
 */

const SEPARADORES = /[\s().-]/g;

/** A coluna `contactPhone` tem 30 caracteres: o que passar disso nem cabe. */
const MAXIMO_DE_CARACTERES = 30;

export const MENSAGENS_DO_TELEFONE = {
  falta: "Indique o telefone.",
  comprido: "O número é comprido demais.",
  caracteres: "Use só algarismos, espaços e o sinal +.",
  portugues: "Um número português tem 9 dígitos e começa por 9, 2 ou 3.",
  semIndicativo:
    "Um número português tem 9 dígitos e começa por 9, 2 ou 3. Se for de outro país, comece pelo indicativo (ex.: +44).",
  estrangeiro:
    "Um número de outro país leva o indicativo e 8 a 15 dígitos (ex.: +44 20 7946 0958).",
} as const;

/**
 * O que está errado no número, dito ao cliente — ou `null` se estiver certo.
 *
 * Devolve a frase e não um booleano porque a mesma frase serve o campo do
 * formulário e o 400 da rota: dizer só «inválido» deixava a pessoa a adivinhar
 * o que corrigir.
 *
 * Aceita `unknown` porque nas rotas o valor vem de um corpo JSON por validar:
 * um número em vez de texto não pode rebentar a rota com um 500.
 */
export function problemaDoTelefone(telefone: unknown): string | null {
  const escrito =
    typeof telefone === "string" ? telefone.trim() : typeof telefone === "number" ? String(telefone) : "";
  if (!escrito) return MENSAGENS_DO_TELEFONE.falta;
  if (escrito.length > MAXIMO_DE_CARACTERES) return MENSAGENS_DO_TELEFONE.comprido;

  const limpo = escrito.replace(SEPARADORES, "");
  if (!/^(\+|00)?\d+$/.test(limpo)) return MENSAGENS_DO_TELEFONE.caracteres;

  const comIndicativo = /^(\+|00)/.test(limpo);
  const digitos = limpo.replace(/^(\+|00)/, "");

  if (comIndicativo) {
    if (digitos.startsWith("351")) {
      return /^[239]\d{8}$/.test(digitos.slice(3)) ? null : MENSAGENS_DO_TELEFONE.portugues;
    }
    return /^\d{8,15}$/.test(digitos) ? null : MENSAGENS_DO_TELEFONE.estrangeiro;
  }

  // Sem sinal nenhum à frente: é português. «351912345678» também — é o mesmo
  // número com o indicativo colado, e o `wa.me` lê-o assim.
  const nacional = digitos.length === 12 && digitos.startsWith("351") ? digitos.slice(3) : digitos;
  return /^[239]\d{8}$/.test(nacional) ? null : MENSAGENS_DO_TELEFONE.semIndicativo;
}

export function telefoneDoClienteValido(telefone: unknown): boolean {
  return problemaDoTelefone(telefone) === null;
}

/**
 * O número inteiro, a partir do indicativo e do telefone em campos separados.
 *
 * O formulário da página inicial pede-os à parte. Quem escreve o número já
 * com o indicativo no segundo campo não o fica com ele duplicado
 * («+351+351 912…»), e um indicativo escrito sem o sinal de mais («44») ganha-o
 * — sem isso, «44» + «7911 123456» lia-se como um número português errado.
 */
export function juntarIndicativo(
  indicativo: string | null | undefined,
  telefone: string | null | undefined,
): string {
  const numero = (telefone ?? "").trim();
  if (/^(\+|00)/.test(numero)) return numero;
  let prefixo = (indicativo ?? "").replace(SEPARADORES, "");
  if (/^\d/.test(prefixo) && !prefixo.startsWith("00")) prefixo = `+${prefixo}`;
  return `${prefixo}${numero}`;
}
