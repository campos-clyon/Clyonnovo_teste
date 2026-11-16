import { NextRequest, NextResponse } from "next/server";
import { avisarDoCancelamento } from "@/lib/avisar-cancelamento";
import { gravarMotivoDoFecho, negociacoesDoPedido } from "@/lib/db";
import { exigirMotivoDoFecho } from "@/lib/motivo-do-fecho";
import {
  getSimulatorOrderById,
  updateSimulatorOrder,
  appendOrderHistory,
} from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/reject
 *
 * Arquiva um pedido — passa o status a "arquivado" e liberta a
 * atribuição. Deixa de aparecer na vista "Todos" do backoffice;
 * fica disponível no filtro "Arquivados".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Administrador, ou assistente com a conta activa. Arquivar é a acção
  // normal do dia a dia dos dois — o que o assistente não faz é apagar.
  const { err, colab: jwt } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const orderId = Number(id);

  const order = await getSimulatorOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // O motivo é obrigatório (d54, 16-11-2026): sem ele não se arquiva.
  const corpo = (await req.json().catch(() => null)) as { motivoDoFecho?: unknown; quantoQueriaPagar?: unknown } | null;
  const motivo = exigirMotivoDoFecho(corpo);
  if (!motivo.ok) return NextResponse.json({ error: motivo.erro, precisaDeMotivo: true }, { status: 422 });

  const antesDeArquivar = await negociacoesDoPedido(orderId).catch(() => []);
  try {
    await updateSimulatorOrder(orderId, {
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
      status: "arquivado",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao rejeitar: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  await appendOrderHistory(orderId, {
    type: "archived",
    by: { id: jwt.id, nome: jwt.nome, role: jwt.papel },
    message: `Pedido arquivado por ${jwt.nome}.`,
  });
  await gravarMotivoDoFecho(orderId, motivo.motivo, motivo.quantoQueriaPagar, { id: jwt.id, nome: jwt.nome, role: jwt.papel }).catch((e) =>
    console.error("[reject] motivo:", e instanceof Error ? e.message : e),
  );

  // S19 (BO9): arquivar avisa o cliente e quem tinha proposta ou trabalho, como cancelar.
  await avisarDoCancelamento({ pedidoId: orderId, negociacoes: antesDeArquivar, motivo: null, porQuem: "clyon" });

  const updated = await getSimulatorOrderById(orderId);

  return NextResponse.json({ ok: true, order: updated });
}
