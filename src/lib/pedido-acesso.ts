import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * O link que dá acesso a um pedido.
 *
 * O cliente cria o pedido e recebe um link por email e por mensagem. Esse link
 * abre o pedido sem conta e sem palavra-passe — obrigar alguém a registar-se
 * antes de ver o próprio pedido é onde se perdem clientes.
 *
 * Só que um link que abre dados pessoais e uma negociação **é uma credencial**,
 * e trata-se como tal:
 *
 *   · o token tem 256 bits de aleatoriedade — não se adivinha nem se enumera;
 *   · na base fica só o *hash*. Quem leia a tabela não consegue abrir pedido
 *     nenhum, e uma cópia de segurança que se perca não entrega contas;
 *   · tem validade. Um link eterno num email reencaminhado é um pedido aberto
 *     para sempre a quem quer que apanhe a caixa de correio;
 *   · vale para **um** pedido, nunca para a conta inteira.
 *
 * Quando o cliente criar conta com o mesmo email, o pedido cola-se à conta e o
 * link deixa de ser necessário.
 *
 * Não leva assinatura JWT de propósito. Um JWT aqui obrigava a partilhar o
 * `JWT_SECRET` com um token que anda em emails, e já tivemos um problema
 * exactamente assim — um token de parceiro assinado com o mesmo segredo do
 * colaborador passava por colaborador. Um valor aleatório comparado com o
 * hash guardado não tem esse risco: não há nada para forjar.
 */

/** 32 bytes = 256 bits. Em base64url dá 43 caracteres. */
const BYTES_DE_ENTROPIA = 32;

/** Trinta dias cobre a vida útil de um pedido com folga. */
export const DIAS_DE_VALIDADE = 30;

export type TokenDeAcesso = {
  /** Vai no link. Nunca é guardado. */
  token: string;
  /** É isto que se grava na coluna acessoTokenHash. */
  hash: string;
  expiraEm: Date;
};

/** Hash de um token. SHA-256 chega: o token já tem 256 bits de aleatoriedade.
 *
 * O que torna uma palavra-passe fraca é ser curta e escolhida por uma pessoa,
 * e é por isso que essas levam bcrypt com fator de custo. Aqui não há nada para
 * adivinhar — passar isto por bcrypt só tornava cada abertura de link mais
 * lenta sem tirar nada a ninguém.
 */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function gerarTokenDeAcesso(agora: Date = new Date()): TokenDeAcesso {
  const token = randomBytes(BYTES_DE_ENTROPIA).toString("base64url");
  const expiraEm = new Date(agora.getTime() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000);
  /*
   * SEM MILISSEGUNDOS — ou a data nunca sobrevive à ida e volta à base.
   *
   * "Ele gera o link mas não disponibiliza aqui para copiar e enviar."
   *
   * Esta validade serve de MARCA DE VERSÃO do link: o backoffice guarda a que
   * gerou e compara-a com a que a base devolve, para saber se alguém rodou o
   * token entretanto. A comparação é de texto — datas diferentes, tokens
   * diferentes.
   *
   * Só que a coluna `acessoTokenExpiraEm` é DATETIME, sem casas decimais. O
   * que se escreve com milissegundos volta sem eles, e o MySQL ainda arredonda
   * para o segundo seguinte quando a fracção passa de meio. Medido contra a
   * base de produção:
   *
   *   escrito   2026-09-28T13:26:38.829Z
   *   lido      2026-09-28T13:26:39.000Z
   *
   * Duas datas do mesmo instante, dois textos diferentes. O ecrã concluía que
   * o link tinha morrido e escondia a caixa de copiar — sempre, a cada
   * tentativa, e recarregar a lista não ajudava nada.
   *
   * Zerar aqui arruma todos os caminhos de uma vez: a distribuição, a criação
   * pelo backoffice, o pedido do simulador e o reenvio partilham esta função.
   */
  expiraEm.setMilliseconds(0);
  return { token, hash: hashDeToken(token), expiraEm };
}

export type MotivoDeRecusa = "ausente" | "malformado" | "nao_corresponde" | "expirado";

export type ResultadoDeAcesso =
  | { valido: true }
  | { valido: false; motivo: MotivoDeRecusa };

/**
 * Compara o token do link com o hash guardado.
 *
 * A comparação é feita em tempo constante. Um `===` sobre hashes revela, pelo
 * tempo que demora a falhar, quantos caracteres iniciais estavam certos — e
 * com isso constrói-se o valor certo byte a byte.
 */
export function verificarTokenDeAcesso(
  tokenRecebido: unknown,
  hashGuardado: string | null | undefined,
  expiraEm: Date | string | null | undefined,
  agora: Date = new Date(),
): ResultadoDeAcesso {
  if (typeof tokenRecebido !== "string" || tokenRecebido.length === 0) {
    return { valido: false, motivo: "ausente" };
  }
  if (!hashGuardado) {
    return { valido: false, motivo: "nao_corresponde" };
  }

  // Um token de tamanho absurdo não chega a ser comparado: não vale a pena
  // passar por SHA-256 aquilo que já se sabe que não é um dos nossos.
  if (tokenRecebido.length > 200 || !/^[A-Za-z0-9_-]+$/.test(tokenRecebido)) {
    return { valido: false, motivo: "malformado" };
  }

  const recebido = Buffer.from(hashDeToken(tokenRecebido), "hex");
  let guardado: Buffer;
  try {
    guardado = Buffer.from(hashGuardado, "hex");
  } catch {
    return { valido: false, motivo: "nao_corresponde" };
  }

  // timingSafeEqual rebenta com tamanhos diferentes, e o tamanho de um hash
  // guardado corrompido não é segredo nenhum — verifica-se antes.
  if (recebido.length !== guardado.length || !timingSafeEqual(recebido, guardado)) {
    return { valido: false, motivo: "nao_corresponde" };
  }

  // A validade só se verifica depois de o token conferir. Ao contrário, uma
  // resposta "expirado" dizia a quem tentasse à sorte que tinha acertado no
  // token — e isso é meio caminho andado.
  const limite = expiraEm instanceof Date ? expiraEm : expiraEm ? new Date(expiraEm) : null;
  if (!limite || Number.isNaN(limite.getTime()) || limite.getTime() <= agora.getTime()) {
    return { valido: false, motivo: "expirado" };
  }

  return { valido: true };
}

/** O endereço que vai no email e na mensagem. */
export function linkDoPedido(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/pedido/${token}`;
}
