import { NextResponse } from "next/server";
import { COOKIE_SESSAO_PROFISSIONAL } from "@/lib/profissional-auth";

export const runtime = "nodejs";

export async function POST() {
  const resposta = NextResponse.json({ ok: true });
  // maxAge 0 apaga; limpar só do lado do browser deixava o cookie httpOnly
  // intacto e a sessão viva.
  resposta.cookies.set(COOKIE_SESSAO_PROFISSIONAL, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return resposta;
}
