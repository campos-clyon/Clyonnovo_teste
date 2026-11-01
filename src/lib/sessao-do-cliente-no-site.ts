import { encode } from "next-auth/jwt";
import type { NextResponse } from "next/server";

/**
 * ABRIR A SESSÃO DO CLIENTE NO SITE A PARTIR DE UMA ROTA NOSSA — 01-11-2026.
 *
 * A entrada com palavra-passe é uma rota só (`/api/entrada/palavra-passe`) para
 * o site e para a app, e no site tem de deixar o MESMO cookie que o Google e o
 * link deixam — o do NextAuth — para todo o resto (`clienteDaSessao`,
 * `getServerSession`, o `useSession` das páginas) o ler sem saber de onde veio.
 *
 * Faz-se com o `encode` do próprio NextAuth (mesma chave, mesmo formato, mesmos
 * 30 dias) e o nome e as opções do cookie que ele usa por omissão — `src/auth.ts`
 * não os muda. O token leva o que o NextAuth poria: `sub` (o email, como no
 * provedor do link), `email` e `name`.
 */

const TRINTA_DIAS = 30 * 24 * 60 * 60;

/** A mesma regra do `getToken` do NextAuth para saber se o cookie é seguro. */
export function cookieSeguro(): boolean {
  return process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL;
}

export function nomeDoCookieDaSessao(): string {
  return cookieSeguro() ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

export async function porSessaoDoClienteNoSite(
  resposta: NextResponse,
  cliente: { email: string; nome: string | null },
): Promise<void> {
  const segredo = process.env.NEXTAUTH_SECRET;
  if (!segredo) throw new Error("[sessao-do-cliente-no-site] NEXTAUTH_SECRET em falta");
  const email = cliente.email.trim().toLowerCase();
  const token = await encode({
    token: { sub: email, email, name: cliente.nome ?? null },
    secret: segredo,
    maxAge: TRINTA_DIAS,
  });
  resposta.cookies.set(nomeDoCookieDaSessao(), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: cookieSeguro(),
    maxAge: TRINTA_DIAS,
  });
}
