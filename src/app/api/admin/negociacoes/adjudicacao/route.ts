import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { linkParaQuemFechou } from "@/lib/link-de-quem-fecha-pelo-whatsapp";
import { lerMotivoDosDadosDoDono } from "@/lib/mensagem-de-adjudicacao";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { linkParaPagar } from "@/lib/valores-para-pagamento";

export const runtime = "nodejs";

/**
 * PREPARAR A ADJUDICAÇÃO — 03-11-2026 (d15, «Pagamento só pela plataforma»).
 *
 * O «Enviar adjudicação» abre o WhatsApp de quem está ao backoffice com a
 * mensagem escrita; não a manda. O que precisa do servidor é isto:
 *
 *   · O LINK DO PEDIDO (marcado por omissão): onde o cliente paga por MB WAY,
 *     Multibanco ou transferência — o mesmo do «Enviar valores para
 *     pagamento» (d19), com o `?pagar=1` da d20. O token só existe em hash:
 *     gera-se um novo, e o anterior deixa de funcionar (fica no histórico).
 *     Quem já tem conta com o email do pedido vai para a conta.
 *   · OS DADOS DO DONO, só com um motivo escrito, como no «sem factura». O
 *     motivo fica no histórico do pedido, com quem o escreveu.
 *
 * Não envia nada a ninguém e não gera referências do euPago (essas são da
 * rota de sempre, /api/admin/pagamentos/criar).
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; comLink?: unknown; dadosDoDono?: unknown; motivoDosDadosDoDono?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Negociação não indicada." }, { status: 400 });
  }
  const comLink = corpo.comLink === true;
  const dadosDoDono = corpo.dadosDoDono === true;
  const motivo = dadosDoDono ? lerMotivoDosDadosDoDono(corpo.motivoDosDadosDoDono) : null;
  if (motivo && !motivo.ok) return NextResponse.json({ error: motivo.erro }, { status: 400 });
  if (!comLink && !dadosDoDono) return NextResponse.json({ ok: true, link: null });

  const { getPool, appendOrderHistory, existeContaComEmail, substituirTokenDoPedido } = await import("@/lib/db");
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível." }, { status: 503 });
  const [linhas] = (await pool.execute(
    `SELECT n.pedidoId, n.estado, o.contactEmail, o.status
       FROM negociacoes n JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.id = ? LIMIT 1`,
    [negociacaoId],
  )) as [Array<{ pedidoId: number; estado: string; contactEmail: string | null; status: string | null }>, unknown];
  const n = linhas[0];
  if (!n) return NextResponse.json({ error: "Negociação não encontrada." }, { status: 404 });
  if (n.estado !== "acordada" || n.status === "cancelado") {
    return NextResponse.json({ error: "Só se adjudica um trabalho contratado." }, { status: 409 });
  }
  const pedidoId = Number(n.pedidoId);
  const por = colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null;

  let link: string | null = null;
  if (comLink) {
    const gerado = await linkParaQuemFechou(pedidoId, {
      emailDoPedido: async () => (typeof n.contactEmail === "string" && n.contactEmail.trim()) || null,
      existeContaComEmail,
      substituirTokenDoPedido,
      site: urlDeAccaoDoPedido(req.headers),
    });
    if (!gerado) return NextResponse.json({ error: "Não foi possível gerar o link do pedido." }, { status: 500 });
    link = linkParaPagar(gerado);
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: por,
      message: gerado.endsWith("/conta")
        ? "Adjudicação preparada com o pagamento pela plataforma (a conta do cliente)."
        : "Adjudicação preparada com o link do pedido, para o cliente pagar pela plataforma. O link anterior deixou de funcionar.",
    });
  }
  if (motivo?.ok) {
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: por,
      message: `Adjudicação com os dados de pagamento do dono (Configs), e não pela plataforma. Motivo: «${motivo.motivo}».`,
    });
  }
  return NextResponse.json({ ok: true, link });
}
