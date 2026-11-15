import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { descricaoEmPortugues, paraABase, rotuloDoOriginal } from "@/lib/descricao-em-portugues";
import { comTextoDaEquipa, fontesDeUmaDescricao, lerFontes } from "@/lib/fontes-da-descricao";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * «TRADUZIR PARA PORTUGUÊS» — o botão dos pedidos antigos. 15-11-2026 (d46).
 *
 * UM pedido de cada vez, por uma pessoa da equipa, com histórico. Nunca em
 * massa, nunca sozinho: a descrição muda o que os parceiros lêem. O texto
 * como estava fica guardado à parte («Dito pelo cliente (…)»), e a tradução
 * passa a ser o texto da equipa (as fontes sabem que alguém o escreveu).
 * Não recomeça o pedido nem mexe nas propostas.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const pedidoId = Number((await params).id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  try {
    const { getSimulatorOrderById, gravarDescricaoEFontes, appendOrderHistory } = await import("@/lib/db");
    const p = await getSimulatorOrderById(pedidoId);
    if (!p) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    const antes = p.description ?? "";
    const t = await descricaoEmPortugues(antes);
    if (t.original == null) {
      return NextResponse.json({ ok: true, mudou: false, nota: "A descrição já está em português." });
    }
    if (t.porTraduzir) {
      return NextResponse.json(
        { error: `O tradutor não respondeu (${(t.motivo ?? "sem motivo").slice(0, 160)}). Tente daqui a pouco.` },
        { status: 502 },
      );
    }
    const agora = new Date();
    const doPedido = p as unknown as { fontesDaDescricao?: string | null };
    const fontes = comTextoDaEquipa(lerFontes(doPedido.fontesDaDescricao) ?? fontesDeUmaDescricao(antes), t.descricao, agora);
    const gravou = await gravarDescricaoEFontes(pedidoId, t.descricao, JSON.stringify(fontes), antes, paraABase(t));
    if (!gravou) {
      return NextResponse.json({ error: "A descrição mudou entretanto. Abra o pedido outra vez." }, { status: 409 });
    }
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: colab ? { id: colab.id, nome: colab.nome, role: String(colab.papel ?? "") } : null,
      message: `Descrição traduzida para português por ${colab?.nome ?? "equipa"}. O texto de antes ficou guardado («${rotuloDoOriginal(t.lingua)}»).`,
    }).catch(() => {});
    return NextResponse.json({ ok: true, mudou: true, descricao: t.descricao });
  } catch (e) {
    console.error("[admin/pedidos/traduzir-descricao]", e);
    return NextResponse.json({ error: "Não foi possível traduzir a descrição." }, { status: 500 });
  }
}
