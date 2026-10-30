import { NextRequest, NextResponse } from "next/server";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { quemPedeAConversa } from "@/lib/quem-pede-a-conversa";
import { conversaPorId, gravarMensagem, mensagensDe, textosAnterioresDoAutor } from "@/lib/conversas-na-base";
import {
  autorDe,
  chaveDeLeitura,
  idDaConversa,
  pertenceAConversa,
  podeEscrever,
  prepararMensagem,
  vistaDaConversa,
  vistaDaMensagem,
} from "@/lib/conversas-da-clyon";
import { lerMensagemNova } from "@/lib/conversa-com-a-clyon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAO_ENCONTRADA = { ok: false, error: "Conversa não encontrada." };

/**
 * GET/POST /api/conversas/[id]/mensagens (30-10-2026, fase 1).
 *
 * Só quem pertence à conversa (`pertenceAConversa`); a quem não pertence, o
 * mesmo 404 de uma conversa que não existe. O que sai passa por
 * `vistaDaMensagem`: sem o texto original das filtradas, sem quem da equipa
 * escreveu. Nas conversas de pedido os contactos tapam-se sempre (2a).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limite = await limitarRotaPublica(req, "conversas-ler", 240, 300);
  if (limite.erro) return limite.erro;
  const id = idDaConversa((await params).id);
  try {
    const quem = await quemPedeAConversa(req);
    if (!quem) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const c = id ? await conversaPorId(id) : null;
    if (!c || !pertenceAConversa(c, quem)) return NextResponse.json(NAO_ENCONTRADA, { status: 404 });
    const mensagens = await mensagensDe(c.id);
    return NextResponse.json(
      { ok: true, conversa: vistaDaConversa(c), mensagens: mensagens.map((m) => vistaDaMensagem(m, quem)) },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (err) {
    console.error("[conversas/mensagens GET]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível abrir a conversa." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limite = await limitarRotaPublica(req, "conversas-escrever", 30, 300);
  if (limite.erro) return limite.erro;
  const id = idDaConversa((await params).id);
  let corpo: { texto?: unknown; mensagem?: unknown; anexoUrl?: unknown };
  try {
    corpo = ((await req.json()) ?? {}) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const quem = await quemPedeAConversa(req);
    if (!quem) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const porConta = await limitarPorConta("conversas-escrever-conta", chaveDeLeitura(quem), 60, 3600);
    if (porConta.erro) return porConta.erro;
    const c = id ? await conversaPorId(id) : null;
    if (!c || !pertenceAConversa(c, quem)) return NextResponse.json(NAO_ENCONTRADA, { status: 404 });
    if (!podeEscrever(c)) {
      return NextResponse.json({ ok: false, error: "Esta conversa já só se pode ler." }, { status: 409 });
    }
    const lida = lerMensagemNova(corpo);
    if (!lida.ok) return NextResponse.json({ ok: false, error: lida.error }, { status: 400 });
    const autor = autorDe(quem);
    const autorId = quem.papel === "cliente" ? quem.contaId : quem.providerId;
    // M1: o telefone partido em várias mensagens — só nas de pedido, onde há filtro.
    const anteriores = c.tipo === "pedido" ? await textosAnterioresDoAutor(c.id, autor, autorId, 2) : [];
    const gravada = await gravarMensagem({
      conversaId: c.id,
      autor,
      autorId,
      ...prepararMensagem(c, lida, anteriores),
    });
    return NextResponse.json({ ok: true, mensagem: vistaDaMensagem(gravada, quem) });
  } catch (err) {
    console.error("[conversas/mensagens POST]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível enviar a mensagem." }, { status: 500 });
  }
}
