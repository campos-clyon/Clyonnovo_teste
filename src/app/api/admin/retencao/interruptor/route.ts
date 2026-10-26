import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { interruptorDasRegrasNovas, mudarInterruptorDasRegrasNovas } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O INTERRUPTOR DAS REGRAS NOVAS DA RETENÇÃO — 26-10-2026 (d32).
 *
 * *«Só passam a valer a sério quando o dono as ligar (um interruptor nas
 * Configs → Retenção, desligado por omissão, com a data e quem ligou no
 * registo permanente).»*
 *
 * SÓ O ADMINISTRADOR (`requireAdminGeral`): um assistente com a secção Configs
 * vê o ensaio, e não liga nada. E para LIGAR é preciso escrever «LIGAR» — um
 * clique perdido não pode pôr a anonimizar e a apagar uma coisa que não volta.
 * Desligar não pede nada: voltar ao ensaio nunca estraga.
 *
 * ISTO NÃO ARMA A PURGA. A `PURGA_ARMADA` continua na Vercel, com um redeploy
 * pelo meio; este interruptor só escolhe que regras ela segue quando está
 * armada. A mudança e quem a fez ficam no registo permanente, na mesma
 * transacção (`mudarInterruptorDasRegrasNovas`).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await interruptorDasRegrasNovas());
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
    const estado = await mudarInterruptorDasRegrasNovas(corpo.ligar, colab?.nome?.trim() || "administrador");
    return NextResponse.json(estado);
  } catch (error) {
    console.error("[admin/retencao/interruptor]", error);
    return NextResponse.json({ error: "Não foi possível mudar o interruptor." }, { status: 500 });
  }
}
