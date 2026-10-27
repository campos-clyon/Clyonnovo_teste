import * as jose from "jose";

/**
 * A ENTRADA COM O GOOGLE NA APP DE CLIENTE — 27-10-2026 (d8, R1).
 *
 * No site, o Google é o NextAuth que trata de tudo (o código volta ao nosso
 * servidor e é trocado lá). Na app não há esse caminho: o Google do telemóvel
 * entrega à app um `idToken` — um JWT assinado pelo Google com o email da
 * pessoa — e a app manda-o ao servidor. Quem decide se vale somos nós, aqui,
 * e nunca a app.
 *
 * O QUE SE VERIFICA, e porquê cada coisa:
 *   · a assinatura, com as chaves públicas do Google (sem isto, qualquer um
 *     escrevia um JWT com o email que quisesse);
 *   · `iss` do Google;
 *   · `aud` = um dos IDs de cliente da CLYON (sem isto, um idToken emitido
 *     para OUTRA app qualquer — que o dono dessa app tem nas mãos — entrava
 *     aqui com o email de quem lá entrou);
 *   · `exp` no futuro (a `jose` já o faz);
 *   · `email_verified === true` (um email por confirmar não prova nada).
 *
 * Os IDs vêm da Vercel (`GOOGLE_CLIENT_ID`, o do site, que é o `webClientId`
 * da app; e `GOOGLE_CLIENT_ID_APP_CLIENTE`, o cliente OAuth Android). Nunca
 * no código: o repositório é público.
 */

export const EMISSORES_DO_GOOGLE = ["accounts.google.com", "https://accounts.google.com"];
const CHAVES_DO_GOOGLE = new URL("https://www.googleapis.com/oauth2/v3/certs");

/**
 * A entrada com o Google na app só se liga quando o cliente OAuth Android
 * existir (é uma definição da conta Google Cloud, feita pelo dono). Sem ele o
 * telemóvel nem chega a dar um idToken; com a variável vazia, a rota diz que
 * ainda não está disponível e a app mostra só a entrada pelo link.
 */
export function googleNaAppLigado(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID_APP_CLIENTE?.trim());
}

/** Os `aud` aceites: o ID do site e o da app, se existirem. */
export function idsDeClienteDoGoogle(env: Record<string, string | undefined> = process.env): string[] {
  return [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_ID_APP_CLIENTE]
    .flatMap((v) => (v ?? "").split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

type Chaves = Parameters<typeof jose.jwtVerify>[1];
let chavesRemotas: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

/** As chaves públicas do Google, em cache (a `jose` respeita o cache do Google). */
function chavesDoGoogle() {
  chavesRemotas ??= jose.createRemoteJWKSet(CHAVES_DO_GOOGLE);
  return chavesRemotas;
}

export type IdentidadeDoGoogle = { email: string; nome: string | null };

/**
 * O email confirmado pelo Google, ou `null`. Nunca lança: um token estragado,
 * de outro projecto, expirado ou sem email confirmado é uma recusa.
 */
export async function verificarIdTokenDoGoogle(
  idToken: unknown,
  opcoes: { ids?: string[]; chaves?: Chaves } = {},
): Promise<IdentidadeDoGoogle | null> {
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 4096) return null;
  const ids = opcoes.ids ?? idsDeClienteDoGoogle();
  if (ids.length === 0) return null;
  try {
    const { payload } = await jose.jwtVerify(idToken, (opcoes.chaves ?? chavesDoGoogle()) as never, {
      issuer: EMISSORES_DO_GOOGLE,
      audience: ids,
      algorithms: ["RS256"],
    });
    if (payload.email_verified !== true) return null;
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) return null;
    const nome = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
    return { email, nome };
  } catch {
    return null;
  }
}
