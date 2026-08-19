import { NextResponse } from "next/server";
import { COOKIE_SESSAO_TESTE } from "@/lib/acesso-mvp";

export const runtime = "nodejs";

/**
 * Sair do ambiente de testes.
 *
 * Apaga a sessão e NÃO a chave. Quem sai continua a saber o endereço — apagar
 * a chave obrigava-o a pedir o link outra vez para voltar a entrar, e o que
 * ele quis foi fechar a sessão, não perder o acesso.
 */
export async function POST() {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE_SESSAO_TESTE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return resposta;
}
