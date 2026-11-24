import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { resumoDaRotinaDoEnvioAutomatico, rotinaDoEnvioAutomatico } from "@/lib/envio-automatico-aos-parceiros-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * O ENVIO AUTOMÁTICO AOS PARCEIROS — a fila das 9h00 (d87, 22-11-2026).
 *
 * Ver `envio-automatico-aos-parceiros.ts`: o pedido que a Vitória deixa
 * completo fora das 9h–20h de Lisboa fica na fila; esta rotina, de 15 em 15
 * minutos, solta-a a partir das 9h00 (no máximo cinco por passagem), voltando
 * a ver todas as condições, e fecha para a equipa os envios que ficaram a meio.
 * Com o interruptor «Envio automático aos parceiros» desligado nas Configs, a
 * fila espera e nada sai.
 *
 * d88 (23-11-2026): a mesma passagem varre os «Orçamentos novos» de todas as
 * origens (simulador, formulário, WhatsApp, registado na Mesa) e manda os
 * completos pela mesma função da Mesa, 10 minutos depois de entrarem — no
 * máximo cinco envios por passagem, a fila e os novos juntos.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/envio-aos-parceiros] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const r = await carimbarPassagem("envio-aos-parceiros", () => rotinaDoEnvioAutomatico(new Date()), (p) => ({
      ok: true,
      motivo: resumoDaRotinaDoEnvioAutomatico(p),
      detalhe: p,
    }));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/envio-aos-parceiros]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
