import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { getSimulatorOrderById } from "@/lib/db";
import { marcarComoRealizado, pagosDosDoisLadosPorRealizar } from "@/lib/fecho-automatico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «PAGOS DOS DOIS LADOS, AINDA NÃO REALIZADOS» — d76 (CEO e dono, 20-11-2026).
 *
 * Os pedidos com o cliente e o profissional pagos que ficaram por fechar (os
 * de antes do fecho automático, como o #505). Não se mudam por script: o dono
 * fecha cada um aqui, com um clique.
 *
 * GET — só lê. POST — marca UM como realizado, pelo mesmo fecho do
 * «Realizado» (`marcarComoRealizado`), com a regra relida na hora. Os dois só
 * do administrador.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const lista = await pagosDosDoisLadosPorRealizar();
    return NextResponse.json({ ok: true, lista });
  } catch (e) {
    console.error("[admin/pagamentos/pagos-dos-dois-lados GET]", e);
    return NextResponse.json({ error: "Não foi possível ler a lista." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido não indicado." }, { status: 400 });
  }

  try {
    // Só o que a lista mostra: pago dos dois lados, por realizar, fora dos de teste e dos arrumados.
    const naLista = (await pagosDosDoisLadosPorRealizar()).some((l) => l.pedidoId === pedidoId);
    if (!naLista) {
      const p = await getSimulatorOrderById(pedidoId);
      return NextResponse.json(
        {
          error:
            p?.status === "concluido"
              ? "Este pedido já está realizado."
              : "Este pedido já não está pago dos dois lados por realizar. Recarregue a lista.",
        },
        { status: 409 },
      );
    }
    const feito = await marcarComoRealizado(pedidoId, { origem: "admin", colab });
    if (!feito) return NextResponse.json({ error: "O pedido mudou entretanto. Recarregue a lista." }, { status: 409 });
    return NextResponse.json({ ok: true, pedidoId });
  } catch (e) {
    console.error("[admin/pagamentos/pagos-dos-dois-lados POST]", e);
    return NextResponse.json({ error: "Não foi possível marcar como realizado." }, { status: 500 });
  }
}
