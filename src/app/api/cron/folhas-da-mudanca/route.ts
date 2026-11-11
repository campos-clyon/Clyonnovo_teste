import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { correrARotinaDasFolhas, resumoDaRotinaDasFolhas } from "@/lib/folha-no-servidor";
import { bearerConfere } from "@/lib/segredo-igual";

export const runtime = "nodejs";

/**
 * A FOLHA DA MUDANÇA SEM RESPOSTA DO CLIENTE — 11-11-2026.
 *
 * De hora a hora: uma folha enviada há 2 h sem resposta leva um lembrete ao
 * cliente; há 24 h, outro; há 48 h vai à Mesa como «Folha por confirmar».
 * Nunca se confirma sozinha. A regra é `passoDaFolha` (folha-da-mudanca.ts);
 * o trabalho, `correrARotinaDasFolhas` (folha-no-servidor.ts).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/folhas-da-mudanca] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const r = await carimbarPassagem(
      "folhas-da-mudanca",
      () => correrARotinaDasFolhas(),
      (a) => ({ ok: a.falhados === 0, motivo: a.lembretes > 0 || a.mesa > 0 || a.falhados > 0 ? resumoDaRotinaDasFolhas(a) : null }),
    );
    if (r.lembretes > 0 || r.mesa > 0 || r.falhados > 0) {
      await registarSemFalhar({
        acontecimento: "horas_marcadas",
        autorTipo: "sistema",
        autorNome: "folhas da mudança",
        resumo: resumoDaRotinaDasFolhas(r),
      });
    }
    return NextResponse.json({ ok: true, ...r, resumo: resumoDaRotinaDasFolhas(r) });
  } catch (error) {
    console.error("[cron/folhas-da-mudanca]", error);
    return NextResponse.json({ error: "Falhou" }, { status: 500 });
  }
}
