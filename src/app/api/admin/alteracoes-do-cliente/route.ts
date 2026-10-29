import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { alteracoesPendentes } from "@/lib/db";
import { oQueMudou, type AlteracaoLida } from "@/lib/alteracoes-do-cliente";
import { decidirAlteracao } from "@/lib/alteracoes-na-base";
import { nomeDoServico } from "@/lib/service-categories";
import { quandoEmLisboa } from "@/lib/pedido-para-a-app";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AS ALTERAÇÕES DO CLIENTE, NA MESA — 29-10-2026 (S17, P11 (a)).
 *
 * GET: as que esperam pela equipa (pedidos já enviados aos profissionais).
 * POST `{ pedidoId, aplicar, motivo? }`: «Aplicar» passa pela edição de hoje
 * (recomeça se o que os profissionais vêem mudou) e avisa o cliente; «Não
 * aplicar» manda-lhe a frase da equipa, que lhe chega nas mensagens do pedido.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const linhas = await alteracoesPendentes();
  return NextResponse.json({
    ok: true,
    alteracoes: linhas.map((l) => {
      let a: { alteracao?: AlteracaoLida; porOnde?: string } = {};
      try {
        a = JSON.parse(l.alteracaoPendenteJson ?? "{}");
      } catch {
        a = {};
      }
      return {
        pedidoId: l.id,
        servico: nomeDoServico(l.serviceType),
        cidade: l.city,
        pedidaEmTexto: quandoEmLisboa(l.alteracaoPendenteEm),
        oQue: oQueMudou(a.alteracao ?? {}),
        pormenores: a.alteracao?.pormenores ?? null,
        fotografias: a.alteracao?.fotografias ?? [],
        porOnde: a.porOnde ?? null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  let corpo: { pedidoId?: unknown; aplicar?: unknown; motivo?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0 || typeof corpo.aplicar !== "boolean") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const r = await decidirAlteracao({
    pedidoId,
    aplicar: corpo.aplicar,
    motivo: typeof corpo.motivo === "string" ? corpo.motivo : null,
    by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
    baseUrl: urlDeAccaoDoPedido(req.headers),
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json(r);
}
