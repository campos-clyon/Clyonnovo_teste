import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { negociacaoNoTerreno, registarSemFalhar } from "@/lib/db";
import { semDadosDePessoas } from "@/lib/erros-da-app";
import {
  gravarAvaliacaoAoCliente,
  jaAvaliouOCliente,
  lerAvaliacaoDoProfissional,
  podeAvaliarOCliente,
} from "@/lib/avaliacoes-do-cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O PROFISSIONAL AVALIA O CLIENTE — dono, 29-10-2026. A app Pro (Bearer) e o
 * painel (cookie) usam esta rota.
 *
 * GET  ?negociacaoId=N → { podeAvaliar, jaAvaliou } — nunca as estrelas que deu.
 * POST { negociacaoId, estrelas 1–5, comentario? } → grava uma vez; a segunda
 *      responde 409 «Já avaliou este cliente.» e nada muda.
 *
 * Só no trabalho dele, feito (marcado como feito) ou confirmado. O cliente vê-a
 * em «As minhas avaliações» (`GET /api/cliente/avaliacoes`).
 */

async function oTrabalho(req: NextRequest, negociacaoId: number) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return { erro: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) } as const;
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return { erro: NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 }) } as const;
  }
  const n = await negociacaoNoTerreno(negociacaoId);
  if (!n || Number(n.providerId) !== sessao.providerId) {
    return { erro: NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 }) } as const;
  }
  return { sessao, n } as const;
}

export async function GET(req: NextRequest) {
  try {
    const t = await oTrabalho(req, Number(req.nextUrl.searchParams.get("negociacaoId")));
    if ("erro" in t) return t.erro;
    const jaAvaliou = await jaAvaliouOCliente(t.n.id);
    return NextResponse.json(
      { ok: true, podeAvaliar: !jaAvaliou && podeAvaliarOCliente(t.n, t.sessao.providerId), jaAvaliou },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[profissionais/trabalho/avaliar-cliente]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível ler." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const t = await oTrabalho(req, Number(corpo.negociacaoId));
    if ("erro" in t) return t.erro;
    const { sessao, n } = t;
    if (!podeAvaliarOCliente(n, sessao.providerId)) {
      return NextResponse.json({ error: "Só pode avaliar o cliente depois de o trabalho estar feito." }, { status: 409 });
    }
    const a = lerAvaliacaoDoProfissional(corpo);
    if ("erro" in a) return NextResponse.json({ error: a.erro }, { status: 400 });
    // Sem telefones nem emails no comentário (a mesma limpeza dos erros da app).
    const comentario = a.comentario ? semDadosDePessoas(a.comentario).trim() || null : null;
    const gravou = await gravarAvaliacaoAoCliente({
      pedidoId: n.pedidoId,
      negociacaoId: n.id,
      providerId: sessao.providerId,
      clienteEmail: String(n.contactEmail),
      estrelas: a.estrelas,
      comentario,
    });
    if (!gravou) return NextResponse.json({ error: "Já avaliou este cliente." }, { status: 409 });
    await registarSemFalhar({
      acontecimento: "cliente_avaliado",
      pedidoId: n.pedidoId,
      negociacaoId: n.id,
      providerId: sessao.providerId,
      providerNome: sessao.nome,
      autorTipo: "profissional",
      autorNome: sessao.nome,
      resumo: `${sessao.nome} avaliou o cliente`,
      detalhe: null,
    });
    return NextResponse.json({ ok: true, mensagem: "Obrigado. A avaliação foi enviada ao cliente." });
  } catch (error) {
    console.error("[profissionais/trabalho/avaliar-cliente]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível gravar a avaliação." }, { status: 500 });
  }
}
