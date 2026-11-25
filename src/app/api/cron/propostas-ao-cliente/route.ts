import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { passagemUnicaDosEnviados, resumoDaRotinaDasPropostas, rotinaDasPropostas } from "@/lib/envio-das-propostas-ao-cliente-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * AS PROPOSTAS VÃO AO CLIENTE SOZINHAS — de 15 em 15 min (d88, 23-11-2026).
 *
 * Ver `envio-das-propostas-ao-cliente.ts`: num pedido em negociação com
 * propostas de parceiros por enviar, assim que chega a 1.ª proposta (d6),
 * das 9h às 20h de Lisboa, o orçamento entra na fila e sai pela ponte, um de
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
  // d119: uma vez, os pedidos com as propostas já ditas pela Vitória passam a «A aguardar cliente».
  await passagemUnicaDosEnviados(new Date()).catch((e) =>
    console.error("[cron/propostas-ao-cliente] a passagem única da d119:", e instanceof Error ? e.message : e),
  );
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
