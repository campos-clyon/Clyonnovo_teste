import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { marcarConcluidoComoVisto, pedidosComNegociacoes } from "@/lib/db";

export const runtime = "nodejs";

/** Pedidos da plataforma e as negociações de cada um, para o painel. */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  /*
   * A MESA TRAZ OS RECENTES; A BUSCA TRAZ TUDO.
   *
   * "A pesquisa deve procurar por número de telefone, endereço, número do
   * pedido, nome do cliente e localidade, até mesmo através do profissional."
   * — 18-09-2026. Procurava por tudo isso e já procurava bem: o que ela não
   * podia era encontrar um pedido que nunca chegou ao browser. A busca filtra
   * a lista carregada, e a lista carregada eram os trinta mais recentes.
   *
   * Com `?tudo=1` vem a mesa inteira, e é o painel — com a mesma função de
   * sempre, `combinaComABusca`, já coberta por testes — que filtra. Escrever
   * a busca outra vez em SQL dava duas regras para a mesma pergunta, e a
   * segunda a divergir seria sempre esta, que ninguém vê a funcionar.
   *
   * O ecrã normal continua leve: só pede tudo quando alguém escreve na caixa.
   */
  const tudo = new URL(req.url).searchParams.get("tudo") === "1";

  try {
    return NextResponse.json({ pedidos: await pedidosComNegociacoes(tudo ? 500 : 60) });
  } catch (error) {
    console.error("[api/admin/negociacoes GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

/**
 * O carimbo de "já vi": um pedido concluído fica em destaque na mesa até o
 * admin o ABRIR — abrir é ver, e é o ecrã que o diz, não um botão à parte.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: { accao?: unknown; pedidoId?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (corpo.accao !== "concluido_visto" || !Number.isInteger(Number(corpo.pedidoId))) {
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  }
  await marcarConcluidoComoVisto(Number(corpo.pedidoId));
  return NextResponse.json({ ok: true });
}
