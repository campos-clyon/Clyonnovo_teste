import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { pedidosPorPromover } from "@/lib/db";
import { enviarAosProfissionais } from "@/lib/enviar-aos-profissionais";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { oQueFaltaNoPedido } from "@/lib/o-que-falta-no-pedido";

export const runtime = "nodejs";

/**
 * Passar um pedido do simulador para a plataforma.
 *
 * O formulário público recolhe um pedido de orçamento: tem estimativa, não tem
 * valor pedido pelo cliente, e nunca foi distribuído a ninguém. Um profissional
 * não o vê, e não o poderia negociar mesmo que o visse — não há valor de
 * partida nem forma de o cliente responder.
 *
 * Promover resolve as três coisas de uma vez: fixa o valor de partida, emite o
 * link de acesso do cliente e distribui aos profissionais elegíveis.
 *
 * O VALOR DE PARTIDA É A CONTA DA CLYON, E NÃO UM NÚMERO ESCRITO À MÃO.
 *
 * Havia uma caixa na mesa para escrever o valor, e sem nada escrito valia a
 * estimativa — que está gravada COM IVA, num sítio onde tudo é sem IVA. Ele
 * pediu para a CLYON dar uma sugestão em vez de um valor a aceitar, e disse
 * que sim a usar a mesma conta aqui (09-09-2026): custos com os quilómetros
 * da base da CLYON, pessoal, fixos e a margem, sem IVA — a mesma fórmula que
 * cada profissional vê no link, só que com os quilómetros dele.
 *
 * Era uma acção de uma pessoa, pedido a pedido. Desde 22-11-2026 (d87) os que
 * a Vitória completa seguem sozinhos, e desde 23-11-2026 (d88) todo o pedido
 * completo dos «Orçamentos novos», de qualquer origem, pela rotina de 15 em 15
 * minutos e por esta mesma função (`enviarAosProfissionais`) — com as
 * condições de `envio-automatico-aos-parceiros.ts`. O botão fica para os que
 * ficam com uma pessoa.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    /*
     * Cem, e nao vinte.
     *
     * Com vinte, o painel mostrava uma janela e calava o resto: arquivar um
     * pedido fazia aparecer outro vindo do fundo da fila, e nunca se sabia
     * quantos faltavam. O contador que agora esta no cabecalho seria uma
     * mentira do tamanho da diferenca.
     *
     * Cem cabe porque a lista deixou de ser corrida: agrupa por idade e os
     * antigos — que sao quase sempre a maioria — nascem fechados.
     */
    const pedidos = (await pedidosPorPromover(100)).map(
      /*
       * O QUE FALTA EM CADA PEDIDO — 26-10-2026 (d31). Vai só a lista das
       * chaves (`faltas`): a descrição, as fotografias e o pedaço do
       * formulário servem para a contar e ficam aqui, no servidor.
       */
      ({ description, filesJson, dataAgendada, rawDoQueFalta, ...p }) => ({
        ...p,
        faltas: oQueFaltaNoPedido({ ...p, description, filesJson, dataAgendada, rawOrderJson: rawDoQueFalta }),
      }),
    );
    /*
     * OS LEMBRETES DO QUE FALTA — 19-11-2026 (d71). O estado no cartão
     * («Lembrete 1/3 enviado a …») e os acabados nos últimos 7 dias, que já
     * saíram do bloco («Cancelado pelo cliente (respondeu 2)», «Arquivado sem
     * resposta»). Nunca rebenta a lista: sem isto, os cartões servem.
     */
    const { lembretesNaMesa } = await import("@/lib/lembrete-do-que-falta-na-base");
    const lembretes = await lembretesNaMesa(pedidos.map((p) => Number(p.id)));
    /*
     * O ENVIO AUTOMÁTICO AOS PARCEIROS — 22-11-2026 (d87). Porque é que um
     * pedido completo pela Vitória não seguiu sozinho (ou que está na fila das
     * 8h00, ou que «enviaria a …» com o interruptor desligado). Nunca rebenta a lista.
     */
    const { linhasDoEnvioAutomaticoNaMesa } = await import("@/lib/envio-automatico-aos-parceiros-na-base");
    const envios = await linhasDoEnvioAutomaticoNaMesa(pedidos.map((p) => Number(p.id)));
    // d128: «fora da zona» — a morada (ou a origem da mudança) acima do limite das Configs.
    const { foraDaZonaDosPedidos } = await import("@/lib/fora-da-zona-na-base");
    const foraDaZona = await foraDaZonaDosPedidos(pedidos.map((p) => Number(p.id)));
    return NextResponse.json({
      pedidos: pedidos.map((p) => ({
        ...p,
        foraDaZona: foraDaZona.get(Number(p.id)) ?? null,
        lembreteDoQueFalta: lembretes.linhas.get(Number(p.id)) ?? null,
        envioAutomatico: envios.get(Number(p.id)) ?? null,
      })),
      lembretesAcabados: lembretes.acabados,
    });
  } catch (error) {
    console.error("[admin/negociacoes/promover GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; valor?: unknown; profissionais?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  /*
   * ESCOLHIDOS À MÃO — 29-09-2026.
   *
   * «Quero que esse botão de enviar também dê a opção de escolher
   * individualmente as empresas/pros.» Sem lista, é a regra que decide (raio
   * e categorias). Com lista, vai só a esses — e uma lista vazia é um engano,
   * não «ninguém»: recusa-se em vez de promover um pedido que não chega a
   * lado nenhum.
   */
  let soPara: number[] | undefined;
  if (corpo.profissionais !== undefined && corpo.profissionais !== null) {
    const ids = Array.isArray(corpo.profissionais)
      ? [...new Set(corpo.profissionais.map(Number))].filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (ids.length === 0 || ids.length > 200) {
      return NextResponse.json({ error: "Escolha pelo menos um profissional." }, { status: 400 });
    }
    soPara = ids;
  }
  /*
   * O ENVIO, NUMA FUNÇÃO SÓ — 22-11-2026 (d87). O que estava aqui passou tal e
   * qual para `enviarAosProfissionais` (enviar-aos-profissionais.ts): é a
   * mesma função que o envio automático dos pedidos completos pela Vitória usa.
   */
  const r = await enviarAosProfissionais(pedidoId, {
    valor: corpo.valor,
    soPara,
    baseUrl: urlDeAccaoDoPedido(req.headers),
    colab,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const { ok: _ok, ...resto } = r;
  return NextResponse.json({ ok: true, ...resto });
}
