import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { conversaPorId, gravarMensagem, marcarLida, mensagensDe, passarParaAEquipa } from "@/lib/conversas-na-base";
import { idDaConversa } from "@/lib/conversas-da-clyon";
import { lerMensagemNova } from "@/lib/conversa-com-a-clyon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uma conversa «Suporte — clientes» para a equipa (30-10-2026, fase 1).
 *   · GET   — as mensagens (com o texto original das filtradas: a equipa vê-o);
 *   · POST  — responder como «Equipa CLYON» (o cliente nunca vê quem foi);
 *   · PATCH — marcar como lida pela equipa.
 * Só conversas `suporte_cliente`; qualquer outra dá 404.
 */
async function aConversa(req: NextRequest, params: Promise<{ id: string }>) {
  const { err, colab } = await requireAdmin(req);
  if (err) return { erro: err } as const;
  const id = idDaConversa((await params).id);
  const c = id ? await conversaPorId(id) : null;
  if (!c || c.tipo !== "suporte_cliente") {
    return { erro: NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 }) } as const;
  }
  return { c, colab } as const;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await aConversa(req, params);
    if ("erro" in r) return r.erro;
    const mensagens = await mensagensDe(r.c.id, 500);
    return NextResponse.json(
      {
        conversa: { id: r.c.id, estado: r.c.estado, atendidaPor: r.c.atendidaPor },
        mensagens: mensagens.map((m) => ({
          id: m.id,
          autor: m.autor,
          texto: m.texto,
          textoOriginal: m.textoOriginal,
          filtrada: m.filtrada,
          alerta: m.alerta ?? null,
          anexoUrl: m.anexoUrl,
          criadaEm: m.criadaEm,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/suporte/clientes/id GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível abrir a conversa." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let corpo: { texto?: unknown };
  try {
    corpo = ((await req.json()) ?? {}) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const r = await aConversa(req, params);
    if ("erro" in r) return r.erro;
    const lida = lerMensagemNova({ texto: corpo.texto });
    if (!lida.ok) return NextResponse.json({ error: lida.error }, { status: 400 });
    await gravarMensagem({
      conversaId: r.c.id,
      autor: "equipa",
      autorId: r.colab.id,
      texto: lida.texto,
      textoOriginal: null,
      filtrada: false,
      anexoUrl: null,
    });
    if (r.c.atendidaPor !== "equipa") await passarParaAEquipa(r.c.id);
    await marcarLida(r.c.id, "equipa");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/suporte/clientes/id POST]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível enviar." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await aConversa(req, params);
    if ("erro" in r) return r.erro;
    await marcarLida(r.c.id, "equipa");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/suporte/clientes/id PATCH]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível marcar como lida." }, { status: 500 });
  }
}
