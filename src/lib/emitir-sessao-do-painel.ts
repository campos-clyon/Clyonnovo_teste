import * as jose from "jose";
import type { NextResponse } from "next/server";

import {
  COOKIE_SESSAO_ADMIN,
  DURACAO_SESSAO_ADMIN_SEGUNDOS,
  getColaboradorSecretKey,
} from "@/lib/colaborador-auth";
import type { PapelDoPainel } from "@/lib/papel-do-painel";

/**
 * A sessão do backoffice — o mesmo token do login por utilizador
 * (`/api/colaboradores/login`), para a entrada por código (d75) e para o
 * administrador que troca o próprio código e continua lá dentro.
 *
 * `setIssuedAt`: a hora a que o token nasceu vai lá dentro, e é o que deixa
 * as rotas recusarem os tokens de antes de uma troca (`senhaAlteradaEm`).
 */
export async function assinarSessaoDoPainel(conta: {
  id: number;
  nome: string;
  papel: PapelDoPainel;
}): Promise<string> {
  return new jose.SignJWT({
    id: conta.id,
    nome: conta.nome,
    isAdmin: conta.papel === "admin" ? 1 : 0,
    papel: conta.papel,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getColaboradorSecretKey());
}

/** O mesmo token no cookie httpOnly que o middleware verifica. */
export function porCookieDaSessao(resposta: NextResponse, token: string): void {
  resposta.cookies.set(COOKIE_SESSAO_ADMIN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_ADMIN_SEGUNDOS,
  });
}
