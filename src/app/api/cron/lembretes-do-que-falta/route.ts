import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { resumoDaRotinaDoQueFalta, rotinaDoQueFalta } from "@/lib/lembrete-do-que-falta-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * OS LEMBRETES DO QUE FALTA — às 10h de Lisboa (d71, 19-11-2026).
 *
 * Ver `lembrete-do-que-falta.ts`: os pedidos dos «Orçamentos novos» a que falta
 * informação recebem um lembrete no dia 1, no dia 3 e no dia 5, e são
 * arquivados no dia 7 sem resposta. O cron do Vercel corre em UTC, às 9h e às
 * 10h: por dentro só se faz alguma coisa às 10h de Lisboa (no Verão é a das
 * 9h UTC, no Inverno a das 10h); a outra carimba e sai. Os WhatsApp vão para
 * a fila e saem um de cada vez, 20–45 s entre cada, às rondas da ponte; os
 * emails saem logo. DESLIGADA por omissão: com o interruptor «Lembretes do
 * que falta» desligado nas Configs, responde «desligado» e não mexe em nada.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/lembretes-do-que-falta] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const r = await carimbarPassagem("lembretes-do-que-falta", () => rotinaDoQueFalta(new Date()), (p) => ({
      ok: p.falhados === 0,
      motivo: resumoDaRotinaDoQueFalta(p),
      detalhe: p,
    }));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/lembretes-do-que-falta]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
