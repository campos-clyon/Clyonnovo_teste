import { NextRequest, NextResponse } from "next/server";
import { sessaoVemDaApp, tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";
import { novoModeloEmVigor } from "@/lib/novo-modelo";
import {
  TEXTOS_DA_ACEITACAO,
  VERSAO_DOS_TERMOS,
  VERSAO_DOS_TERMOS_POR_EXTENSO,
  eAVersaoEmVigor,
  precisaDeAceitar,
} from "@/lib/aceitacao-dos-termos";
import { aceitacaoDoProfissional, gravarAceitacao } from "@/lib/aceitacao-dos-termos-na-base";

export const runtime = "nodejs";

/**
 * A ACEITAÇÃO DOS TERMOS — d20 (13-11-2026). Para o painel e para a app CLYON Pro
 * (a mesma rota; a app manda o token no cabeçalho).
 *
 * GET → { versao, versaoPorExtenso, emVigor, aceiteEm, precisaDeAceitar, textos }
 *   · `precisaDeAceitar` verdadeiro = mostrar o ecrã do primeiro acesso;
 *   · `textos` = os do ecrã (`TEXTOS_DA_ACEITACAO`), para a app dizer o mesmo.
 * POST { versao, aceito: true } → grava (versão, instante, origem) e devolve o GET.
 *   A origem vem da sessão (app = token no cabeçalho; painel = cookie), nunca do corpo.
 *
 * Não bloqueia nada: «Agora não» não chama esta rota, e o ecrã volta no acesso seguinte.
 */
async function estado(providerId: number, agora: Date) {
  const emVigor = novoModeloEmVigor(agora);
  const aceite = emVigor ? await aceitacaoDoProfissional(providerId) : null;
  return {
    versao: VERSAO_DOS_TERMOS,
    versaoPorExtenso: VERSAO_DOS_TERMOS_POR_EXTENSO,
    emVigor,
    aceiteEm: aceite ? aceite.em.toISOString() : null,
    precisaDeAceitar: precisaDeAceitar(aceite?.versao ?? null, agora),
    textos: TEXTOS_DA_ACEITACAO,
  };
}

export async function GET(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    return NextResponse.json(await estado(sessao.providerId, agoraDoModelo()));
  } catch (e) {
    console.error("[profissionais/termos GET]", e);
    return NextResponse.json({ error: "Não consegui ver os Termos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { versao?: unknown; aceito?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (corpo.aceito !== true) {
    return NextResponse.json({ error: "Para aceitar, marque a caixa." }, { status: 400 });
  }
  if (!eAVersaoEmVigor(corpo.versao)) {
    return NextResponse.json(
      { error: "Os Termos mudaram entretanto. Volte a abrir a página.", versao: VERSAO_DOS_TERMOS },
      { status: 409 },
    );
  }

  const agora = agoraDoModelo();
  if (!novoModeloEmVigor(agora)) {
    return NextResponse.json({ error: "Esta versão ainda não está em vigor." }, { status: 409 });
  }
  try {
    await gravarAceitacao(sessao.providerId, sessaoVemDaApp(req) ? "app" : "painel", new Date());
    return NextResponse.json({ ok: true, ...(await estado(sessao.providerId, agora)) });
  } catch (e) {
    console.error("[profissionais/termos POST]", e);
    return NextResponse.json({ error: "Não foi possível guardar. Tente novamente." }, { status: 500 });
  }
}
