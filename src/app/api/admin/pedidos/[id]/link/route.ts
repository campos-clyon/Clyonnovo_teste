import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  convidadosAbertosDoPedido,
  cortarAcessoDeConvidados,
  getSimulatorOrderById,
  substituirTokenDoPedido,
} from "@/lib/db";
import { gerarTokenDeAcesso, linkDoPedido } from "@/lib/pedido-acesso";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { quandoEmLisboa } from "@/lib/pedido-para-a-app";

export const runtime = "nodejs";

/**
 * O ACESSO PELO LINK, NA MESA — 29-10-2026 (S16, R11 e R24 da Segurança).
 *
 * GET: em quantos telemóveis o link do pedido está aberto na app (a hora de
 * Lisboa de cada abertura e os 8 primeiros caracteres da prova — nunca a chave).
 * POST `{ accao: "cortar" }`: «Cortar o acesso pelo link» — as sessões de
 * convidado morrem e o link roda (o antigo deixa de abrir também no site).
 * Devolve o link novo, para a equipa o mandar à mão a quem é o dono do pedido.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const abertos = await convidadosAbertosDoPedido(id);
  return NextResponse.json({
    ok: true,
    telemoveis: abertos.map((a) => ({
      prova: a.prova8,
      abertoEmTexto: quandoEmLisboa(a.criadaEm),
      ultimoUsoTexto: quandoEmLisboa(a.ultimoUsoEm),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  let corpo: { accao?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (corpo?.accao !== "cortar") return NextResponse.json({ error: "Acção inválida." }, { status: 400 });
  const pedido = await getSimulatorOrderById(id);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const revogadas = await cortarAcessoDeConvidados(id);
  const acesso = gerarTokenDeAcesso();
  await substituirTokenDoPedido(id, acesso.hash, acesso.expiraEm);
  await appendOrderHistory(id, {
    type: "created",
    by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
    message: `Acesso pelo link cortado pela CLYON (${colab?.nome ?? "equipa"}): ${revogadas} ${revogadas === 1 ? "telemóvel desligado" : "telemóveis desligados"} e link novo gerado.`,
  });
  return NextResponse.json({ ok: true, revogadas, link: linkDoPedido(urlDeAccaoDoPedido(req.headers), acesso.token) });
}
