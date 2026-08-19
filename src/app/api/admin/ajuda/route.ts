import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { ajudasParaAdmin, responderPedidoDeAjuda } from "@/lib/db";
import { rotuloDoAssunto } from "@/lib/ajuda-plataforma";

export const runtime = "nodejs";

/**
 * Os pedidos de ajuda da plataforma.
 *
 * Vivem numa tabela nossa, em MySQL, e não nos `support_tickets` do Supabase —
 * esses são da app, e a app é de outro dono. Aparecem na mesma secção Suporte
 * do backoffice: quem atende não tem de saber de que base veio o pedido.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const estado = req.nextUrl.searchParams.get("estado");

  try {
    const linhas = await ajudasParaAdmin(
      estado && estado !== "todos" ? estado : undefined,
    );
    return NextResponse.json({
      pedidos: linhas.map((p) => {
        let respostas: Array<{ texto: string; em: string; por: string }> = [];
        try {
          const l = JSON.parse(p.respostaJson ?? "[]");
          if (Array.isArray(l)) respostas = l;
        } catch {
          /* uma resposta corrompida não pode esconder o pedido todo */
        }
        return {
          id: p.id,
          origem: p.origem,
          providerId: p.providerId,
          nome: p.nome,
          email: p.email,
          assunto: p.assunto,
          assuntoLabel: rotuloDoAssunto(p.assunto),
          mensagem: p.mensagem,
          estado: p.estado,
          respostas,
          tratadoPor: p.tratadoPor,
          createdAt: p.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("[admin/ajuda GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { id?: unknown; texto?: unknown; estado?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const id = Number(corpo.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
  const estado =
    typeof corpo.estado === "string" &&
    ["open", "in_progress", "waiting_customer", "closed"].includes(corpo.estado)
      ? corpo.estado
      : "in_progress";

  // Fechar sem responder é deixar alguém à espera de uma resposta que nunca
  // chega — ele vê "resolvido" na conta e nada escrito por baixo.
  if (!texto && estado === "closed") {
    return NextResponse.json(
      { error: "Escreva a resposta antes de fechar." },
      { status: 400 },
    );
  }

  try {
    const linhas = await ajudasParaAdmin();
    const pedido = linhas.find((p) => p.id === id);
    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    // As respostas acumulam-se. Substituir a anterior apagava metade da
    // conversa, e a metade apagada é sempre a que explica a outra.
    let respostas: Array<{ texto: string; em: string; por: string }> = [];
    try {
      const l = JSON.parse(pedido.respostaJson ?? "[]");
      if (Array.isArray(l)) respostas = l;
    } catch {
      /* recomeça-se em vez de perder o pedido */
    }
    if (texto) {
      respostas.push({
        texto: texto.slice(0, 4000),
        em: new Date().toISOString(),
        por: String(colab?.nome ?? "CLYON"),
      });
    }

    await responderPedidoDeAjuda(id, {
      respostaJson: JSON.stringify(respostas),
      estado,
      tratadoPor: String(colab?.nome ?? "admin"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/ajuda POST]", error);
    return NextResponse.json({ error: "Não foi possível guardar" }, { status: 500 });
  }
}
