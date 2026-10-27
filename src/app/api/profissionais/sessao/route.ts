import { NextRequest, NextResponse } from "next/server";
import {
  assinarSessaoDoProfissional,
  sessaoVemDaApp,
  tokenDoProfissional,
} from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import {
  CABECALHOS_DA_VERSAO,
  registarAppAberta,
  versaoDoCabecalho,
} from "@/lib/app-pro-no-telemovel";

export const runtime = "nodejs";

/**
 * A APP RENOVA A SESSÃO AO ABRIR — 18-10-2026.
 *
 * No painel a renovação vai no cookie da rota do perfil. A app não tem
 * cookies: chama esta rota quando abre e guarda o token novo. Os trinta dias
 * passam a contar da última vez que ele abriu a app — enquanto a usar, nunca
 * tem de voltar a escrever a palavra-passe.
 *
 * SÓ PARA QUEM JÁ VEM COM O TOKEN NO CABEÇALHO. O cookie do painel é
 * `httpOnly` para o JavaScript da página nunca lhe tocar; se esta rota
 * aceitasse o cookie e devolvesse o token no corpo, qualquer script na página
 * levava uma sessão de trinta dias. Por isso o cookie, aqui, é recusado.
 *
 * A conta é confirmada na base (`sessaoActivaDoProfissional`): um profissional
 * suspenso não renova, e a app manda-o para o ecrã de entrada.
 */
export async function POST(req: NextRequest) {
  if (!sessaoVemDaApp(req)) {
    return NextResponse.json({ error: "Só para a app." }, { status: 400 });
  }

  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const token = await assinarSessaoDoProfissional(sessao.providerId, sessao.nome, true);

  // QUEM TEM A APP — 27-10-2026: a data e a versão (do cabeçalho, se vier;
  // senão fica vazia). Depois de renovar, e nunca lança.
  const versao = versaoDoCabecalho(
    CABECALHOS_DA_VERSAO.map((c) => req.headers.get(c)).find((v) => v) ?? null,
  );
  await registarAppAberta(sessao.providerId, versao);

  return NextResponse.json({ ok: true, nome: sessao.nome, token });
}
