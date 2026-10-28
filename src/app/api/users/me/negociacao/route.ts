import { NextRequest, NextResponse } from "next/server";
import { clienteDaSessao } from "@/lib/cliente-auth";
import { getSimulatorOrderById } from "@/lib/db";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { agirComoCliente, type CorpoDoCliente } from "@/lib/agir-como-cliente";

export const runtime = "nodejs";

/**
 * O cliente negoceia a partir da conta, com sessão em vez de link.
 *
 * O link do email continua a servir — é o caminho de quem não tem conta. Mas
 * quem tem conta não devia ter de ir procurar um email para responder a uma
 * proposta: os pedidos dele estão à frente, e é aí que a resposta faz sentido.
 *
 * A SESSÃO É A DO SITE (cookie) OU A DA APP DE CLIENTE (Bearer), lida por
 * `clienteDaSessao` — e o que ele faz passa por `agirComoCliente`, a mesma
 * função do link do email (d8, R8, 28-10-2026). Esta rota só prova que o
 * pedido é dele: o email do pedido é o email da sessão — a mesma regra que a
 * lista de pedidos usa, e a única que existe deste lado.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "negociacao-conta", 30, 300);
  if (limite.erro) return limite.erro;

  const cliente = await clienteDaSessao(req);
  if (!cliente) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  // E por conta (Segurança, 28-10-2026): quem muda de endereço não recomeça do zero.
  const porConta = await limitarPorConta("negociacao-conta-cliente", cliente.email, 30, 300);
  if (porConta.erro) return porConta.erro;

  let corpo: CorpoDoCliente & { pedidoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ ok: false, error: "Pedido ou negociação em falta." }, { status: 400 });
  }

  try {
    const pedido = await getSimulatorOrderById(pedidoId);
    const doCliente = pedido && (pedido.contactEmail ?? "").trim().toLowerCase() === cliente.email;
    // A mesma resposta para "não existe" e "não é seu". Distinguir dizia a quem
    // tenta que aquele número de pedido existe.
    if (!pedido || !doCliente) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
    }

    const resposta = await agirComoCliente({
      pedido,
      corpo,
      autorNome: cliente.nome,
      porta: cliente.viaApp ? "app" : "conta",
      baseUrl: urlDeAccaoDoPedido(req.headers),
    });
    return NextResponse.json(resposta.corpo, { status: resposta.status });
  } catch (error) {
    console.error("[users/me/negociacao]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível guardar." }, { status: 500 });
  }
}
