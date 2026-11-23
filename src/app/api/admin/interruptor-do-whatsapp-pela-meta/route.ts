import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDaMeta, mudarInterruptorDaMeta } from "@/lib/whatsapp-pela-meta";
import { whatsappConfigurado } from "@/lib/whatsapp-cloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR «WHATSAPP PELA META», NAS CONFIGS — d5, 21-11-2026.
 *
 * DESLIGADO POR OMISSÃO: com as quatro variáveis da Cloud API na Vercel, os
 * envios só passam para a Meta com isto ligado; desligado, seguem pela ponte.
 * A Cloud API não envia templates — ligar antes de os templates estarem
 * aprovados deixa os lembretes fora das 24 h por entregar. Só o administrador,
 * e para LIGAR escreve-se «LIGAR». Cada mudança fica no registo permanente.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json({ ...(await interruptorDaMeta()), variaveisNaVercel: whatsappConfigurado() });
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { ligar?: unknown; confirmacao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (typeof corpo.ligar !== "boolean") {
    return NextResponse.json({ error: "Falta dizer se é para ligar ou desligar." }, { status: 400 });
  }
  if (corpo.ligar && String(corpo.confirmacao ?? "").trim().toUpperCase() !== "LIGAR") {
    return NextResponse.json({ error: "Para ligar, escreva LIGAR." }, { status: 400 });
  }
  try {
    const estado = await mudarInterruptorDaMeta(corpo.ligar, colab?.nome?.trim() || "administrador");
    return NextResponse.json({ ...estado, variaveisNaVercel: whatsappConfigurado() });
  } catch (e) {
    console.error("[admin/interruptor-do-whatsapp-pela-meta]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
