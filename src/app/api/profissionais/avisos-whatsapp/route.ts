import { NextRequest, NextResponse } from "next/server";
import { definirAvisosNoWhatsApp } from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";

export const runtime = "nodejs";

/**
 * O SIM — E O NÃO — DELE AOS AVISOS DE PEDIDO NOVO NO WHATSAPP.
 *
 * "Só ele, no painel" — 20-09-2026, sobre quem pode ligar isto.
 *
 * ── PORQUE É QUE ISTO É UMA ROTA À PARTE, E NÃO UM CAMPO DO PERFIL ────────
 *
 * Porque não é um dado: é um CONSENTIMENTO. O PUT do perfil grava dezassete
 * campos de uma vez e um ecrã pode tocar-lhe sem querer ao gravar outra coisa
 * qualquer — e um consentimento que se liga por efeito secundário de gravar a
 * morada fiscal não é consentimento nenhum. Aqui há um pedido, um campo, uma
 * intenção, e uma data gravada.
 *
 * ── E PORQUE É QUE O BACKOFFICE NÃO TEM ISTO ──────────────────────────────
 *
 * Porque foi decidido que não tem, e a razão vale a pena ficar escrita: o dono
 * podia ligar os avisos a toda a gente num minuto e ter a funcionalidade a
 * funcionar hoje. Mas o telefone dele foi recolhido na inscrição como CONTACTO
 * DE TRABALHO — para lhe ligarmos, ou para o cliente lhe ligar depois de
 * contratado. Usá-lo para lhe mandar mensagens é outra finalidade, e uma
 * finalidade nova precisa do sim de quem é dono do número. Um sim que outra
 * pessoa dá por ele não é defensável à frente de ninguém — nem da CNPD, nem do
 * próprio quando ligar zangado.
 *
 * O `providerId` vem da sessão e NUNCA do corpo. Se viesse do corpo, bastava
 * mudar um número para ligar avisos em nome de outro profissional — que é
 * exactamente o consentimento falsificado que isto existe para impedir.
 */
export async function PUT(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  /*
   * Só `true` liga. Qualquer outra coisa desliga — incluindo um corpo
   * estragado, um `"sim"` em texto ou um campo em falta. Na dúvida sobre um
   * consentimento, a resposta é não: ligar por engano manda mensagens a quem
   * não as pediu, desligar por engano não faz mal a ninguém.
   */
  const quer = corpo.quer === true;

  try {
    await definirAvisosNoWhatsApp(sessao.providerId, quer);
    return NextResponse.json({ ok: true, avisosNoWhatsApp: quer });
  } catch (error) {
    console.error("[profissionais/avisos-whatsapp PUT]", error);
    return NextResponse.json({ error: "Não foi possível guardar" }, { status: 500 });
  }
}
