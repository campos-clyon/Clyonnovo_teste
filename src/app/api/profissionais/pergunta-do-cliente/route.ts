import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";

export const runtime = "nodejs";

/**
 * A PERGUNTA DO CLIENTE, NO PAINEL DO PARCEIRO — 23-11-2026 (d97).
 *
 * Quando um cliente escolhe a proposta dele com uma condição («até quinta»,
 * «só de manhã»), a Vitória pergunta-lhe pelo WhatsApp dos avisos e pela app.
 * Aqui ele vê as perguntas em aberto (GET) e responde SIM / NÃO, e quando
 * (POST) — a resposta segue para o cliente pelo mesmo caminho da do WhatsApp.
 *
 * O `providerId` vem da sessão e NUNCA do corpo: só se responde às suas.
 */
export async function GET(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const { perguntasAbertasDoParceiro } = await import("@/lib/vitoria-agente/pergunta-ao-parceiro-na-base");
    return NextResponse.json({ perguntas: await perguntasAbertasDoParceiro(sessao.providerId) });
  } catch (error) {
    console.error("[profissionais/pergunta-do-cliente GET]", error);
    // Sem as perguntas, o painel fica como antes.
    return NextResponse.json({ perguntas: [] });
  }
}

export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const perguntaId = Number(corpo.perguntaId);
  const resposta = corpo.resposta === "sim" ? "sim" : corpo.resposta === "nao" ? "nao" : null;
  if (!Number.isInteger(perguntaId) || perguntaId <= 0 || !resposta) {
    return NextResponse.json({ error: "Escolha SIM ou NÃO." }, { status: 400 });
  }
  const quando = typeof corpo.quando === "string" ? corpo.quando : null;
  try {
    const { respostaDoParceiroPeloPainel } = await import("@/lib/vitoria-agente/pergunta-ao-parceiro-na-base");
    const r = await respostaDoParceiroPeloPainel(sessao.providerId, perguntaId, resposta, quando);
    if (!r.ok) return NextResponse.json({ error: r.porque }, { status: r.estado });
    return NextResponse.json({ ok: true, texto: r.texto });
  } catch (error) {
    console.error("[profissionais/pergunta-do-cliente POST]", error);
    return NextResponse.json({ error: "Não foi possível guardar a resposta." }, { status: 500 });
  }
}
