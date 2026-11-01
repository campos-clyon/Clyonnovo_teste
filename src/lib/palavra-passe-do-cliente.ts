/**
 * A CONTA DE CLIENTE COM EMAIL E PALAVRA-PASSE — 01-11-2026 (ordem do CEO,
 * aprovada pelo dono: «Tem que ter nos aplicativos a opção de entrar com
 * e-mail e senha também»).
 *
 * Ao lado do Google e do link por email, que continuam. Este ficheiro é o que
 * o browser e a app também precisam de saber — prazos, frases, códigos — e não
 * importa nada do servidor. O que toca na base está em
 * `conta-com-palavra-passe.ts`.
 *
 * A REGRA QUE NÃO SE PARTE: os pedidos juntam-se à conta pelo email. Uma conta
 * com palavra-passe que abrisse sessão antes de o email estar confirmado era
 * uma porta para os pedidos de outra pessoa (bastava registar o email dela).
 * Por isso a palavra-passe escolhida no registo fica À ESPERA, junto do link de
 * confirmação, e só passa para a conta quando o link é aberto — e o link só
 * chega à caixa de correio do dono do email.
 */

export { MINIMO_DA_PALAVRA_PASSE } from "./palavra-passe-minima";

/** O link de confirmação do registo (e o de definir, que sai do registo). */
export const HORAS_DA_CONFIRMACAO = 24;
/** O link de «Esqueci-me da palavra-passe». */
export const HORAS_DO_REPOR = 1;

/** Os links que a conta de cliente manda por email. */
export type TipoDoLink =
  /** Registo novo: confirma o email e passa a palavra-passe escolhida para a conta. */
  | "registo"
  /** O email já tinha conta (Google, link ou pedido) sem palavra-passe: escolher uma. */
  | "definir"
  /** Esqueceu-se, ou registou-se de novo com uma conta que já tem palavra-passe. */
  | "repor";

export const TIPOS_DO_LINK: readonly TipoDoLink[] = ["registo", "definir", "repor"];

/** As respostas que são sempre as mesmas, exista ou não a conta. */
export const FRASE_DO_REGISTO = `Se o email estiver certo, recebe dentro de instantes um link para terminar o registo. Serve uma vez e dura ${HORAS_DA_CONFIRMACAO} horas.`;
export const FRASE_DO_ESQUECI = `Se este email tiver conta na CLYON, recebe dentro de instantes um link para escolher uma palavra-passe nova. Serve uma vez e dura ${HORAS_DO_REPOR} hora.`;

/** O erro de entrada, sempre o mesmo: não diz se o email tem conta. */
export const ERRO_DE_ENTRADA = "Email ou palavra-passe errados.";
export const ERRO_POR_CONFIRMAR =
  "Ainda não confirmou o seu email. Enviámos-lhe outra vez o link de confirmação: abra-o e entre a seguir.";
export const ERRO_MUITAS_TENTATIVAS = "Muitas tentativas seguidas. Espere alguns minutos e tente outra vez.";

/** Os códigos que a app e o site lêem em `codigo`. */
export type CodigoDeErroDaEntrada =
  | "errado"
  | "por-confirmar"
  | "muitas-tentativas"
  | "invalido"
  | "indisponivel";

export type MotivoDoLink = "malformado" | "desconhecido" | "expirado" | "usado" | "sem-conta";

export const MENSAGEM_DO_LINK: Record<MotivoDoLink, string> = {
  malformado: "Este link não é válido. Peça outro na página de entrada.",
  desconhecido: "Este link não é válido. Peça outro na página de entrada.",
  expirado: "Este link expirou. Peça outro na página de entrada.",
  usado: "Este link já foi usado. Se já confirmou, entre com o email e a palavra-passe.",
  "sem-conta": "Esta conta já não existe. Pode criar outra na página de entrada.",
};

/** 43 caracteres de base64url (32 bytes), como o link de entrada. */
export function pareceUmTokenDaConta(valor: unknown): valor is string {
  return typeof valor === "string" && /^[A-Za-z0-9_-]{43}$/.test(valor);
}

/** O nome do registo: aparado, sem espaços a mais, entre 2 e 120 caracteres. */
export function nomeDoRegisto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const n = valor.replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 120) return null;
  return n;
}
