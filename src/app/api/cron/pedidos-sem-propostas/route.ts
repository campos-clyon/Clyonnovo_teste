import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { resumoSemPropostas, rotinaSemPropostas } from "@/lib/sem-propostas-ao-cliente-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * O PEDIDO SEM PROPOSTAS — de 15 em 15 min (d102 (a), 24-11-2026).
 *
 * Ver `sem-propostas-ao-cliente.ts`: 24 h depois de o pedido seguir para os
 * parceiros sem nenhuma proposta, ou logo que fica «sem parceiros na zona», a
 * Vitória avisa o cliente uma vez (WhatsApp ou email), das 9h às 20h de
 * Lisboa, dentro da regra de uma mensagem automática por dia e do «não
 * contactar». O pedido aparece no «Do nosso lado» da Mesa.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/pedidos-sem-propostas] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const r = await carimbarPassagem("pedidos-sem-propostas", () => rotinaSemPropostas(new Date()), (p) => ({
      ok: true,
      motivo: resumoSemPropostas(p),
      detalhe: p,
    }));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/pedidos-sem-propostas]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
