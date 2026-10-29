import { NextRequest, NextResponse } from "next/server";
import { avisarCliente, avisarProfissional, avisarProfissionaisDoPedido } from "@/lib/avisos-do-backoffice";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import { negociacaoNoTerreno } from "@/lib/db";
import { responderAoAjuste } from "@/lib/responder-ajuste";

export const runtime = "nodejs";

/**
 * A CLYON RESPONDE A UM AJUSTE NO LOCAL — 18-10-2026.
 *
 * O cliente ligou para a CLYON em vez de carregar no link, ou o trabalho é um
 * Trabalho CLYON de valor fixo (aí o cliente não é a contraparte e só a CLYON
 * responde). Fica registado que foi a CLYON, e quem. É a mesma resposta das
 * outras portas — ver `responder-ajuste.ts`.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; resposta?: unknown; nota?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const resposta = corpo.resposta === "aprovar" ? "aprovar" : corpo.resposta === "recusar" ? "recusar" : null;
  if (!resposta) return NextResponse.json({ error: "Diga se aprova ou recusa." }, { status: 400 });

  const n = await negociacaoNoTerreno(negociacaoId);
  if (!n) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  await assumirPedidoSeLivre(Number(n.pedidoId), colab);

  const r = await responderAoAjuste({
    negociacaoId,
    resposta,
    porQuem: "clyon",
    autorNome: colab?.nome ?? null,
    nota: typeof corpo.nota === "string" ? corpo.nota : null,
  });
  // S19 (BO21): o cliente vê a resposta da CLYON ao ajuste.
  if (r.status === 200) await avisarCliente(Number(n.pedidoId), "ajuste_respondido", { negociacaoId });
  return NextResponse.json(r.corpo, { status: r.status });
}
