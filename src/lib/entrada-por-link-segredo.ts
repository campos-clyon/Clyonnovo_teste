import { randomBytes, createHash } from "node:crypto";
import { MINUTOS_DE_VALIDADE } from "./entrada-por-link";

/**
 * A parte da entrada por link que só o servidor pode fazer.
 *
 * Está separada das regras porque `node:crypto` não existe no browser, e a
 * página que abre o link é um componente de cliente — precisa das mensagens e
 * do formato do token, não da criptografia. Um ficheiro só arrastava isto
 * tudo para dentro do pacote que o browser descarrega.
 *
 * Ver `entrada-por-link.ts` para as regras e para a razão de cada uma.
 */

/** 32 bytes = 256 bits, como no link do pedido. */
const BYTES_DE_ENTROPIA = 32;

export type LigacaoDeEntrada = {
  /** Vai no link. Nunca é guardado em lado nenhum. */
  token: string;
  /** É isto que fica na base. */
  hash: string;
  expiraEm: Date;
};

/**
 * SHA-256 chega: o token já tem 256 bits de aleatoriedade.
 *
 * O que torna uma palavra-passe fraca é ser curta e escolhida por uma pessoa —
 * é para isso que existe o bcrypt. Aqui não há nada para adivinhar.
 */
export function hashDaLigacao(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function gerarLigacaoDeEntrada(agora: Date = new Date()): LigacaoDeEntrada {
  const token = randomBytes(BYTES_DE_ENTROPIA).toString("base64url");
  const expiraEm = new Date(agora.getTime() + MINUTOS_DE_VALIDADE * 60 * 1000);
  return { token, hash: hashDaLigacao(token), expiraEm };
}
