import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDaLinhaDaApp, mudarInterruptorDaLinhaDaApp } from "@/lib/linha-da-app-nas-propostas-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR «A APP NO AVISO DE PROPOSTAS» — d106, 24-11-2026 (secção 0
 * da v3 da d107). DESLIGADO POR OMISSÃO. Só o administrador
 * (`requireAdminGeral`), e para LIGAR escreve-se «LIGAR».
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await interruptorDaLinhaDaApp(), { headers: { "Cache-Control": "no-store" } });
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
    return NextResponse.json(await mudarInterruptorDaLinhaDaApp(corpo.ligar, colab?.nome?.trim() || "administrador"));
  } catch (e) {
    console.error("[admin/interruptor-da-linha-da-app]", e);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
