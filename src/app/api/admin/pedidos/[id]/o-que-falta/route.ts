import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { appendOrderHistory, getSimulatorOrderById } from "@/lib/db";
import { oQueFaltaNoPedido, type PedidoParaOQueFalta } from "@/lib/o-que-falta-no-pedido";
import { linhaDaFalta, registoDoQueFalta, type CanalDoPedido } from "@/lib/mensagem-do-que-falta";
import { pedirMaisDetalhes } from "@/lib/conversa-com-a-clyon";

export const runtime = "nodejs";

/**
 * POST /api/admin/pedidos/[id]/o-que-falta — { canal: "whatsapp" | "email" | "copiar" }
 *
 * O «PEDIR O QUE FALTA» FICA NO HISTÓRICO DO PEDIDO — 26-10-2026 (d31).
 *
 * O botão do «Por decidir» abre o WhatsApp ou o email do cliente com a
 * mensagem pronta (`mensagem-do-que-falta.ts`). Esta rota NÃO ENVIA NADA:
 * quem envia é a pessoa da equipa, no WhatsApp ou no programa de email dela.
 * Aqui só se escreve no histórico quem pediu, por onde e o quê — a lista,
 * contada outra vez a partir do pedido (`oQueFaltaNoPedido`), e nunca a
 * mensagem inteira. O quando é o da entrada.
 *
 * DESDE 29-10-2026 (S18) é também o mesmo que «Pedir info»: o pedido fica em
 * «precisa info» e o que falta chega ao cliente na conta, no link e na app
 * (`pedirMaisDetalhes`). Sem o aviso por fora: a mensagem já sai pela mão da
 * equipa, no WhatsApp ou no email dela.
 */
const CANAIS: readonly CanalDoPedido[] = ["whatsapp", "email", "copiar"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const pedidoId = Number(id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  let canal: CanalDoPedido | null = null;
  try {
    const corpo = (await req.json()) as { canal?: unknown };
    canal = CANAIS.find((c) => c === corpo?.canal) ?? null;
  } catch {
    /* sem corpo: cai no 400 de baixo */
  }
  if (!canal) return NextResponse.json({ error: "Diga por onde: whatsapp, email ou copiar." }, { status: 400 });

  try {
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    const faltas = oQueFaltaNoPedido(pedido as unknown as PedidoParaOQueFalta);
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: registoDoQueFalta(colab?.nome, canal, faltas, (pedido as { serviceType?: string | null }).serviceType),
    });
    if (faltas.length > 0) {
      const servico = (pedido as { serviceType?: string | null }).serviceType;
      await pedirMaisDetalhes(
        pedidoId,
        ["Para enviar o pedido aos profissionais, falta:", ...faltas.map((f) => `- ${linhaDaFalta(f, servico)}`)].join("\n"),
        colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
        { semAvisoPorFora: true },
      );
    }
    return NextResponse.json({ ok: true, faltas });
  } catch (e) {
    console.error("[admin/pedidos/o-que-falta]", e);
    return NextResponse.json({ error: "Não foi possível registar no histórico." }, { status: 500 });
  }
}
