import { NextResponse } from "next/server";
import { COOKIE_SESSAO_ADMIN } from "@/lib/colaborador-auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/sessao/sair
 *
 * Apaga o cookie de sessão do backoffice. É preciso ser o servidor a fazê-lo:
 * o cookie é httpOnly, portanto o botão de sair não lhe chega a partir da
 * página. Sem isto, sair limpava o localStorage e deixava o cookie de pé — e
 * o middleware continuava a abrir a porta.
 *
 * Não exige token: quem chama já está a dizer que quer sair. O pior que
 * alguém consegue com isto é terminar a própria sessão.
 */
export async function POST() {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE_SESSAO_ADMIN, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return resposta;
}
