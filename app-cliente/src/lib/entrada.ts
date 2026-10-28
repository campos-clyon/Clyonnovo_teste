import { ErroDaApi, mensagemDe, motivoDe, SEM_REDE, type Pedir } from "./erros";

/**
 * A ENTRADA PELO LINK, PRESA A ESTE TELEMÓVEL — versão 2 (28-10-2026).
 *
 * 1. Ao tocar em «Enviar link de entrada», a app tem um CÓDIGO DO APARELHO:
 *    32 bytes aleatórios em base64url (43 caracteres), guardado no cofre do
 *    telemóvel. Ao site vai só a PROVA — o SHA-256 do código, em hexadecimal —
 *    com o pedido do link (`POST /api/entrada/link` com `app: "cliente"`).
 * 2. O link do email abre o E1a, que pergunta ao site de quem é a conta (R1a,
 *    `POST /api/cliente/entrar/verificar`) com o código. Não gasta o link.
 * 3. Só um toque em «Entrar» (ou «Trocar de conta») chama a R1
 *    (`POST /api/cliente/entrar`) com o link e o código. O site confirma que o
 *    SHA-256 do código é a prova guardada com aquele link, e só então o gasta.
 *
 * Um link aberto noutro telemóvel (outra instalação, outro código) não entra:
 * o site responde `outroAparelho` e o link continua a servir no telemóvel certo.
 *
 * Puro de propósito: o cofre, os bytes aleatórios e o SHA-256 chegam de fora
 * (`codigo-do-aparelho.ts` no telemóvel; o `node:crypto` nos testes do site).
 */

export const ROTA_DO_LINK = "/api/entrada/link";
export const ROTA_DE_VERIFICAR = "/api/cliente/entrar/verificar";
export const ROTA_DE_ENTRAR = "/api/cliente/entrar";

export const BYTES_DO_CODIGO = 32;
export const FORMA_DO_CODIGO = /^[A-Za-z0-9_-]{43}$/;
export const FORMA_DA_PROVA = /^[0-9a-f]{64}$/;

/** «Não sou eu»: não entra, e o código deste telemóvel deita-se fora. */
export const NAO_ENTROU =
  "Não entrou. Este link só serve no telemóvel onde foi pedido. Se não o pediu, pode ignorá-lo.";

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Bytes em base64url, sem «=» — 32 bytes dão 43 caracteres. */
export function emBase64Url(bytes: Uint8Array): string {
  let saida = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    saida += LETRAS[(n >> 18) & 63] + LETRAS[(n >> 12) & 63];
    if (i + 1 < bytes.length) saida += LETRAS[(n >> 6) & 63];
    if (i + 2 < bytes.length) saida += LETRAS[n & 63];
  }
  return saida;
}

/** Um código novo, a partir de bytes aleatórios que chegam de fora. */
export function codigoNovo(bytesAleatorios: (n: number) => Uint8Array): string {
  const codigo = emBase64Url(bytesAleatorios(BYTES_DO_CODIGO));
  if (!FORMA_DO_CODIGO.test(codigo)) throw new Error("Código do aparelho mal formado.");
  return codigo;
}

/**
 * O email como aparece nos ecrãs de entrada: a primeira letra, «•••», a @ e
 * o domínio inteiro («j•••@gmail.com»). A mesma regra da `mascararEmail` do
 * site (S1) — o site manda o `emailMascarado` do link; esta só mascara o email
 * da sessão que já está aberta neste telemóvel.
 */
export function mascararEmail(email: string): string {
  const limpo = (email ?? "").trim();
  const arroba = limpo.lastIndexOf("@");
  if (arroba < 1) return "•••";
  return `${[...limpo.slice(0, arroba)][0]}•••@${limpo.slice(arroba + 1)}`;
}

/* ─── 1. Pedir o link ─────────────────────────────────────────────────────── */

/** O corpo do pedido do link, com a prova deste telemóvel. */
export async function pedirLinkDeEntrada(p: {
  pedir: Pedir;
  email: string;
  codigo: string;
  sha256Hex: (texto: string) => Promise<string>;
}): Promise<void> {
  if (!FORMA_DO_CODIGO.test(p.codigo)) throw new Error("Código do aparelho mal formado.");
  const prova = (await p.sha256Hex(p.codigo)).toLowerCase();
  if (!FORMA_DA_PROVA.test(prova)) throw new Error("Prova do aparelho mal formada.");
  await p.pedir(ROTA_DO_LINK, {
    metodo: "POST",
    corpo: { email: p.email, app: "cliente", prova },
    semSessao: true,
  });
}

/* ─── 2. Ver de quem é o link (sem o gastar) ──────────────────────────────── */

export type EstadoDaConfirmacao =
  /** Sem sessão: «Vai entrar como j•••@gmail.com.» · Entrar · Não sou eu. */
  | { passo: "entrar"; email: string; emailMascarado: string }
  /** Outra conta aberta: «Trocar de conta?» · Trocar de conta · Ficar em … */
  | { passo: "trocar"; email: string; emailMascarado: string; sessaoMascarada: string }
  /** A mesma conta já aberta: sem ecrã, vai para Pedidos sem gastar o link. */
  | { passo: "mesma-conta" }
  /** Uma recusa, com a frase do site e o botão que o motivo pede. */
  | { passo: "erro"; mensagem: string; botao: "novo-link" | "tentar-outra-vez" | "nenhum" };

/** O botão de cada recusa (`motivo` da R1/R1a). Sem rede: «Tentar outra vez». */
export function estadoDoErro(e: unknown): Extract<EstadoDaConfirmacao, { passo: "erro" }> {
  if (e instanceof ErroDaApi && e.estado === 0) {
    return { passo: "erro", mensagem: e.message || SEM_REDE, botao: "tentar-outra-vez" };
  }
  if (e instanceof ErroDaApi && e.estado === 429) {
    return { passo: "erro", mensagem: e.message, botao: "nenhum" };
  }
  const motivo = motivoDe(e);
  const comLinkNovo = ["expirado", "usado", "malformado", "desconhecido", "ausente", "outroAparelho", "doSite"];
  return {
    passo: "erro",
    mensagem: mensagemDe(e),
    botao: motivo === null || comLinkNovo.includes(motivo) ? "novo-link" : "nenhum",
  };
}

/**
 * Ao abrir o E1a: pergunta ao site (R1a) de quem é o link. Nunca chama a R1 —
 * entrar é só depois de um toque (`entrarComOLink`).
 */
export async function verificarLinkDeEntrada(p: {
  pedir: Pedir;
  token: string;
  codigo: string;
  emailDaSessao: string | null;
}): Promise<EstadoDaConfirmacao> {
  try {
    const r = await p.pedir<{ email?: unknown; emailMascarado?: unknown }>(ROTA_DE_VERIFICAR, {
      metodo: "POST",
      corpo: { linkToken: p.token, codigoDoAparelho: p.codigo },
      semSessao: true,
    });
    const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
    if (!email) return { passo: "erro", mensagem: mensagemDe(null), botao: "novo-link" };
    const emailMascarado = typeof r.emailMascarado === "string" && r.emailMascarado ? r.emailMascarado : mascararEmail(email);
    const sessao = (p.emailDaSessao ?? "").trim().toLowerCase();
    if (!sessao) return { passo: "entrar", email, emailMascarado };
    if (sessao === email) return { passo: "mesma-conta" };
    return { passo: "trocar", email, emailMascarado, sessaoMascarada: mascararEmail(sessao) };
  } catch (e) {
    return estadoDoErro(e);
  }
}

/* ─── 3. Entrar (só depois do toque) ──────────────────────────────────────── */

export type SessaoNova = { token: string; email: string; expiraEm: string | null; entrada: "link" | "google" };

/** O toque em «Entrar» ou «Trocar de conta»: a R1 com o link e o código. Lança a recusa do site. */
export async function entrarComOLink(p: { pedir: Pedir; token: string; codigo: string }): Promise<SessaoNova> {
  const r = await p.pedir<{ token?: unknown; email?: unknown; expiraEm?: unknown; entrada?: unknown }>(ROTA_DE_ENTRAR, {
    metodo: "POST",
    corpo: { linkToken: p.token, codigoDoAparelho: p.codigo },
    semSessao: true,
  });
  if (typeof r.token !== "string" || !r.token || typeof r.email !== "string" || !r.email) {
    throw new ErroDaApi(mensagemDe(null), 500);
  }
  return {
    token: r.token,
    email: r.email.trim().toLowerCase(),
    expiraEm: typeof r.expiraEm === "string" ? r.expiraEm : null,
    entrada: r.entrada === "google" ? "google" : "link",
  };
}
