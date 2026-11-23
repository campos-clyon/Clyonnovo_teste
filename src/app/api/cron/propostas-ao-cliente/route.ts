import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { resumoDaRotinaDasPropostas, rotinaDasPropostas } from "@/lib/envio-das-propostas-ao-cliente-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * AS PROPOSTAS VÃO AO CLIENTE SOZINHAS — de 15 em 15 min (d88, 23-11-2026).
 *
 * Ver `envio-das-propostas-ao-cliente.ts`: num pedido em negociação com
 * propostas de parceiros por enviar, com 3 propostas ou 3 horas depois da 1.ª,
 * das 8h às 21h de Lisboa, o orçamento entra na fila e sai pela ponte, um de
 * cada vez (20–45 s entre cada), pelo caminho do «Enviar pela CLYON». Com o
 * interruptor «Enviar as propostas ao cliente» desligado nas Configs, responde
 * «desligado» e não mexe em nada.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/propostas-ao-cliente] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const r = await carimbarPassagem("propostas-ao-cliente", () => rotinaDasPropostas(new Date()), (p) => ({
      ok: true,
      motivo: resumoDaRotinaDasPropostas(p),
      detalhe: p,
    }));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/propostas-ao-cliente]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
