import { NextRequest, NextResponse } from "next/server";
import { approveSimulatorOrder, getSimulatorOrderById, updateSimulatorOrder, setOrcamentoToken } from "@/lib/db";
import { verifyColaboradorAuthHeader } from "@/lib/colaborador-auth";
import { sendOrcamentoEmail } from "@/lib/email-orcamento";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  const colab = await verifyColaboradorAuthHeader(req.headers.get("authorization"));
  if (!colab) return { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null };
  if (!colab.isAdmin) return { err: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), colab: null };
  return { err: null, colab };
}

// POST /api/admin/pedidos/[id]/approve
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

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
      reviewedBy: { id: colab!.id, nome: colab!.nome, role: "admin" },
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

  return NextResponse.json({ ok: true, order });
}
