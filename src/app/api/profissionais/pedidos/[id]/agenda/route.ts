import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional, assinarLigacaoDaAgenda } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { eventoDaAgendaDoProfissional, marcarAgendaAdicionada } from "@/lib/agenda-do-profissional-no-servidor";
import { ligacaoDoGoogle } from "@/lib/evento-na-agenda-do-profissional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «ADICIONAR À MINHA AGENDA» — d144 (dono, 27-11-2026).
 *
 * POST com a sessão do profissional (cookie no painel, Bearer na app). O `[id]`
 * é o da negociação (o mesmo do `trabalho/[id]` da app). Devolve as duas
 * ligações — a do Google Agenda e a do ficheiro .ics, esta assinada por 15
 * minutos para o navegador do telemóvel a poder abrir sem a sessão da app — e
 * guarda o dia marcado neste momento, para o botão dizer «O dia mudou —
 * actualize na sua agenda» se ele mudar depois.
 *
 * Só para um trabalho DELE, por fazer e com o dia marcado — a regra está em
 * `podeIrParaAAgenda`, e os dados passam pela vista do contratado.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const negociacaoId = Number((await ctx.params).id);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  try {
    const r = await eventoDaAgendaDoProfissional(sessao.providerId, negociacaoId);
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado });

    await marcarAgendaAdicionada(sessao.providerId, negociacaoId, r.dataCombinada);
    const assinatura = await assinarLigacaoDaAgenda(sessao.providerId, negociacaoId);
    const origem = new URL(req.url).origin;
    return NextResponse.json(
      {
        ok: true,
        google: ligacaoDoGoogle(r.evento),
        ics: `${origem}/api/profissionais/pedidos/${negociacaoId}/agenda.ics?a=${encodeURIComponent(assinatura)}`,
        dataCombinada: r.dataCombinada.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[profissionais/pedidos/agenda]", e);
    return NextResponse.json({ error: "Não foi possível preparar a agenda." }, { status: 500 });
  }
}
