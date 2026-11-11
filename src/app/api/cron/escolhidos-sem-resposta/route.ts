import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { correrARotinaDosEscolhidos } from "@/lib/escolhidos-sem-resposta-no-servidor";
import { resumoDaRotinaSemResposta } from "@/lib/escolhidos-sem-resposta";
import { bearerConfere } from "@/lib/segredo-igual";

export const runtime = "nodejs";

/**
 * OS ESCOLHIDOS SEM RESPOSTA — 11-11-2026 (d6).
 *
 * De hora a hora: numa mudança em que o cliente escolheu os parceiros da
 * lista, se o prazo de 3 horas passou e nenhum respondeu (ou todos disseram
 * que não), o cliente é avisado UMA vez, só entre as 8h e as 21h de Lisboa,
 * com as três saídas. Não envia o pedido a mais ninguém: isso só a pedido do
 * cliente. A regra é `semRespostaDosEscolhidos` (escolhidos-sem-resposta.ts);
 * o trabalho, `correrARotinaDosEscolhidos`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/escolhidos-sem-resposta] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const mexeu = (a: { avisados: number[]; semCanal: number[]; falhas: string[] }) =>
      a.avisados.length > 0 || a.semCanal.length > 0 || a.falhas.length > 0;
    const r = await carimbarPassagem(
      "escolhidos-sem-resposta",
      () => correrARotinaDosEscolhidos(),
      (a) => ({ ok: a.falhas.length === 0, motivo: mexeu(a) ? resumoDaRotinaSemResposta(a) : null }),
    );
    if (mexeu(r)) {
      await registarSemFalhar({
        acontecimento: "horas_marcadas",
        autorTipo: "sistema",
        autorNome: "escolhidos sem resposta",
        resumo: resumoDaRotinaSemResposta(r),
      });
    }
    return NextResponse.json({ ok: true, ...r, resumo: resumoDaRotinaSemResposta(r) });
  } catch (error) {
    console.error("[cron/escolhidos-sem-resposta]", error);
    return NextResponse.json({ error: "Falhou" }, { status: 500 });
  }
}
