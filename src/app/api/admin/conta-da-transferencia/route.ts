import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { contaDaTransferencia, guardarContaDaTransferencia } from "@/lib/db";
import { LIMITE_DA_TRANSFERENCIA, ibanAgrupado } from "@/lib/transferencia-bancaria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A CONTA PARA A TRANSFERÊNCIA BANCÁRIA — ver e mudar. 02-11-2026.
 *
 * Só o administrador, nos dois sentidos (`requireAdminGeral`): para onde vai o
 * dinheiro do cliente é dinheiro, e o IBAN não se mostra a quem só tem as
 * Configs. Sem conta guardada, o cliente não vê o método.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const conta = await contaDaTransferencia();
    return NextResponse.json({
      conta: conta ? { iban: ibanAgrupado(conta.iban), titular: conta.titular } : null,
      limite: LIMITE_DA_TRANSFERENCIA,
    });
  } catch (error) {
    console.error("[admin/conta-da-transferencia GET]", error);
    return NextResponse.json({ error: "Não foi possível ler a conta." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { iban?: unknown; titular?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const r = await guardarContaDaTransferencia(corpo, colab?.nome ?? "a CLYON");
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });
    return NextResponse.json({
      ok: true,
      conta: r.conta ? { iban: ibanAgrupado(r.conta.iban), titular: r.conta.titular } : null,
    });
  } catch (error) {
    console.error("[admin/conta-da-transferencia PUT]", error);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
