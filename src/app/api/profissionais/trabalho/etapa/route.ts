import { NextRequest, NextResponse, after } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import {
  appendOrderHistory,
  negociacaoNoTerreno,
  registarEtapaNoTerreno,
  registarSemFalhar,
} from "@/lib/db";
import { avisarClienteDaEtapa } from "@/lib/avisos-do-terreno";

export const runtime = "nodejs";

/**
 * «A CAMINHO» E «CHEGUEI» — a app do profissional, 18-10-2026.
 *
 * O profissional carrega no botão e o cliente recebe um WhatsApp na hora
 * (decisão do dono: os dois avisam). Fica registado com a hora, no histórico
 * do pedido e no registo do backoffice.
 *
 * Só no trabalho dele, fechado e ainda por dar por feito. Um segundo toque não
 * avisa outra vez: a escrita só acontece da primeira (ver
 * `registarEtapaNoTerreno`).
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { negociacaoId?: unknown; etapa?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const etapa = corpo.etapa === "a_caminho" ? "a_caminho" : corpo.etapa === "chegou" ? "chegou" : null;
  if (!etapa) return NextResponse.json({ error: "Etapa desconhecida." }, { status: 400 });

  try {
    const n = await negociacaoNoTerreno(negociacaoId);
    if (!n || Number(n.providerId) !== sessao.providerId) {
      return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    }
    if (n.estado !== "acordada" || n.execucaoEnviadaEm) {
      return NextResponse.json({ error: "Este trabalho já não está por fazer." }, { status: 409 });
    }

    const primeiraVez = await registarEtapaNoTerreno(negociacaoId, sessao.providerId, etapa);
    if (primeiraVez) {
      after(async () => {
        const texto = etapa === "a_caminho" ? "saiu a caminho do cliente" : "chegou à morada do cliente";
        await appendOrderHistory(n.pedidoId, { type: "created", message: `${sessao.nome} ${texto}.` }).catch(() => {});
        await registarSemFalhar({
          acontecimento: etapa === "a_caminho" ? "a_caminho" : "chegou_ao_local",
          pedidoId: n.pedidoId,
          negociacaoId,
          providerId: sessao.providerId,
          providerNome: sessao.nome,
          autorTipo: "profissional",
          autorNome: sessao.nome,
          resumo: `${sessao.nome} ${texto}.`,
        });
        await avisarClienteDaEtapa(n, etapa);
      });
    }
    return NextResponse.json({ ok: true, primeiraVez });
  } catch (error) {
    console.error("[profissionais/trabalho/etapa]", error);
    return NextResponse.json({ error: "Não foi possível registar." }, { status: 500 });
  }
}
