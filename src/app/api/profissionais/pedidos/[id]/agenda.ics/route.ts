import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { profissionalDaLigacaoDaAgenda, sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { eventoDaAgendaDoProfissional } from "@/lib/agenda-do-profissional-no-servidor";
import { ficheiroIcs } from "@/lib/evento-na-agenda-do-profissional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O FICHEIRO .ics DE UM TRABALHO — d144 (dono, 27-11-2026). Apple, Outlook e
 * os outros calendários.
 *
 * Abre com a sessão (o painel, com o cookie) OU com a ligação assinada que o
 * `POST …/agenda` devolve (`?a=`, 15 minutos, só este trabalho deste
 * profissional): a app CLYON Pro abre-o no navegador do telemóvel, que não leva
 * a sessão da app. Cada vez que se abre, lê o trabalho de novo — se o dia
 * mudou, o ficheiro já traz o dia novo, com o mesmo UID (actualiza o evento).
 *
 * Nunca em cache e nunca indexado: leva o nome, o telefone e a morada do cliente.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const negociacaoId = Number((await ctx.params).id);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  const assinatura = req.nextUrl.searchParams.get("a");
  const providerId = assinatura
    ? await profissionalDaLigacaoDaAgenda(assinatura, negociacaoId)
    : ((await sessaoActivaDoProfissional(tokenDoProfissional(req)))?.providerId ?? null);
  if (providerId == null) {
    return NextResponse.json(
      { error: "A ligação expirou. Volte ao trabalho e carregue outra vez em «Adicionar à minha agenda»." },
      { status: 401 },
    );
  }

  try {
    const r = await eventoDaAgendaDoProfissional(providerId, negociacaoId);
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.estado });
    const pedido = /#(\d+)/.exec(r.evento.titulo)?.[1] ?? String(negociacaoId);
    return new NextResponse(ficheiroIcs(r.evento), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="clyon-${pedido}.ics"`,
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    console.error("[profissionais/pedidos/agenda.ics]", e);
    return NextResponse.json({ error: "Não foi possível preparar o ficheiro." }, { status: 500 });
  }
}
