import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import {
  appendOrderHistory,
  cancelarPedido,
  definirPrecoAoClienteClyon,
  getSimulatorOrderById,
  marcarPedidoComoOfertaClyon,
  mudarValorDoTrabalhoClyon,
  quemTemOTrabalhoClyon,
  negociacoesDoPedido,
  ofertasClyon,
  registarSemFalhar,
} from "@/lib/db";
import { distribuirPedido, resumoDaDistribuicao } from "@/lib/distribuir-pedido";
import { lerBase } from "@/lib/base-do-preco";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import {
  lerPrecoAoCliente,
  lerTaxaDoTrabalho,
  lerValorFixo,
  modoDaOferta,
  resumoDaOferta,
  taxasDoTrabalhoClyon,
  type ModoDaOferta,
} from "@/lib/oferta-clyon";
import { avisarCancelamentoDoTrabalhoClyon, avisarValorNovoDoTrabalhoClyon } from "@/lib/avisar-trabalho-clyon";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";

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
          precoAoCliente: o.precoAoCliente,
          taxa: o.taxa,
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

  let corpo: { pedidoId?: unknown; valor?: unknown; profissionais?: unknown; taxa?: unknown };
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
   * O VALOR É O PREÇO AO CLIENTE, sem IVA, E A TAXA É UMA DE TRÊS — 08-10-2026.
   * «350 que o cliente aceitou pagar; ao criá-lo vamos colocar os 20 % de
   * taxa» → o profissional vê «no valor de 350 €, ganhos estimados de 280 €».
   */
  const taxa = lerTaxaDoTrabalho(corpo.taxa);
  if (!taxa.ok) return NextResponse.json({ error: taxa.erro }, { status: 400 });
  const taxas = taxasDoTrabalhoClyon(taxa.taxa);
  const ganhos = quantoOProfissionalRecebe(valor.valor, taxas);

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
    await marcarPedidoComoOfertaClyon(pedidoId, valor.valor, valor.valor, taxa.taxa);

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
      { soPara, oferta: { valor: valor.valor, modo, taxas } },
    );

    const quem = colab?.nome ?? "a CLYON";
    const aQuem =
      modo === "directa"
        ? "enviado só a um profissional, escolhido à mão — se aceitar, fica com ele"
        : soPara
          ? `enviado a ${soPara.length} profissionais escolhidos à mão — a CLYON escolhe entre os que aceitarem`
          : "distribuído a quem o pode fazer — a CLYON escolhe entre os que aceitarem";
    const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
    const resumo =
      `Trabalho CLYON de ${euros(valor.valor)} sem IVA, taxa de ${Math.round(taxa.taxa * 100)} % — ` +
      `ganhos estimados de ${euros(ganhos)} para o profissional, ` +
      `oferecido por ${quem}; ${aQuem}. ${resumoDaDistribuicao(r)}`;

    await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo });
    await registarSemFalhar({
      acontecimento: "pedido_distribuido",
      pedidoId,
      autorTipo: "clyon",
      autorNome: quem,
      valor: valor.valor,
      valorProfissional: ganhos,
      resumo,
    });

    return NextResponse.json({ ok: true, modo, valor: valor.valor, chegouAAlguem: r.receberam > 0, ...r });
  } catch (e) {
    console.error("[admin/trabalhos-clyon POST]", e);
    return NextResponse.json({ error: "Não foi possível oferecer o trabalho." }, { status: 500 });
  }
}

/**
 * PATCH — mexer num Trabalho CLYON que já existe (08-10-2026). Três coisas, pelo
 * campo `accao`:
 *
 *   · «valor» — o valor (preço ao cliente, sem IVA) e a taxa. *«Caso o valor
 *     seja alterado, mesmo que os pros já tenham aceitado, ele deve aparecer
 *     novamente com o valor actualizado para aceitar.»* Quem já o tinha fica
 *     com ele se aceitar o valor novo; se recusar, volta aos outros. Ver
 *     `mudarValorDoTrabalhoClyon`.
 *   · «preco» — o preço ao cliente de um trabalho ANTIGO, em que o valor era o
 *     que o profissional recebia: é a diferença que dá o lucro.
 *   · «cancelar» — o trabalho deixa de existir, e todos a quem foi oferecido
 *     são avisados (decisão do dono).
 *
 * O assistente também pode — *«o assistente também deve poder mudar os valores
 * para corrigir»*. Cada mudança fica no histórico do pedido: quem, de quanto,
 * para quanto. Um período de comissão já pago não muda: está fotografado.
 */
export async function PATCH(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; accao?: unknown; valor?: unknown; taxa?: unknown; precoAoCliente?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
  const quem = colab?.nome ?? "a CLYON";
  const por = colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null;
  const accao = corpo.accao ?? (corpo.precoAoCliente !== undefined ? "preco" : null);

  try {
    // ── O valor e a taxa ─────────────────────────────────────────────────────
    if (accao === "valor") {
      const valor = lerValorFixo(corpo.valor);
      if (!valor.ok) return NextResponse.json({ error: valor.erro }, { status: 400 });
      const taxa = lerTaxaDoTrabalho(corpo.taxa);
      if (!taxa.ok) return NextResponse.json({ error: taxa.erro }, { status: 400 });

      const r = await mudarValorDoTrabalhoClyon(pedidoId, valor.valor, taxa.taxa);
      if (!r.ok) {
        const porque = {
          nao_e_clyon: ["Esse pedido não é um Trabalho CLYON.", 404],
          arrumado: ["Este trabalho está cancelado ou arquivado — já não se muda o valor.", 409],
          ja_feito: ["Este trabalho já foi feito — o valor já não se muda aqui.", 409],
          igual: ["O valor e a taxa são os mesmos — não mudou nada, e ninguém foi incomodado.", 400],
        } as const;
        const [texto, estado] = porque[r.porque];
        return NextResponse.json({ error: texto }, { status: estado });
      }

      const ganhos = quantoOProfissionalRecebe(valor.valor, taxasDoTrabalhoClyon(taxa.taxa));
      const avisados = await avisarValorNovoDoTrabalhoClyon({
        pedidoId,
        valor: valor.valor,
        taxa: taxa.taxa,
        quem: r.avisar,
        motivo: "valor_novo",
        baseUrl: urlDeAccaoDoPedido(req.headers),
      });
      const antes =
        `${euros(r.antes.valor)}${r.antes.taxa != null ? ` a ${Math.round(r.antes.taxa * 100)} %` : " (antigo, sem taxa)"}`;
      const depois = `${euros(valor.valor)} a ${Math.round(taxa.taxa * 100)} % — ganhos estimados ${euros(ganhos)}`;
      const dele = r.avisar.find((q) => q.eraDele);
      const resumo =
        `Valor do Trabalho CLYON mudado por ${quem}: de ${antes} para ${depois}. ` +
        (r.avisar.length === 0
          ? "Ninguém o tinha por responder."
          : (dele
              ? `${dele.profissional} já o tinha: fica com ele se aceitar o valor novo. `
              : "Quem o tinha aceite volta a ter de aceitar. ") +
            `${avisados} de ${r.avisar.length} avisado${r.avisar.length === 1 ? "" : "s"} por WhatsApp.`);
      await appendOrderHistory(pedidoId, { type: "note", by: por, message: resumo });
      await registarSemFalhar({
        acontecimento: "valor_corrigido",
        pedidoId,
        autorTipo: colab?.papel === "assistente" ? "assistente" : "clyon",
        autorNome: quem,
        valor: valor.valor,
        valorProfissional: ganhos,
        resumo,
        detalhe: { antes: r.antes, depois: { valor: valor.valor, taxa: taxa.taxa }, avisados: r.avisar },
      });
      return NextResponse.json({ ok: true, feito: resumo, ganhos, avisar: r.avisar.length, avisados });
    }

    // ── Cancelar ─────────────────────────────────────────────────────────────
    if (accao === "cancelar") {
      const antes = await quemTemOTrabalhoClyon(pedidoId);
      if (!antes.eClyon) return NextResponse.json({ error: "Esse pedido não é um Trabalho CLYON." }, { status: 404 });
      if (antes.jaFeito) {
        return NextResponse.json({ error: "Este trabalho já foi feito — não se cancela aqui." }, { status: 409 });
      }
      const pedido = await getSimulatorOrderById(pedidoId);
      const r = await cancelarPedido(pedidoId);
      if (!r) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
      const avisados = await avisarCancelamentoDoTrabalhoClyon({
        pedidoId,
        servico: pedido?.serviceType ?? null,
        localidade: pedido?.city ?? null,
        quem: antes.vivos,
      });
      const resumo =
        `Trabalho CLYON cancelado por ${quem}. ` +
        (antes.vivos.length === 0
          ? "Não estava com ninguém."
          : `Estava com ${antes.vivos.map((q) => q.profissional).join(", ")} — ` +
            `${avisados} avisado${avisados === 1 ? "" : "s"} por WhatsApp.`);
      await appendOrderHistory(pedidoId, { type: "note", by: por, message: resumo });
      await registarSemFalhar({
        acontecimento: "pedido_cancelado",
        pedidoId,
        autorTipo: colab?.papel === "assistente" ? "assistente" : "clyon",
        autorNome: quem,
        resumo,
      });
      return NextResponse.json({ ok: true, feito: resumo, avisados });
    }

    // ── O preço ao cliente de um trabalho antigo ─────────────────────────────
    if (accao === "preco") {
      const lido = lerPrecoAoCliente(corpo.precoAoCliente);
      if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
      const r = await definirPrecoAoClienteClyon(pedidoId, lido.valor);
      if (!r) return NextResponse.json({ error: "Esse pedido não é um Trabalho CLYON." }, { status: 404 });
      await appendOrderHistory(pedidoId, {
        type: "note",
        by: por,
        message:
          r.antes == null
            ? `Preço ao cliente escrito por ${quem}: ${euros(lido.valor)} sem IVA.`
            : `Preço ao cliente mudado por ${quem}: de ${euros(r.antes)} para ${euros(lido.valor)} sem IVA.`,
      });
      return NextResponse.json({ ok: true, precoAoCliente: lido.valor });
    }

    return NextResponse.json({ error: "Nada para mudar." }, { status: 400 });
  } catch (e) {
    console.error("[admin/trabalhos-clyon PATCH]", e);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
