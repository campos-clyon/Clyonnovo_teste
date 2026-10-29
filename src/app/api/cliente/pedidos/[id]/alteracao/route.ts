import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { getSimulatorOrderByAcessoTokenHash, getSimulatorOrderById } from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { convidadoDoPedido } from "@/lib/sessao-de-convidado";
import { lerAlteracao } from "@/lib/alteracoes-do-cliente";
import { pedirAlteracao, type PorOnde } from "@/lib/alteracoes-na-base";

export const runtime = "nodejs";

/**
 * R13 — ALTERAR O PEDIDO (S17, 29-10-2026; P11 (a); R14, R17–R19 da Segurança).
 *
 * Quem pode: a conta dona do pedido (site ou app), a sessão de convidado
 * desse pedido (o link aberto na app), ou o link do site (`token` no corpo).
 * O que se muda: só a lista fechada (`alteracoes-do-cliente.ts`) — um campo
 * fora dela recusa tudo com 422. Antes da análise aplica-se; depois fica à
 * espera da Mesa; contratado, concluído ou cancelado: 409. Pelo link, o
 * contacto do pedido é avisado.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limite = await limitarRotaPublica(req, "cliente-alteracao", 30, 300);
  if (limite.erro) return limite.erro;

  const { id } = await params;
  const pedidoId = /^\d{1,10}$/.test(id) ? Number(id) : NaN;
  if (!Number.isInteger(pedidoId)) return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  // Quem é: conta, convidado, ou o link do site.
  let porOnde: PorOnde | null = null;
  let quem = "";
  let prova8: string | null = null;
  const email = await emailDoCliente(req);
  if (email) {
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido || (pedido.contactEmail ?? "").trim().toLowerCase() !== email) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
    }
    porOnde = req.headers.get("authorization") ? "app" : "conta";
    quem = email;
  } else if (typeof corpo?.token === "string") {
    const t = corpo.token;
    const pedido = /^[A-Za-z0-9_-]{20,200}$/.test(t) ? await getSimulatorOrderByAcessoTokenHash(hashDeToken(t)) : undefined;
    const r = verificarTokenDeAcesso(t, pedido?.acessoTokenHash ?? null, pedido?.acessoTokenExpiraEm ?? null);
    if (!pedido || !r.valido || pedido.id !== pedidoId) {
      return NextResponse.json({ ok: false, error: "Link inválido ou expirado." }, { status: 403 });
    }
    porOnde = "link";
    quem = `pedido:${pedidoId}`;
  } else {
    const c = await convidadoDoPedido(req, pedidoId);
    if (!c) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    porOnde = "convidado";
    quem = `convidado:${c.sessaoId}`;
    prova8 = c.prova8;
  }

  // Travões: 10 por hora por sessão, 20 por dia por pedido (R20).
  const porSessao = await limitarPorConta("cliente-alteracao-sessao", quem, 10, 3600);
  if (porSessao.erro) return porSessao.erro;
  const porPedido = await limitarPorConta("cliente-alteracao-pedido", `pedido:${pedidoId}`, 20, 86400);
  if (porPedido.erro) return porPedido.erro;

  const lida = lerAlteracao(corpo);
  if (!lida.ok) return NextResponse.json({ ok: false, error: lida.erro }, { status: 422 });

  try {
    const r = await pedirAlteracao({ pedidoId, alteracao: lida.alteracao, porOnde, prova8 });
    return NextResponse.json(r.corpo, { status: r.status });
  } catch (err) {
    console.error("[cliente/pedidos/alteracao]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível guardar a alteração." }, { status: 500 });
  }
}
