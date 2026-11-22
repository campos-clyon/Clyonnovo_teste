import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { caixaDosContactos, diasDaCaixa, marcarRespondido } from "@/lib/caixa-dos-contactos-na-base";
import { EMAIL_GERAL_LIGADO, refValida, type Contacto } from "@/lib/caixa-dos-contactos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * A CAIXA «CONTACTOS» — d85, fase 1 (CEO e dono, 22-11-2026).
 *
 * GET: uma linha por pessoa, de todos os canais (WhatsApp, formulários,
 * Suporte da app), com o estado, quem respondeu e há quanto tempo espera; os
 * números do topo; e os últimos 14 dias registados. Todos os por responder, e
 * os 400 mais recentes dos outros.
 *
 * POST `{ accao: "respondido", refs }`: a pessoa já foi respondida (pelo
 * WhatsApp, pelo telefone ou pelo email) — muda o estado em cada canal e grava
 * quem e quando. Nunca envia nada a ninguém; nunca apaga nada.
 *
 * Só a equipa com a secção «Contactos» (`requireAdmin`, prefixo /api/admin/contactos).
 */

const OUTROS_NO_MAXIMO = 400;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function paraOPainel(c: Contacto) {
  return {
    chave: c.chave,
    nome: c.nome,
    telefone: c.telefone,
    email: c.email,
    anonimizado: c.anonimizado,
    canais: c.canais,
    estado: c.estado,
    esperaDesde: iso(c.esperaDesde),
    esperaS: c.esperaS,
    esperaUtilS: c.esperaUtilS,
    atrasado: c.atrasado,
    antigo: c.antigo,
    ultimoEm: iso(c.ultimoEm),
    quemFalou: c.quemFalou,
    quemRespondeu: c.quemRespondeu,
    respondidoPorNome: c.respondidoPorNome,
    respondidoEm: iso(c.respondidoEm),
    resumo: c.resumo,
    porque: c.porque,
    pedidos: c.pedidos,
    profissional: c.profissional,
    entradas: c.entradas.map((e) => ({ canal: e.canal, ref: e.ref, estado: e.estado, porque: e.porque })),
  };
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const caixa = await caixaDosContactos({ gravarODia: true });
    const porResponder = caixa.contactos.filter((c) => c.estado === "por_responder");
    const outros = caixa.contactos
      .filter((c) => c.estado !== "por_responder")
      .sort((a, b) => (b.ultimoEm?.getTime() ?? 0) - (a.ultimoEm?.getTime() ?? 0))
      .slice(0, OUTROS_NO_MAXIMO);
    const dias = await diasDaCaixa(14).catch(() => []);
    return NextResponse.json(
      {
        contactos: [...porResponder, ...outros].map(paraOPainel),
        medida: caixa.medida,
        dias,
        falhas: caixa.falhas,
        emailLigado: EMAIL_GERAL_LIGADO,
        lidaEm: caixa.lidaEm.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/contactos GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível ler os contactos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  let corpo: { accao?: unknown; refs?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (corpo.accao !== "respondido") return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const refs = Array.isArray(corpo.refs) ? corpo.refs.filter(refValida) : [];
  if (refs.length === 0) return NextResponse.json({ error: "Falta o contacto." }, { status: 400 });
  try {
    const feitas = await marcarRespondido(refs, colab?.nome ?? null);
    return NextResponse.json({ ok: true, feitas });
  } catch (e) {
    console.error("[admin/contactos POST]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível marcar como respondido." }, { status: 500 });
  }
}
