/**
 * OS ERROS DA API E AS FRASES QUE A APP ESCREVE QUANDO O SITE NEM RESPONDEU.
 *
 * Puro de propósito (sem Expo nem React Native): os testes do site importam-no,
 * e as regras da entrada (`entrada.ts`) também.
 *
 * Os textos de erro vêm da API tal como chegam (`error`); estes são só para
 * quando não há resposta nenhuma.
 */

export const SEM_REDE = "Sem ligação à internet. Tente outra vez.";
export const REDE_LENTA = "A rede está lenta e o site não respondeu a tempo. Tente outra vez daqui a pouco.";
export const MUITAS_TENTATIVAS = "Muitas tentativas seguidas. Espere um minuto e tente outra vez.";
export const SESSAO_TERMINOU = "A sua sessão terminou. Entre outra vez.";
export const SITE_EM_BAIXO = "O site não respondeu como devia. Tente outra vez daqui a pouco.";
export const NAO_FOI_POSSIVEL = "Não foi possível fazer isto agora.";

export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly estado: number,
    readonly corpo: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** A frase de um erro qualquer: a da API, ou a que se dá. */
export function mensagemDe(e: unknown, porOmissao: string = NAO_FOI_POSSIVEL): string {
  return e instanceof ErroDaApi && e.message ? e.message : porOmissao;
}

/** O `motivo` que as rotas da entrada mandam com cada recusa (R1, R1a). */
export function motivoDe(e: unknown): string | null {
  if (!(e instanceof ErroDaApi)) return null;
  const m = e.corpo.motivo;
  return typeof m === "string" && m ? m : null;
}

/** A frase de uma resposta que não correu bem, como a app a mostra. */
export function mensagemDaResposta(estado: number, corpo: Record<string, unknown>): string {
  if (typeof corpo.error === "string" && corpo.error) return corpo.error;
  if (estado === 429) return MUITAS_TENTATIVAS;
  if (estado >= 500) return SITE_EM_BAIXO;
  return NAO_FOI_POSSIVEL;
}

/**
 * A FORMA COMO A APP FALA COM O SITE — a mesma assinatura do `pedir` de
 * `api.ts`. As regras puras recebem-na de fora: no telemóvel é o `pedir` a
 * sério; nos testes, um site de mentira que cumpre os contratos.
 */
export type OpcoesDoPedido = {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  corpo?: unknown;
  semSessao?: boolean;
  /** Cabeçalhos a mais (o código do aparelho do convidado, `x-codigo-do-aparelho`). */
  cabecalhos?: Record<string, string>;
};
export type Pedir = <T>(caminho: string, opcoes?: OpcoesDoPedido) => Promise<T>;
