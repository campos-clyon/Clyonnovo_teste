import { NextRequest, NextResponse } from "next/server";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { negociacaoDoLinkDoFecho, responderAoFecho } from "@/lib/fecho-do-modelo-novo-na-base";
import { lerRespostaDoFecho } from "@/lib/fecho-do-modelo-novo";

export const runtime = "nodejs";

/**
 * A RESPOSTA PELO LINK DO EMAIL «O TRABALHO JÁ FOI FEITO?» — d15, 13-11-2026.
 *
 * O token é só desta pergunta (hash na base, com validade): não abre o pedido,
 * não cancela, não contrata. Um POST, e nunca um GET: um leitor de email que
 * abra o link sozinho não pode fechar trabalho nenhum. O resto é o mesmo
 * caminho das três portas do cliente (`responderAoFecho`).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limite = await limitarRotaPublica(req, "pedido-fecho", 20, 300);
  if (limite.erro) return limite.erro;

  const { token } = await params;
  let corpo: { resposta?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const resposta = lerRespostaDoFecho(corpo.resposta);
  if (!resposta) return NextResponse.json({ ok: false, error: "Diga se o trabalho já foi feito." }, { status: 400 });

  const n = await negociacaoDoLinkDoFecho(token).catch(() => null);
  if (!n) return NextResponse.json({ ok: false, error: "Link inválido ou expirado." }, { status: 403 });
  const porPedido = await limitarPorConta("pedido-fecho", `pedido:${n.pedidoId}`, 10, 300);
  if (porPedido.erro) return porPedido.erro;

  try {
    const r = await responderAoFecho({
      negociacaoId: n.negociacaoId,
      pedidoId: n.pedidoId,
      resposta,
      onde: "pelo link do email",
    });
    return NextResponse.json(r.corpo, { status: r.status });
  } catch (e) {
    console.error("[pedido/fecho]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Não foi possível guardar. Tente novamente." }, { status: 500 });
  }
}
