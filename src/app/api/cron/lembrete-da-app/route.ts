import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { enviarLembretesDaApp } from "@/lib/lembrete-da-app";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * O LEMBRETE DA APP DE CLIENTE — uma vez por dia (17-11-2026, d59).
 *
 * Ver `lembrete-da-app.ts`: um lembrete único, 3 dias depois do convite, a
 * quem ainda não aderiu. DESLIGADO por omissão — enquanto o interruptor e o
 * texto aprovado não estiverem em `textos-do-seguimento-da-app.ts`, esta
 * rotina só responde «desligado» e não envia nada.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/lembrete-da-app] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const r = await carimbarPassagem("lembrete-da-app", () => enviarLembretesDaApp(new Date()), (p) => ({
      ok: p.falhados === 0,
      motivo: !p.ligado ? "desligado (à espera dos textos aprovados)" : p.falhados > 0 ? `${p.falhados} lembrete(s) falharam` : null,
      detalhe: p,
    }));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/lembrete-da-app]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
