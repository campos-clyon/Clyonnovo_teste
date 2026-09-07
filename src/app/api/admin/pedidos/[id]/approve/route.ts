import { NextRequest, NextResponse } from "next/server";
import { approveSimulatorOrder, getSimulatorOrderById, updateSimulatorOrder, setOrcamentoToken } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import { sendOrcamentoEmail } from "@/lib/email-orcamento";

export const runtime = "nodejs";

// POST /api/admin/pedidos/[id]/approve
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;
  // Um assistente que aprova um pedido sem responsável passa a ser o responsável.
  await assumirPedidoSeLivre(Number(id), colab);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const { precoFinal, precoFinalIva, mensagemCliente, notasInternas } = body as Record<string, string | undefined>;

  // Se precoFinal fornecido usa approveSimulatorOrder, senão apenas muda status
  if (precoFinal) {
    await approveSimulatorOrder(Number(id), {
      precoFinal: Number(precoFinal),
      precoFinalIva: Number(precoFinalIva ?? Number(precoFinal) * 1.23),
      mensagemCliente: mensagemCliente ?? "",
      notasInternas: notasInternas ?? undefined,
      reviewedBy: { id: colab!.id, nome: colab!.nome, role: colab!.papel },
    });
  } else {
    await updateSimulatorOrder(Number(id), { status: "aprovado" } as Parameters<typeof updateSimulatorOrder>[1]);
  }

  const order = await getSimulatorOrderById(Number(id));

  // Enviar email de orçamento ao cliente (assíncrono — não bloqueia a resposta)
  if (order?.contactEmail) {
    const token = await setOrcamentoToken(Number(id));
    sendOrcamentoEmail({
      to:            order.contactEmail,
      clienteName:   order.contactName ?? "Cliente",
      serviceType:   order.serviceType ?? null,
      address:       order.address ?? null,
      description:   order.description ?? null,
      precoFinalIva: Number((order as any).precoFinalIva ?? Number(precoFinal ?? 0) * 1.23),
      dataAgendada:  (order as any).scheduledDate ?? (order as any).dataAgendada ?? null,
      token,
      orderId:       Number(id),
    }).catch(() => {});
  }

  // Aqui saía um email para os parceiros activos que cobrissem a cidade,
  // com link para /parceiros/dashboard. O portal foi descontinuado e o link
  // dava 404 — um email nosso a mandar pessoas para uma página que não
  // existe é pior do que email nenhum.

  return NextResponse.json({ ok: true, order });
}
