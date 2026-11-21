import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { resumoDaRotinaDoSeguimento, rotinaDoSeguimento } from "@/lib/seguimento-do-cliente-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * O SEGUIMENTO DO CLIENTE — de 15 em 15 minutos (d83, 21-11-2026).
 *
 * Ver `seguimento-do-cliente.ts`: só os pedidos que a equipa marcou com «Falei
 * com o cliente»; a 1.ª mensagem na hora marcada, a 2.ª e a 3.ª nos dias
 * seguintes à mesma hora, o arquivo no 4.º dia; das 9h às 21h de Lisboa (fora
 * disso, carimba e sai). A rotina decide e põe na fila; os WhatsApp saem um de
 * cada vez, 20–45 s entre cada, às rondas da ponte. Com o interruptor de
 * emergência «Seguimento do cliente» desligado, responde «desligado».
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/seguimento-do-cliente] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const r = await carimbarPassagem("seguimento-do-cliente", () => rotinaDoSeguimento(new Date()), (p) => ({
      ok: p.falhados === 0,
      motivo: resumoDaRotinaDoSeguimento(p),
      detalhe: p,
    }));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/seguimento-do-cliente]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
