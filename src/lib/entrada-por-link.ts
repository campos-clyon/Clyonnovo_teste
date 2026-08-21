/**
 * Entrar com um link enviado por email.
 *
 * PORQUE EXISTE
 *
 * O único login era o Google. Dos 79 clientes que pediram orçamento e nunca
 * criaram conta, 26 usaram hotmail, sapo, live, yahoo, e emails de trabalho —
 * não têm conta Google no endereço que nos deram, e para eles não havia botão
 * nenhum que servisse. Não era falta de vontade: era falta de porta.
 *
 * Isto abre-lhes uma, sem inventar palavras-passe. A pessoa escreve o email,
 * recebe um link, e ao abri-lo fica com sessão iniciada.
 *
 * ONDE ESTÁ O RESTO
 *
 * Gerar um token e calculá-lo em hash precisa de `node:crypto`, e este
 * ficheiro é lido também pelo browser — a página que abre o link usa daqui as
 * mensagens e o formato. Um `import` de `node:crypto` num ficheiro que chega
 * ao browser parte a compilação inteira, e arrastar criptografia de servidor
 * para dentro do pacote do cliente é mau mesmo quando compila.
 *
 * Por isso ficou dividido pelo que faz sentido: aqui as REGRAS, que os dois
 * lados precisam de conhecer; em `entrada-por-link-segredo.ts` o que só o
 * servidor pode fazer.
 *
 * PORQUE É QUE ISTO É SEGURO
 *
 * Um link que inicia sessão É uma credencial, e mais perigoso do que o link de
 * um pedido: aquele abre um pedido, este abre a conta inteira. As regras são
 * por isso mais apertadas:
 *
 *   · 256 bits de aleatoriedade — não se adivinha nem se enumera;
 *   · na base fica só o hash. Quem leia a tabela — ou uma cópia de segurança
 *     que se perca — não consegue entrar na conta de ninguém;
 *   · QUINZE MINUTOS. O link do pedido dura trinta dias porque acompanha a
 *     vida de um trabalho. Este serve para atravessar uma porta, e um link de
 *     sessão esquecido numa caixa de correio é uma chave da casa deixada no
 *     capacho;
 *   · USA-SE UMA VEZ. Um email reencaminhado, um histórico de browser
 *     partilhado, um telemóvel emprestado — em qualquer desses casos o
 *     segundo a usá-lo não entra;
 *   · pedir um link novo mata os anteriores. Quem pede outro é porque o
 *     primeiro não serviu, e deixá-lo a valer é deixar duas chaves em
 *     circulação.
 *
 * E não diz se o email existe. Uma resposta diferente para "não conhecemos
 * este email" transforma o formulário numa lista de quem é cliente da CLYON —
 * qualquer pessoa podia testar endereços um a um e ficar a saber. A resposta é
 * sempre a mesma; o que muda é só se o email chega ou não.
 */

/** 32 bytes = 256 bits, como no link do pedido. */
const BYTES_DE_ENTROPIA = 32;

/**
 * Quinze minutos.
 *
 * Chega para ir à caixa de correio e voltar, e não chega para o link
 * sobreviver esquecido. Se expirar, pede-se outro — custa um toque.
 */
export const MINUTOS_DE_VALIDADE = 15;

export type MotivoDeRecusa = "ausente" | "malformado" | "desconhecido" | "expirado" | "usado";

/** O que está gravado sobre uma ligação, tal como vem da base. */
export type LigacaoGravada = {
  email: string;
  expiraEm: Date | string | null;
  usadoEm: Date | string | null;
} | null | undefined;

/**
 * Um token tem de parecer um token antes de se ir à base com ele.
 *
 * 43 caracteres de base64url, e mais nada. Sem isto, qualquer coisa escrita no
 * endereço chegava à consulta — e uma consulta por linha é uma consulta que
 * alguém pode disparar aos milhares.
 */
export function pareceUmToken(valor: unknown): valor is string {
  return typeof valor === "string" && /^[A-Za-z0-9_-]{43}$/.test(valor);
}

function comoData(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Porque é que esta ligação não abre — ou `null` se abre.
 *
 * Devolve o motivo em vez de um booleano porque o ecrã precisa de dizer o que
 * fazer a seguir: "expirou, peça outro" e "este link já foi usado" levam a
 * pessoa a sítios diferentes. Nenhum dos dois revela se o email existe: só
 * quem tem o token nas mãos chega até aqui.
 */
export function porqueRecusa(
  token: unknown,
  gravada: LigacaoGravada,
  agora: Date = new Date(),
): MotivoDeRecusa | null {
  if (token == null || token === "") return "ausente";
  if (!pareceUmToken(token)) return "malformado";
  if (!gravada) return "desconhecido";
  if (comoData(gravada.usadoEm)) return "usado";

  const expira = comoData(gravada.expiraEm);
  // Sem data de expiração não se assume que é eterno: assume-se o pior.
  if (!expira || expira.getTime() <= agora.getTime()) return "expirado";

  return null;
}

export const MENSAGEM: Record<MotivoDeRecusa, string> = {
  ausente: "Falta o link. Peça um novo email de entrada.",
  malformado: "Este link não é válido. Peça um novo email de entrada.",
  desconhecido: "Este link não é válido. Peça um novo email de entrada.",
  expirado: `O link expirou — dura ${MINUTOS_DE_VALIDADE} minutos. Peça um novo.`,
  usado: "Este link já foi usado. Por segurança, cada link só serve uma vez.",
};
