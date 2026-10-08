import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import {
  appendOrderHistory,
  getSimulatorOrderById,
  marcarPedidoComoOfertaClyon,
  negociacoesDoPedido,
  ofertasClyon,
  registarSemFalhar,
} from "@/lib/db";
import { distribuirPedido, resumoDaDistribuicao } from "@/lib/distribuir-pedido";
import { lerBase } from "@/lib/base-do-preco";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { lerValorFixo, modoDaOferta, resumoDaOferta, type ModoDaOferta } from "@/lib/oferta-clyon";

export const runtime = "nodejs";

/**
 * OS TRABALHOS CLYON DE VALOR FIXO — a página do backoffice.
 *
 * *«Quero criar uma função no site para gerar trabalhos (…) já negociámos e já
 * temos os valores, só precisamos de alguém para realizar.»* — 02-10-2026. Ver
 * `oferta-clyon.ts` para as regras e para as decisões do dono.
 *
 * GET lista os trabalhos e em que pé está cada um. POST oferece um pedido já
 * registado (pelo «Registar pedido», que grava e calcula o alcance) a valor
 * fixo: a todos os que o podem fazer, a uns escolhidos, ou a um só.
 */

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  try {
    const ofertas = await ofertasClyon(150);
    return NextResponse.json({
      trabalhos: ofertas.map((o) => {
        const negociacoes = o.negociacoes.map((n) => ({
          negociacaoId: n.negociacaoId,
          providerId: n.providerId,
          profissional: n.profissional,
          estado: n.estado,
          modo: modoDaOferta(n.modo),
          dataCombinada: iso(n.dataCombinada),
          atribuidaEm: iso(n.atribuidaEm),
          execucaoEnviadaEm: iso(n.execucaoEnviadaEm),
          confirmadoEm: iso(n.confirmadoEm),
          pagoEm: iso(n.pagoEm),
        }));
        return {
          pedidoId: o.pedidoId,
          servico: o.servico,
          localidade: o.localidade,
          morada: o.morada,
          dataAgendada: iso(o.dataAgendada),
          valorFixo: o.valorFixo,
          cliente: o.cliente,
          telefone: o.telefone,
          estadoDoPedido: o.estadoDoPedido,
          criadoEm: iso(o.criadoEm),
          negociacoes,
          resumo: resumoDaOferta(negociacoes, o.estadoDoPedido),
        };
      }),
    });
  } catch (e) {
    console.error("[admin/trabalhos-clyon GET]", e);
    return NextResponse.json({ error: "Não foi possível ler os trabalhos CLYON." }, { status: 500 });
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
  const valor = lerValorFixo(corpo.valor);
  if (!valor.ok) return NextResponse.json({ error: valor.erro }, { status: 400 });

  /*
   * A QUEM VAI. Sem lista: a todos os que o podem fazer (a regra do raio e das
   * categorias, como num pedido normal). Com lista: só a esses — e se for um
   * só, a oferta é DIRECTA: a escolha já está feita, e aceitar fecha.
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
  const modo: ModoDaOferta = soPara?.length === 1 ? "directa" : "distribuida";

  await assumirPedidoSeLivre(pedidoId, colab);
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if ((await negociacoesDoPedido(pedidoId)).length > 0) {
    return NextResponse.json(
      { error: "Este pedido já foi enviado aos profissionais." },
      { status: 409 },
    );
  }

  try {
    await marcarPedidoComoOfertaClyon(pedidoId, valor.valor);

    const geo = await coordenadasDoPedido(pedido);
    let fotos = 0;
    try {
      const cru = JSON.parse(pedido.rawOrderJson ?? "{}");
      fotos = Array.isArray(cru?.files) ? cru.files.length : 0;
    } catch {
      /* sem fotografias legíveis, conta-se zero */
    }

    /*
     * SEM O EMAIL DO LINK AO CLIENTE, de propósito — e é a diferença mais
     * importante para o «promover». Esse link abre a página do pedido com as
     * negociações e os valores dos profissionais; aqui o valor do profissional
     * é o que a CLYON lhe paga, e o cliente pagou outro. O cliente destes
     * trabalhos fala com a CLYON.
     */
    const baseUrl = urlDeAccaoDoPedido(req.headers);
    const r = await distribuirPedido(
      {
        id: pedidoId,
        serviceType: pedido.serviceType ?? null,
        description: pedido.description ?? null,
        city: pedido.city ?? null,
        urgency: pedido.urgency ?? null,
        quantidadeDeFotos: fotos,
        valorDesejadoCliente: valor.valor,
        precisaFatura: Boolean(pedido.precisaFatura),
        precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
        baseDoPreco: lerBase(pedido.baseDoPreco),
        formaDePagamento: "na_plataforma",
        lat: geo.lat,
        lng: geo.lng,
        baseUrl,
      },
      { soPara, oferta: { valor: valor.valor, modo } },
    );

    const quem = colab?.nome ?? "a CLYON";
    const aQuem =
      modo === "directa"
        ? "enviado só a um profissional, escolhido à mão — se aceitar, fica com ele"
        : soPara
          ? `enviado a ${soPara.length} profissionais escolhidos à mão — a CLYON escolhe entre os que aceitarem`
          : "distribuído a quem o pode fazer — a CLYON escolhe entre os que aceitarem";
    const resumo =
      `Trabalho CLYON de valor fixo: ${valor.valor.toFixed(2).replace(".", ",")} € para o profissional, ` +
      `oferecido por ${quem}; ${aQuem}. ${resumoDaDistribuicao(r)}`;

    await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo });
    await registarSemFalhar({
      acontecimento: "pedido_distribuido",
      pedidoId,
      autorTipo: "clyon",
      autorNome: quem,
      valor: valor.valor,
      valorProfissional: valor.valor,
      resumo,
    });

    return NextResponse.json({ ok: true, modo, valor: valor.valor, chegouAAlguem: r.receberam > 0, ...r });
  } catch (e) {
    console.error("[admin/trabalhos-clyon POST]", e);
    return NextResponse.json({ error: "Não foi possível oferecer o trabalho." }, { status: 500 });
  }
}
