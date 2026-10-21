import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { lerAsConversasParadas } from "@/lib/ler-as-conversas";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * A VITÓRIA LÊ AS CONVERSAS PARADAS — de 15 em 15 minutos (21-10-2026).
 *
 * Ver `ler-as-conversas.ts`: lê as que têm novidades e estão paradas há duas
 * horas, e fecha sozinha as que acabaram, com o porquê. Nunca escreve ao
 * cliente.
 */

export const runtime = "nodejs";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/ler-conversas] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const r = await lerAsConversasParadas();
    if (r.fechadas > 0) {
      await registarSemFalhar({
        acontecimento: "assistente_alerta",
        autorTipo: "assistente",
        autorNome: "leitura das conversas",
        resumo: `A Vitória leu ${r.lidas} conversa(s) e fechou ${r.fechadas}; ficam ${r.porLer} por ler.`,
        detalhe: { linhas: r.linhas.slice(0, 40) },
      });
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[cron/ler-conversas]", error);
    return NextResponse.json({ error: "Erro na leitura das conversas" }, { status: 500 });
  }
}
