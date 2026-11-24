import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { resumoDaRotinaDoQueFalta, rotinaDoQueFalta } from "@/lib/lembrete-do-que-falta-na-base";
import { rotinaDoRecebido } from "@/lib/recebemos-o-pedido-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * O «PEDIR O QUE FALTA» SOZINHO — de 15 em 15 min (d71, 19-11-2026, no ritmo da
 * d88, 23-11-2026).
 *
 * Ver `lembrete-do-que-falta.ts`: os pedidos dos «Orçamentos novos» a que
 * falta informação recebem o «Pedir o que falta» 30 min depois de entrarem, a
 * repetição no dia seguinte à mesma hora (no máximo 3 mensagens), e são
 * arquivados no dia a seguir à 3.ª, sem resposta. Por dentro só se faz alguma
 * coisa das 8h às 21h de Lisboa (o que fica fora sai às 9h). Os WhatsApp vão
 * para a fila e saem um de cada vez, 20–45 s entre cada, às rondas da ponte;
 * os emails saem logo. Com o interruptor «Lembretes do que falta» desligado
 * nas Configs, responde «desligado» e não mexe em nada.
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
    const r = await carimbarPassagem("lembretes-do-que-falta", async () => {
      // d102 (d): os «Recebemos o seu pedido #N» que ficaram para as 8h saem ANTES (levam a 1.ª do que falta).
      await rotinaDoRecebido(new Date()).catch((e) => console.error("[cron/lembretes-do-que-falta] recebemos:", e instanceof Error ? e.message : e));
      return rotinaDoQueFalta(new Date());
    }, (p) => ({
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
