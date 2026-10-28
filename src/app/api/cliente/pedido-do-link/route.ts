import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { appendOrderHistory, getSimulatorOrderByAcessoTokenHash, juntarPedidoAConta } from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { mascararEmail } from "@/lib/mascarar-email";
import { nomeDoServico } from "@/lib/service-categories";
import { diaCurtoEmLisboa } from "@/lib/pedido-para-a-app";

export const runtime = "nodejs";

/**
 * R10 — O LINK DE UM PEDIDO, NA APP DE CLIENTE (d8 fase 2, S6, 28-10-2026; P1
 * do dono: os pedidos do WhatsApp juntam-se à conta).
 *
 * `{ token, juntar?: true }`, com a sessão da app. O token do pedido serve SÓ
 * para saber que pedido é e, se for o caso, juntá-lo à conta: nunca abre o
 * pedido (isso é a R5, com sessão), nunca roda, nunca se guarda.
 *
 *   · do email da sessão → `seu` + id (a app abre o pedido);
 *   · sem email (feito pelo WhatsApp) → `semEmail` + um resumo de uma linha;
 *     com `juntar`, grava o email da sessão, só se ainda estiver vazio, numa
 *     só escrita, e a Mesa regista-o no histórico do pedido;
 *   · de outro email → `outroEmail`, sem dados do pedido;
 *   · desconhecido ou mal formado → 404; expirado → 410.
 *
 * Travão por endereço e por conta (regra 3 da Segurança).
 */

const NAO_ABRE = "Este link já não abre nenhum pedido.";
const EXPIROU = "Este link expirou. Os links de acesso duram 30 dias.";
const JA_LIGADO = "Este pedido já está ligado a uma conta.";

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "cliente-pedido-do-link", 30, 300);
  if (limite.erro) return limite.erro;

  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const porConta = await limitarPorConta("cliente-pedido-do-link-conta", email, 30, 300);
  if (porConta.erro) return porConta.erro;

  let corpo: { token?: unknown; juntar?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const token = typeof corpo?.token === "string" ? corpo.token : "";
  if (!token || token.length > 200 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 });
  }

  try {
    const pedido = await getSimulatorOrderByAcessoTokenHash(hashDeToken(token));
    const r = verificarTokenDeAcesso(token, pedido?.acessoTokenHash ?? null, pedido?.acessoTokenExpiraEm ?? null);
    if (!pedido || (!r.valido && r.motivo !== "expirado")) {
      return NextResponse.json({ ok: false, error: NAO_ABRE }, { status: 404 });
    }
    if (!r.valido) return NextResponse.json({ ok: false, error: EXPIROU }, { status: 410 });

    const doPedido = (pedido.contactEmail ?? "").trim().toLowerCase();
    if (doPedido === email) return NextResponse.json({ ok: true, estado: "seu", id: pedido.id });
    // De outra conta: nada do pedido sai daqui.
    if (doPedido) return NextResponse.json({ ok: true, estado: "outroEmail" });

    // Sem email — feito pelo WhatsApp. Quem tem o link é o dono do pedido, como no site.
    if (corpo.juntar !== true) {
      return NextResponse.json({
        ok: true,
        estado: "semEmail",
        id: pedido.id,
        servico: nomeDoServico(pedido.serviceType),
        cidade: pedido.city ?? null,
        criadoEmTexto: diaCurtoEmLisboa(pedido.createdAt),
      });
    }

    // Só se ainda estiver vazio, numa só escrita: dois toques não o juntam a duas contas.
    if (!(await juntarPedidoAConta(pedido.id, email))) {
      return NextResponse.json({ ok: false, error: JA_LIGADO }, { status: 409 });
    }
    await appendOrderHistory(pedido.id, {
      type: "created",
      by: null,
      message: `Pedido juntado à conta ${mascararEmail(email)} pela app de cliente.`,
    });
    return NextResponse.json({ ok: true, estado: "seu", id: pedido.id, juntado: true });
  } catch (err) {
    console.error("[cliente/pedido-do-link]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível abrir o link agora." }, { status: 500 });
  }
}
