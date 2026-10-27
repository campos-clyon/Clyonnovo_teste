import { NextRequest, NextResponse } from "next/server";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { proporLicoesDoDia } from "@/lib/propor-licoes";
import { bearerConfere } from "@/lib/segredo-igual";

/**
 * AS LIÇÕES DA VITÓRIA — uma vez por dia (27-10-2026, decisão d11).
 *
 * Ver `propor-licoes.ts`: lê as conversas das últimas 24 horas e propõe uma
 * lição em cada sítio onde a equipa teve de entrar. As lições nascem «por
 * rever» — o separador «Lições da Vitória» do WhatsApp. Cada passagem fica
 * carimbada em `passagensDasRotinas` (ok, falhou e porquê). Nunca escreve ao
 * cliente.
 */

export const runtime = "nodejs";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Falha fechada, como os outros crons: sem CRON_SECRET, recusa.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/licoes-da-vitoria] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const r = await carimbarPassagem("licoes-da-vitoria", () => proporLicoesDoDia(), (p) => ({
      ok: p.falhas === 0,
      motivo:
        p.falhas > 0
          ? `${p.falhas} caso(s) falharam`
          : p.semModelo > 0 && !process.env.GEMINI_API_KEY
            ? "sem GEMINI_API_KEY — lições só com a resposta da equipa"
            : null,
      detalhe: p,
    }));
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[cron/licoes-da-vitoria]", error);
    return NextResponse.json({ error: "Erro nas lições da Vitória" }, { status: 500 });
  }
}
