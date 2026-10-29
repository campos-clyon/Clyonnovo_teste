import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { pedidoDoClienteParaAApp, pedidoDoConvidadoParaAApp } from "@/lib/pedidos-do-cliente";
import { convidadoDoPedido } from "@/lib/sessao-de-convidado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * R5 — O PEDIDO NA APP DE CLIENTE (d8, 28-10-2026).
 *
 * Os mesmos dados da página do pedido (`VistaDoPedido.tsx`): as negociações
 * pela mesma função (`negociacoesDaVistaDoCliente` → `negociacoesParaOCliente`
 * → `negociacaoParaAVista`), o histórico pela lista fechada
 * (`historicoParaOCliente`) — e o dinheiro já escrito em texto, com IVA e o
 * sem IVA ao lado, para a app não fazer contas. O valor do profissional, a
 * taxa de quem quer que seja e as notas internas nunca saem daqui.
 *
 * Só com sessão de cliente, e só um pedido do email da sessão: «não existe» e
 * «não é seu» dão o mesmo 404. As acções vão por `/api/users/me/negociacao`
 * (a mesma `agirComoCliente` do link do email).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limite = await limitarRotaPublica(req, "cliente-pedido", 240, 300);
  if (limite.erro) return limite.erro;

  const { id } = await params;
  const pedidoId = /^\d{1,10}$/.test(id) ? Number(id) : NaN;
  const email = await emailDoCliente(req);
  if (!email) {
    // O link aberto na app sem conta (S16): só ESTE pedido, pela vista própria do convidado.
    const convidado = Number.isInteger(pedidoId) ? await convidadoDoPedido(req, pedidoId) : null;
    if (!convidado) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    try {
      const vista = await pedidoDoConvidadoParaAApp(pedidoId);
      if (!vista) return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true, ...vista }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      console.error("[cliente/pedidos/[id]] convidado:", err instanceof Error ? err.message : err);
      return NextResponse.json({ ok: false, error: "Não foi possível ler o pedido." }, { status: 500 });
    }
  }
  try {
    const vista = await pedidoDoClienteParaAApp(pedidoId, email);
    if (!vista) return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, ...vista }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cliente/pedidos/[id]]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível ler o pedido." }, { status: 500 });
  }
}
