import { NextRequest, NextResponse } from "next/server";
import { approveSimulatorOrder, getSimulatorOrderById, setOrcamentoToken } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import { sendOrcamentoEmail } from "@/lib/email-orcamento";
import { contaDoCliente } from "@/lib/taxas-plataforma";

export const runtime = "nodejs";

// POST /api/admin/pedidos/approve
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const body = await req.json();
  const { id, precoFinal, mensagemCliente, notasInternas } = body;
  if (!id || !precoFinal) return NextResponse.json({ error: "id e precoFinal obrigatórios" }, { status: 400 });
  // Um assistente que aprova um pedido sem responsável passa a ser o responsável.
  await assumirPedidoSeLivre(Number(id), colab);

  await approveSimulatorOrder(Number(id), {
    precoFinal: Number(precoFinal),
    // Com factura, pela conta de todos — e não × 1,23 à mão. Ver a rota
    // `pedidos/[id]/approve`, que é a que o ecrã usa (29-09-2026).
    precoFinalIva: contaDoCliente(Number(precoFinal)).total,
    mensagemCliente: mensagemCliente ?? "",
    notasInternas: notasInternas ?? undefined,
    reviewedBy: { id: colab!.id, nome: colab!.nome, role: colab!.papel },
  });

  const order = await getSimulatorOrderById(Number(id));

  // Enviar email de orçamento ao cliente (assíncrono — não bloqueia a resposta)
  if (order?.contactEmail) {
    const token = await setOrcamentoToken(Number(id));
    sendOrcamentoEmail({
      to:              order.contactEmail,
      clienteName:     order.contactName ?? "Cliente",
      serviceType:     order.serviceType ?? null,
      address:         order.address ?? null,
      description:     order.description ?? null,
      precoFinal:      Number((order as any).precoFinal ?? precoFinal),
      pedidoCriadoEm:  order.createdAt ?? null,
      dataAgendada:    (order as any).scheduledDate ?? (order as any).dataAgendada ?? null,
      token,
      orderId:         Number(id),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, order });
}
