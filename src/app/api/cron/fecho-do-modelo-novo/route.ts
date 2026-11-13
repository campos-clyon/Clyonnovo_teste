import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { correrOFechoDoModeloNovo, resumoDoFecho } from "@/lib/fecho-do-modelo-novo-na-base";
import { bearerConfere } from "@/lib/segredo-igual";

export const runtime = "nodejs";

/**
 * «O TRABALHO JÁ FOI FEITO?» POR EMAIL — d15, 13-11-2026.
 *
 * De hora a hora, os trabalhos do modelo de 15-11 com a data passada há 48 h e
 * sem «Está feito» recebem UM email com o link de um toque. SÓ com o
 * interruptor das Configs ligado (desligado por omissão), só depois de 15-11, e
 * só das 08h às 21h de Lisboa. Desligado, conta e não envia nada. A Mesa, o
 * aviso à equipa e a pergunta na página do pedido não dependem desta rotina.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/fecho-do-modelo-novo] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const r = await carimbarPassagem(
      "fecho-do-modelo-novo",
      () => correrOFechoDoModeloNovo(),
      (a) => ({ ok: a.falhas.length === 0, motivo: a.enviados.length > 0 || a.falhas.length > 0 ? resumoDoFecho(a) : null }),
    );
    if (r.enviados.length > 0 || r.falhas.length > 0) {
      await registarSemFalhar({
        acontecimento: "fecho_perguntado",
        autorTipo: "sistema",
        autorNome: "fecho do modelo novo",
        resumo: resumoDoFecho(r),
        detalhe: { enviados: r.enviados, falhas: r.falhas.slice(0, 10) },
      });
    }
    return NextResponse.json({ ok: true, ...r, resumo: resumoDoFecho(r) });
  } catch (error) {
    console.error("[cron/fecho-do-modelo-novo]", error);
    return NextResponse.json({ error: "Falhou" }, { status: 500 });
  }
}
