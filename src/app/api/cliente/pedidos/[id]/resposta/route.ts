import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { getSimulatorOrderById } from "@/lib/db";
import { responderAClyon } from "@/lib/conversa-com-a-clyon";

export const runtime = "nodejs";

/**
 * R14 — O CLIENTE RESPONDE À CLYON PELA APP (S18, 29-10-2026).
 *
 * `{ mensagem, fotografias? }`, com a sessão da app, num pedido do email da
 * sessão («não existe» e «não é seu» dão o mesmo 404). Grava pela mesma função
 * da conta do site (`responderAClyon`): um só sítio grava a resposta, e a Mesa
 * vê-a com o selo das respostas por ler. As fotografias só do nosso
 * armazenamento, com tecto por pedido.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limite = await limitarRotaPublica(req, "cliente-resposta", 30, 300);
  if (limite.erro) return limite.erro;

  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const porConta = await limitarPorConta("cliente-resposta-conta", email, 10, 3600);
  if (porConta.erro) return porConta.erro;

  const { id } = await params;
  const pedidoId = /^\d{1,10}$/.test(id) ? Number(id) : NaN;
  let corpo: { mensagem?: unknown; fotografias?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const pedido = Number.isInteger(pedidoId) ? await getSimulatorOrderById(pedidoId) : undefined;
    if (!pedido || (pedido.contactEmail ?? "").trim().toLowerCase() !== email) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
    }
    const r = await responderAClyon(pedidoId, { nome: pedido.contactName?.trim() || email }, corpo ?? {});
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cliente/pedidos/resposta]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível enviar a resposta." }, { status: 500 });
  }
}
