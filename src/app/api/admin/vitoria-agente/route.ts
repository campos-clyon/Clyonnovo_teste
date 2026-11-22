import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { mudarInterruptorDoEnsaio, mudarTectoDiario, termometro } from "@/lib/vitoria-agente/na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A VITÓRIA AGENTE NAS CONFIGS — d85, fase 0 (22-11-2026).
 *
 * GET: o termómetro — o interruptor do ensaio, se a chave existe (e porquê,
 * se não), o tecto diário, o gasto de hoje e do mês, os tokens (com os da
 * cache lidos) e as últimas chamadas. Só lê.
 *
 * POST: liga ou desliga o ensaio (DESLIGADO por omissão; para LIGAR
 * escreve-se «LIGAR»), ou muda o tecto diário em dólares. Só o
 * administrador. A mudança do interruptor fica no registo permanente.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  return NextResponse.json(await termometro());
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { ligar?: unknown; confirmacao?: unknown; tecto?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const porQuem = colab?.nome?.trim() || "administrador";
  try {
    if (corpo.tecto !== undefined) {
      await mudarTectoDiario(corpo.tecto, porQuem);
      return NextResponse.json(await termometro());
    }
    if (typeof corpo.ligar !== "boolean") {
      return NextResponse.json({ error: "Falta dizer se é para ligar ou desligar." }, { status: 400 });
    }
    if (corpo.ligar && String(corpo.confirmacao ?? "").trim().toUpperCase() !== "LIGAR") {
      return NextResponse.json({ error: "Para ligar, escreva LIGAR." }, { status: 400 });
    }
    await mudarInterruptorDoEnsaio(corpo.ligar, porQuem);
    return NextResponse.json(await termometro());
  } catch (e) {
    console.error("[admin/vitoria-agente POST]", e);
    const tecto = e instanceof Error && e.message === "tecto inválido";
    return NextResponse.json(
      { error: tecto ? "O tecto é um valor em dólares entre 0 e 100." : "Não foi possível guardar." },
      { status: tecto ? 400 : 500 },
    );
  }
}
