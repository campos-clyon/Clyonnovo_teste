import { NextRequest, NextResponse } from "next/server";
import { convidadoDoPedido } from "@/lib/sessao-de-convidado";
import { avisarAccaoPeloLink } from "@/lib/avisar-contacto-do-pedido";
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
  if (!cliente) return agirComoConvidado(req);
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

/*
 * O CONVIDADO — 29-10-2026 (S16, R8 v3). O link do pedido aberto na app sem
 * conta faz o que o link do site faz, para ESSE pedido. Pagar não (R15). O
 * contacto do pedido é avisado do que se fez (R23).
 */
const ACCOES_DE_PAGAR = new Set(["pagar", "criar_pagamento", "mbway", "multibanco"]);

async function agirComoConvidado(req: NextRequest) {
  let corpo: CorpoDoCliente & { pedidoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const convidado = await convidadoDoPedido(req, pedidoId);
  if (!convidado) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const porSessao = await limitarPorConta("negociacao-convidado", `convidado:${convidado.sessaoId}`, 10, 3600);
  if (porSessao.erro) return porSessao.erro;
  const accao = (corpo as { accao?: unknown }).accao;
  if (typeof accao === "string" && ACCOES_DE_PAGAR.has(accao)) {
    return NextResponse.json({ ok: false, error: "Para pagar, crie a conta." }, { status: 403 });
  }
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
  try {
    const resposta = await agirComoCliente({
      pedido,
      corpo,
      autorNome: `pelo link, na app (telemóvel ${convidado.prova8})`,
      porta: "convidado",
      baseUrl: urlDeAccaoDoPedido(req.headers),
    });
    if (resposta.status === 200) await avisarAccaoPeloLink(pedido, accao);
    return NextResponse.json(resposta.corpo, { status: resposta.status });
  } catch (error) {
    console.error("[users/me/negociacao] convidado:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Não foi possível guardar." }, { status: 500 });
  }
}
