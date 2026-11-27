import { NextRequest, NextResponse, after } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { getSimulatorOrderById } from "@/lib/db";
import { depoisDeOClienteEscrever, responderAClyon } from "@/lib/conversa-com-a-clyon";
import { convidadoDoPedido } from "@/lib/sessao-de-convidado";

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

  const { id } = await params;
  const pedidoId = /^\d{1,10}$/.test(id) ? Number(id) : NaN;
  const email = await emailDoCliente(req);
  // Sem conta: a sessão de convidado DESTE pedido (S16).
  const convidado = !email && Number.isInteger(pedidoId) ? await convidadoDoPedido(req, pedidoId) : null;
  if (!email && !convidado) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const porConta = await limitarPorConta("cliente-resposta-conta", email ?? `convidado:${convidado!.sessaoId}`, 10, 3600);
  if (porConta.erro) return porConta.erro;
  let corpo: { mensagem?: unknown; fotografias?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const pedido = Number.isInteger(pedidoId) ? await getSimulatorOrderById(pedidoId) : undefined;
    if (!pedido || (email && (pedido.contactEmail ?? "").trim().toLowerCase() !== email)) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
    }
    /*
     * O limite por pedido conta-se DEPOIS de confirmar de quem é o pedido (d2,
     * 23-11-2026): antes, quem tivesse uma conta qualquer gastava as 20
     * respostas do dia de um pedido que não era seu, e o dono ficava sem poder
     * responder à CLYON.
     */
    const porPedido = await limitarPorConta("cliente-resposta-pedido", `pedido:${pedidoId}`, 20, 86400);
    if (porPedido.erro) return porPedido.erro;
    const quem = convidado ? `Cliente (pela ligação, na app; telemóvel ${convidado.prova8})` : pedido.contactName?.trim() || email!;
    const r = await responderAClyon(pedidoId, { nome: quem }, corpo ?? {});
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    // d140: a Vitória responde no pedido, e a equipa (e o parceiro, se for caso) sabe já.
    const mensagem = typeof corpo?.mensagem === "string" ? corpo.mensagem : "";
    after(() => depoisDeOClienteEscrever(pedidoId, mensagem, r));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cliente/pedidos/resposta]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível enviar a resposta." }, { status: 500 });
  }
}
