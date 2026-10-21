import { NextRequest, NextResponse } from "next/server";
import { negociacaoPorTokenHash } from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";

export const runtime = "nodejs";

/**
 * QUAL É O TRABALHO DESTE LINK — para a app, 21-10-2026 (versão 12).
 *
 * Os avisos de pedido novo por WhatsApp e email trazem
 * `clyon.pt/profissionais/pedidos/<token>`. Com a CLYON Pro instalada o link
 * abre a app, mas o token não diz qual é o trabalho — e a app abria a lista,
 * deixando-o à procura. Isto traduz o token no número da negociação, com as
 * MESMAS regras da página do pedido (`profissionais/pedidos/[token]`):
 *
 *   - token desconhecido ou estragado → 404;
 *   - expirado → 410, com a frase da página;
 *   - de outro profissional → 403 («foi enviado a outro profissional»): o
 *     código diz qual é a negociação, a sessão diz quem está a ver.
 *
 * Só lê. A app abre depois o trabalho que já tem na lista.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { token?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const token = typeof corpo.token === "string" ? corpo.token.trim() : "";
  if (!/^[\w-]{10,200}$/.test(token)) {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }

  try {
    const negociacao = await negociacaoPorTokenHash(hashDeToken(token));
    const acesso = verificarTokenDeAcesso(
      token,
      negociacao?.acessoTokenHash ?? null,
      negociacao?.acessoTokenExpiraEm ?? null,
    );
    if (!negociacao || (!acesso.valido && acesso.motivo !== "expirado")) {
      return NextResponse.json({ error: "Link inválido." }, { status: 404 });
    }
    if (!acesso.valido) {
      return NextResponse.json(
        { error: "Este link expirou. Os pedidos não ficam abertos para sempre." },
        { status: 410 },
      );
    }
    if (Number(sessao.providerId) !== Number(negociacao.providerId)) {
      return NextResponse.json(
        { error: "Este pedido foi enviado a outro profissional. Entrou com uma conta diferente da que recebeu este link." },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true, negociacaoId: Number(negociacao.id) });
  } catch (e) {
    console.error("[profissionais/pedido-do-link]", e);
    return NextResponse.json({ error: "Não foi possível abrir o pedido." }, { status: 500 });
  }
}
