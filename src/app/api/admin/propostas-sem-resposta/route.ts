import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { parceirosParaOValorUnico, pedidosComNegociacoes } from "@/lib/db";
import { negociacoesNoNovoModelo, regimesDasNegociacoes } from "@/lib/novo-modelo-no-servidor";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";
import { lembretesDasPropostas, mensagemDoLembrete, precisaDeLink, type PedidoParaOLembrete } from "@/lib/propostas-sem-resposta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PROPOSTAS HÁ MAIS DE 24 H SEM RESPOSTA DO CLIENTE — d54, 16-11-2026.
 *
 * A lista do Início, com a mensagem pronta a copiar (nunca se envia daqui).
 * As contas são as da Mesa: o modelo de 15-11 e o regime de cada negociação
 * (`negociacoesNoNovoModelo`, `regimesDasNegociacoes`), para o «desde» ser o
 * total que o cliente vê no cartão. Sem nomes nem contactos na resposta: o
 * n.º do pedido, o serviço, os números e a mensagem.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const pedidos = await pedidosComNegociacoes(200);
    const negociacoes = pedidos.flatMap((p) => p.negociacoes);
    const doNovoModelo = await negociacoesNoNovoModelo(negociacoes, agoraDoModelo());
    const regimes = await regimesDasNegociacoes([...doNovoModelo]);
    // «Verificado» só de quem tem as três confirmações (regra q da orquestra).
    const parceiros = await parceirosParaOValorUnico(negociacoes.map((n) => Number(n.providerId))).catch(
      () => new Map<number, { verificado: boolean }>(),
    );
    const paraOLembrete = pedidos.map((p) => ({
      ...p,
      negociacoes: p.negociacoes.map((n) => ({
        ...n,
        verificado: parceiros.get(Number(n.providerId))?.verificado === true,
        ...(doNovoModelo.has(Number(n.id)) ? { noNovoModelo: true } : {}),
        ...(doNovoModelo.has(Number(n.id)) && regimes.has(Number(n.id)) ? { regimeParaOTotal: regimes.get(Number(n.id)) } : {}),
      })),
    })) as unknown as PedidoParaOLembrete[];
    const lembretes = lembretesDasPropostas(paraOLembrete, new Date()).map((l) => ({
      ...l,
      mensagem: mensagemDoLembrete(l),
      precisaDeLink: precisaDeLink(l),
    }));
    return NextResponse.json({ lembretes });
  } catch (e) {
    console.error("[admin/propostas-sem-resposta]", e);
    return NextResponse.json({ error: "Não foi possível carregar as propostas sem resposta." }, { status: 500 });
  }
}
