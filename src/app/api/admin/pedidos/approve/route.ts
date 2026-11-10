import { NextRequest, NextResponse } from "next/server";
import { approveSimulatorOrder, getSimulatorOrderById, setOrcamentoToken } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import { sendOrcamentoEmail } from "@/lib/email-orcamento";
import { contaDoCliente } from "@/lib/taxas-plataforma";
import { lerPrecoDoOrcamento, porqueNaoSeAprova } from "@/lib/aprovar-orcamento";

export const runtime = "nodejs";

// POST /api/admin/pedidos/approve
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const { id, precoFinal: precoEscrito, mensagemCliente, notasInternas } = body ?? {};
  if (!id || !precoEscrito) return NextResponse.json({ error: "id e precoFinal obrigatórios" }, { status: 400 });

  // O preço e o estado, antes de qualquer escrita (10-11-2026, d27) — ver `aprovar-orcamento.ts`.
  const idDoPedido = Number(id);
  if (!Number.isInteger(idDoPedido) || idDoPedido <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const preco = lerPrecoDoOrcamento(precoEscrito);
  if (!preco.ok) return NextResponse.json({ error: preco.erro }, { status: 400 });
  const precoFinal = preco.preco;
  const antes = await getSimulatorOrderById(idDoPedido);
  if (!antes) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  const recusa = porqueNaoSeAprova(antes.status);
  if (recusa) return NextResponse.json({ error: recusa }, { status: 409 });

  // Um assistente que aprova um pedido sem responsável passa a ser o responsável.
  await assumirPedidoSeLivre(Number(id), colab);

  const gravou = await approveSimulatorOrder(Number(id), {
    precoFinal: Number(precoFinal),
    // Com factura, pela conta de todos — e não × 1,23 à mão. Ver a rota
    // `pedidos/[id]/approve`, que é a que o ecrã usa (29-09-2026).
    precoFinalIva: contaDoCliente(Number(precoFinal)).total,
    mensagemCliente: mensagemCliente ?? "",
    notasInternas: notasInternas ?? undefined,
    reviewedBy: { id: colab!.id, nome: colab!.nome, role: colab!.papel },
  });
  // Mudou de estado entre a leitura e a escrita: não se aprova, não há email.
  // (Sem gravar e ainda aprovável é a mesma aprovação repetida no mesmo segundo: segue.)
  if (!gravou) {
    const fechouEntretanto = porqueNaoSeAprova((await getSimulatorOrderById(idDoPedido))?.status ?? "cancelado");
    if (fechouEntretanto) return NextResponse.json({ error: fechouEntretanto }, { status: 409 });
  }

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
