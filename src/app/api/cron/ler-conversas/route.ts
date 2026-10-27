import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
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
    /*
     * Cada passagem carimbada (27-10-2026, d7): sem chave, com leituras
     * falhadas ou parada pelo relógio, diz-se — dantes só se escrevia quando
     * fechava alguma, e uma Vitória que falhava todas parecia sem trabalho.
     */
    const r = await carimbarPassagem("ler-conversas", () => lerAsConversasParadas(), (p) => ({
      ok: Boolean(process.env.GEMINI_API_KEY) && p.falhas === 0,
      motivo: !process.env.GEMINI_API_KEY
        ? "sem GEMINI_API_KEY — a Vitória não consegue ler"
        : [
            p.falhas > 0 ? `${p.falhas} leitura(s) falharam` : null,
            p.deixadasPeloRelogio > 0 ? `${p.deixadasPeloRelogio} deixada(s) para a passagem seguinte (tempo)` : null,
          ]
            .filter(Boolean)
            .join("; ") || null,
      detalhe: { lidas: p.lidas, fechadas: p.fechadas, falhas: p.falhas, porLer: p.porLer, deixadasPeloRelogio: p.deixadasPeloRelogio },
    }));
    if (r.fechadas > 0 || r.falhas > 0) {
      await registarSemFalhar({
        acontecimento: "assistente_alerta",
        autorTipo: "assistente",
        autorNome: "leitura das conversas",
        resumo:
          `A Vitória leu ${r.lidas} conversa(s) e fechou ${r.fechadas}; ficam ${r.porLer} por ler.` +
          (r.falhas > 0 ? ` ${r.falhas} leitura(s) falharam.` : ""),
        detalhe: { linhas: r.linhas.slice(0, 40) },
      });
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[cron/ler-conversas]", error);
    return NextResponse.json({ error: "Erro na leitura das conversas" }, { status: 500 });
  }
}
