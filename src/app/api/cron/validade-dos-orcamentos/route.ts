import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { resumoDaRotinaDaValidade, rotinaDaValidade } from "@/lib/validade-do-orcamento-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * A VALIDADE DOS ORÇAMENTOS — de hora a hora (d62, 18-11-2026).
 *
 * Ver `validade-do-orcamento.ts`: o lembrete no D+1, o último aviso no D+3 e o
 * fecho no D+4 às 18h, das 9h às 20h de Lisboa (fora disso, carimba e sai). A
 * rotina só decide e põe na fila; os WhatsApp saem um de cada vez, 20–45 s
 * entre cada, às rondas da ponte. DESLIGADA por omissão: com o interruptor
 * «Validade dos orçamentos» desligado nas Configs, responde «desligado» e não
 * mexe em nada.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/validade-dos-orcamentos] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const r = await carimbarPassagem("validade-dos-orcamentos", () => rotinaDaValidade(new Date()), (p) => ({
      ok: p.falhados === 0,
      motivo: resumoDaRotinaDaValidade(p),
      detalhe: p,
    }));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/validade-dos-orcamentos]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
