import { NextRequest, NextResponse } from "next/server";
import { approveSimulatorOrder, getSimulatorOrderById, updateSimulatorOrder, setOrcamentoToken } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import { sendOrcamentoEmail } from "@/lib/email-orcamento";
import { contaDoCliente } from "@/lib/taxas-plataforma";
import { lerPrecoDoOrcamento, porqueNaoSeAprova } from "@/lib/aprovar-orcamento";

export const runtime = "nodejs";

// POST /api/admin/pedidos/[id]/approve
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const { precoFinal: precoEscrito, mensagemCliente, notasInternas } = body as Record<string, string | undefined>;

  /*
   * O PREÇO E O ESTADO, ANTES DE QUALQUER ESCRITA — 10-11-2026 (d27). Ver
   * `aprovar-orcamento.ts`: um preço que não é número (ou negativo) não
   * segue para o email, e um pedido cancelado, arquivado ou concluído não
   * volta a «aprovado».
   */
  const idDoPedido = Number(id);
  if (!Number.isInteger(idDoPedido) || idDoPedido <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const temPreco = precoEscrito != null && String(precoEscrito).trim() !== "";
  const preco = temPreco ? lerPrecoDoOrcamento(precoEscrito) : null;
  if (preco && !preco.ok) return NextResponse.json({ error: preco.erro }, { status: 400 });
  const precoFinal = preco?.ok ? preco.preco : null;
  const antes = await getSimulatorOrderById(idDoPedido);
  if (!antes) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  const recusa = porqueNaoSeAprova(antes.status);
  if (recusa) return NextResponse.json({ error: recusa }, { status: 409 });

  // Um assistente que aprova um pedido sem responsável passa a ser o responsável.
  await assumirPedidoSeLivre(idDoPedido, colab);

  // Se precoFinal fornecido usa approveSimulatorOrder, senão apenas muda status
  if (precoFinal != null) {
    const gravou = await approveSimulatorOrder(Number(id), {
      precoFinal: Number(precoFinal),
      /*
       * O PREÇO COM FACTURA, FEITO PELA CONTA DE TODOS — 29-09-2026.
       *
       * Era `precoFinal × 1,23`, à mão: sem a taxa da plataforma e com um
       * arredondamento só dele. O email e a página do orçamento passaram a
       * dizer o preço com a taxa e, à parte, o que acresce com factura — os
       * dois de `contaDoCliente`. A coluna tem de dizer o mesmo número que o
       * cliente leu, e por isso também sai daí (e já não do campo do ecrã,
       * que o fazia à mão do lado do navegador).
       */
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
      // O preço sem IVA e sem a taxa: o email faz o resto com as contas de todos.
      precoFinal:    Number((order as any).precoFinal ?? precoFinal ?? 0),
      pedidoCriadoEm: order.createdAt ?? null,
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
