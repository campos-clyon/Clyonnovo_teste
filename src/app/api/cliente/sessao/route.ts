import { NextRequest, NextResponse } from "next/server";
import { sessaoVemDaApp } from "@/lib/profissional-auth";
import {
  assinarSessaoDoCliente,
  registarAppDoClienteAberta,
  sessaoActivaDoCliente,
  tokenDoClienteNoCabecalho,
} from "@/lib/cliente-auth";
import { CABECALHOS_DA_VERSAO, versaoDoCabecalho } from "@/lib/app-pro-no-telemovel";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * A APP DE CLIENTE RENOVA A SESSÃO AO ABRIR — 27-10-2026 (decisão d8, R2).
 *
 * Como `POST /api/profissionais/sessao`: a cada abertura, um token novo de
 * trinta dias — quem abre a app pelo menos uma vez por mês nunca tem de
 * voltar a entrar. E fica gravado quando abriu e com que versão (as medidas
 * da especificação), na conta do cliente.
 *
 * Só com o token no cabeçalho, e só um token de cliente activo (a conta
 * existe, não foi apagada, e o token não é de antes do corte). O cookie do
 * site nunca dá aqui um token: um script na página não pode levar uma sessão
 * de trinta dias.
 */
export async function POST(req: NextRequest) {
  // Uma abertura da app por pedido; um travão largo para quem a usa (Segurança, 28-10-2026).
  const limite = await limitarRotaPublica(req, "cliente-sessao", 60, 300);
  if (limite.erro) return limite.erro;

  if (!sessaoVemDaApp(req)) {
    return NextResponse.json({ error: "Só para a app." }, { status: 400 });
  }

  const sessao = await sessaoActivaDoCliente(tokenDoClienteNoCabecalho(req));
  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { token, expiraEm } = await assinarSessaoDoCliente(sessao.email, sessao.entrada);

  const versao = versaoDoCabecalho(
    CABECALHOS_DA_VERSAO.map((c) => req.headers.get(c)).find((v) => v) ?? null,
  );
  await registarAppDoClienteAberta(sessao.email, versao);

  return NextResponse.json({ ok: true, token, expiraEm: expiraEm.toISOString() });
}
