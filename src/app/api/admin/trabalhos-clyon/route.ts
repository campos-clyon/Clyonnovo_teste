import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import {
  appendOrderHistory,
  cancelarPedido,
  definirPrecoAoClienteClyon,
  getSimulatorOrderById,
  avaliarProfissional,
  marcarConcluidoComoVisto,
  marcarPropostaEnviada,
  limparPropostaEnviada,
  voltarAOferecerTrabalhoClyon,
  marcarPedidoComoOfertaClyon,
  mudarValorDoTrabalhoClyon,
  quemTemOTrabalhoClyon,
  negociacoesDoPedido,
  ofertasClyon,
  marcacoesDosProfissionais,
  registarSemFalhar,
  restaurarPedidoArrumado,
  updateSimulatorOrder,
  prepararAMudancaDeTipo,
  PORQUE_NAO_MUDA_DE_TIPO,
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
import { pedidoArrumado } from "@/lib/pedido-arrumado";
import { pedidosFechadosDaPlataforma } from "@/lib/pedidos-fechados";
import { mensagemDaPropostaClyon, precoDaPropostaClyon } from "@/lib/proposta-clyon-ao-cliente";
import { enviarTextoManualWhatsApp } from "@/lib/whatsapp-cloud";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { choquesDoProfissional } from "@/lib/choques-de-agenda";

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

/** A prova do trabalho feito, como a Mesa a lê: a nota e as fotografias. */
function provaDe(json: string | null): { fotos: string[]; nota: string } | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as { fotos?: unknown; nota?: unknown };
    const fotos = Array.isArray(p.fotos) ? p.fotos.filter((f): f is string => typeof f === "string") : [];
    const nota = typeof p.nota === "string" ? p.nota : "";
    return fotos.length > 0 || nota ? { fotos, nota } : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  /*
   * COM PROCURA, TODOS — 19-10-2026, como a Mesa (`?tudo=1`). O ecrã normal
   * lê os 150 mais recentes; quem escreve na caixa lê-os todos, para um
   * trabalho de há três meses se encontrar pelo nome ou pela morada.
   */
  const tudo = new URL(req.url).searchParams.get("tudo") === "1";
  // A Mesa (20-10-2026) só quer os Trabalhos CLYON: os pedidos normais fechados já os tem.
  const semOsOutros = new URL(req.url).searchParams.get("outros") === "0";
  try {
    /*
     * Os pedidos normais já fechados vêm junto (17-10-2026, «reúna todos os
     * trabalhos»): Concluídos, Cancelados e Arquivados mostram a plataforma
     * toda. Se esta leitura falhar, os Trabalhos CLYON aparecem na mesma.
     */
    const [ofertas, outros] = await Promise.all([
      ofertasClyon(tudo ? 1000 : 150),
      (semOsOutros ? Promise.resolve([]) : pedidosFechadosDaPlataforma(tudo ? 1000 : undefined)).catch((e) => {
        console.error("[admin/trabalhos-clyon GET] pedidos fechados", e);
        return [];
      }),
    ]);
    /*
     * QUEM JÁ TEM OUTRO TRABALHO A ESSA HORA — 21-10-2026: ao escolher entre os
     * que aceitaram, o nome fica a vermelho (`choques-de-agenda.ts`).
     */
    const POR_FECHAR = new Set(["aberta", "aguarda_contratacao"]);
    const marcacoes = await marcacoesDosProfissionais(
      ofertas.flatMap((o) => o.negociacoes.filter((n) => POR_FECHAR.has(n.estado)).map((n) => n.providerId)),
    ).catch((e) => {
      console.error("[admin/trabalhos-clyon GET] marcações", e);
      return [];
    });
    return NextResponse.json({
      outros,
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
          // Como na Mesa (19-10-2026): a prova do trabalho feito e a nota dada.
          prova: provaDe(n.provaJson),
          estrelas: n.estrelas,
          comentario: n.comentario,
          avaliadoEm: iso(n.avaliadoEm),
          semFactura: n.semFactura,
          choques: POR_FECHAR.has(n.estado)
            ? choquesDoProfissional({ pedidoId: o.pedidoId, inicio: o.dataAgendada }, n.providerId, marcacoes)
            : [],
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
          notas: o.notasInternas,
          concluidoVistoEm: iso(o.concluidoVistoEm),
          propostaEnviadaEm: iso(o.propostaEnviadaEm),
          origem: o.origem,
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

  let corpo: { pedidoId?: unknown; valor?: unknown; profissionais?: unknown; taxa?: unknown; deNegociacao?: unknown };
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
  /*
   * DE NEGOCIAÇÃO A VALOR FIXO — 20-10-2026 (fase 4), enquanto ninguém foi
   * contratado. As negociações abertas e as recusas acabam, e a oferta a
   * seguir reabre-as como valor fixo (`prepararAMudancaDeTipo`).
   */
  if (corpo.deNegociacao === true) {
    const m = await prepararAMudancaDeTipo(pedidoId, "valor_fixo");
    if (!m.ok) {
      const [texto, estado] = PORQUE_NAO_MUDA_DE_TIPO[m.porque];
      return NextResponse.json({ error: texto }, { status: estado });
    }
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message:
        `Passou de negociação a Trabalho CLYON de valor fixo, por ${colab?.nome ?? "a CLYON"}.` +
        (m.tinham.length > 0 ? ` As negociações abertas (${m.tinham.join(", ")}) acabaram — recebem a oferta.` : ""),
    });
  }
  // Só as vivas contam (20-10-2026): as que a mudança de tipo deixou mortas reabrem-se na distribuição.
  if ((await negociacoesDoPedido(pedidoId)).some((n) => ["aberta", "aguarda_contratacao", "acordada"].includes(n.estado))) {
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
 *   · «restaurar» — 16-10-2026, *«coloque a opção de restaurar pedido
 *     cancelado»*: o cancelado (ou arquivado) volta como estava, sem avisar
 *     ninguém (decisão do dono).
 *
 * O assistente também pode — *«o assistente também deve poder mudar os valores
 * para corrigir»*. Cada mudança fica no histórico do pedido: quem, de quanto,
 * para quanto. Um período de comissão já pago não muda: está fotografado.
 */
export async function PATCH(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: {
    pedidoId?: unknown;
    accao?: unknown;
    valor?: unknown;
    taxa?: unknown;
    precoAoCliente?: unknown;
    // Os recursos da Mesa (19-10-2026): a quem voltar a oferecer, a nota dada e o motivo.
    negociacaoId?: unknown;
    estrelas?: unknown;
    comentario?: unknown;
    motivo?: unknown;
  };
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
    // ── Visto — um concluído aberto pela primeira vez (19-10-2026, como na Mesa) ──
    if (accao === "visto") {
      await marcarConcluidoComoVisto(pedidoId);
      return NextResponse.json({ ok: true });
    }

    // ── A proposta ao cliente, pelo WhatsApp da CLYON (19-10-2026, o «Enviar pela CLYON» da Mesa) ──
    //
    // Sai do número da plataforma, e a conversa fica com a CLYON. Pela rota
    // dos Trabalhos CLYON, e não pela do WhatsApp: quem só tem esta secção
    // não lê as conversas.
    if (accao === "proposta") {
      const pedido = (await getSimulatorOrderById(pedidoId)) as unknown as Record<string, unknown> | undefined;
      if (!pedido || pedido.valorFixoClyon == null) {
        return NextResponse.json({ error: "Esse pedido não é um Trabalho CLYON." }, { status: 404 });
      }
      const telefone = String(pedido.contactPhone ?? "");
      if (telefone.replace(/\D/g, "").length < 9) {
        return NextResponse.json({ error: "O pedido não tem telemóvel." }, { status: 400 });
      }
      const numero = (v: unknown) => (v == null || v === "" ? null : Number(v));
      const t = {
        valorFixo: Number(pedido.valorFixoClyon),
        taxa: numero(pedido.taxaClyon),
        precoAoCliente: numero(pedido.precoClienteClyon),
      };
      const preco = precoDaPropostaClyon(t);
      if (!preco) return NextResponse.json({ error: "Falta o preço ao cliente." }, { status: 400 });
      const { numeroBloqueadoWhatsApp, retomarNumeroWhatsApp } = await import("@/lib/db");
      if (await numeroBloqueadoWhatsApp(telefone)) {
        return NextResponse.json(
          { error: "Este número está bloqueado. Desbloqueie-o primeiro, no ecrã do WhatsApp." },
          { status: 409 },
        );
      }
      const quandoFoi = pedido.dataAgendada ? new Date(pedido.dataAgendada as string) : null;
      const texto = mensagemDaPropostaClyon(
        {
          cliente: (pedido.contactName as string) ?? null,
          servico: (pedido.serviceType as string) ?? null,
          localidade: (pedido.city as string) ?? null,
          quando: quandoFoi && !Number.isNaN(quandoFoi.getTime()) ? quandoFoi.toISOString() : null,
          preco,
        },
        new Date(),
      );
      const saiu = await enviarTextoManualWhatsApp(telefone, texto);
      if (!saiu) {
        return NextResponse.json(
          {
            error:
              "Não saiu. Ou não há canal configurado, ou a janela de 24 horas desde a última mensagem dele já fechou — use «Enviar proposta ao cliente», do seu WhatsApp.",
          },
          { status: 400 },
        );
      }
      await retomarNumeroWhatsApp(telefone);
      await marcarPropostaEnviada(pedidoId);
      const resumo = `Proposta de ${euros(preco.total)} enviada ao cliente pelo WhatsApp da CLYON, por ${quem}.`;
      await appendOrderHistory(pedidoId, { type: "note", by: por, message: resumo });
      return NextResponse.json({ ok: true, feito: resumo });
    }

    // ── A proposta aberta no WhatsApp de quem está ao backoffice (21-10-2026) ──
    //
    // «Enviar proposta ao cliente» é um link: o servidor não vê a mensagem
    // sair. Abrir o link conta como enviada — o pedido passa a «A aguardar
    // cliente», e fica no histórico quem a abriu.
    if (accao === "proposta_aberta") {
      await marcarPropostaEnviada(pedidoId);
      const resumo = `Proposta aberta no WhatsApp para enviar ao cliente, por ${quem}.`;
      await appendOrderHistory(pedidoId, { type: "note", by: por, message: resumo });
      return NextResponse.json({ ok: true, feito: `#${pedidoId}: proposta enviada — fica em «A aguardar cliente».` });
    }

    // ── Voltar a oferecer a quem recusou (19-10-2026, o «Voltar a mandar» da Mesa) ──
    if (accao === "reoferecer") {
      const alvo = corpo.negociacaoId == null ? null : Number(corpo.negociacaoId);
      if (alvo != null && (!Number.isInteger(alvo) || alvo <= 0)) {
        return NextResponse.json({ error: "Profissional inválido." }, { status: 400 });
      }
      const r = await voltarAOferecerTrabalhoClyon(pedidoId, alvo);
      if (!r.ok) {
        const porque = {
          nao_e_clyon: ["Esse pedido não é um Trabalho CLYON.", 404],
          arrumado: ["Este trabalho está cancelado ou arquivado — restaure-o primeiro.", 409],
          atribuido: ["Este trabalho já tem quem o faça. Para o mudar, use «Trocar profissional».", 409],
          ninguem: ["Não há a quem voltar a oferecer: só se volta a oferecer a quem recusou.", 409],
        } as const;
        const [texto, estado] = porque[r.porque];
        return NextResponse.json({ error: texto }, { status: estado });
      }
      const avisados = await avisarValorNovoDoTrabalhoClyon({
        pedidoId,
        valor: r.valor,
        taxa: r.taxa ?? 0,
        quem: r.avisar,
        motivo: "de_novo",
        baseUrl: urlDeAccaoDoPedido(req.headers),
      });
      const resumo =
        `Trabalho CLYON oferecido outra vez por ${quem} a ${r.avisar.map((q) => q.profissional).join(", ")}, ` +
        `com o mesmo valor (${euros(r.valor)}). ${avisados} de ${r.avisar.length} avisado${r.avisar.length === 1 ? "" : "s"} por WhatsApp.`;
      await appendOrderHistory(pedidoId, { type: "note", by: por, message: resumo });
      return NextResponse.json({ ok: true, feito: resumo, avisados });
    }

    // ── A nota da CLYON ao profissional (19-10-2026, como na Mesa) ───────────
    //
    // O cliente de um Trabalho CLYON fala com a CLYON e não tem link para dar
    // estrelas: sem esta nota, o profissional ficava sem nenhuma.
    if (accao === "avaliar") {
      const negociacaoId = Number(corpo.negociacaoId);
      const estrelas = Number(corpo.estrelas);
      if (!Number.isInteger(negociacaoId) || negociacaoId <= 0 || !Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) {
        return NextResponse.json({ error: "Escolha de 1 a 5 estrelas." }, { status: 400 });
      }
      const comentario =
        typeof corpo.comentario === "string" && corpo.comentario.trim() ? corpo.comentario.trim().slice(0, 600) : null;
      const antes = await quemTemOTrabalhoClyon(pedidoId);
      if (!antes.eClyon) return NextResponse.json({ error: "Esse pedido não é um Trabalho CLYON." }, { status: 404 });
      const gravou = await avaliarProfissional(negociacaoId, pedidoId, estrelas, comentario);
      if (!gravou) {
        return NextResponse.json(
          { error: "Não há nada para avaliar: ou o trabalho ainda não foi confirmado, ou já tem nota." },
          { status: 409 },
        );
      }
      const resumo =
        `CLYON (${quem}) avaliou o profissional com ${estrelas} ${estrelas === 1 ? "estrela" : "estrelas"} em nome do cliente` +
        (comentario ? ` — "${comentario}"` : "") +
        ".";
      await appendOrderHistory(pedidoId, { type: "note", by: por, message: resumo });
      await registarSemFalhar({
        acontecimento: "avaliacao_feita",
        pedidoId,
        negociacaoId,
        autorTipo: colab?.papel === "assistente" ? "assistente" : "clyon",
        autorNome: quem,
        resumo,
      });
      return NextResponse.json({ ok: true, feito: resumo });
    }

    // ── O valor e a taxa ─────────────────────────────────────────────────────
    if (accao === "valor") {
      const valor = lerValorFixo(corpo.valor);
      if (!valor.ok) return NextResponse.json({ error: valor.erro }, { status: 400 });
      const taxa = lerTaxaDoTrabalho(corpo.taxa);
      if (!taxa.ok) return NextResponse.json({ error: taxa.erro }, { status: 400 });

      const r = await mudarValorDoTrabalhoClyon(pedidoId, valor.valor, taxa.taxa);
      // O cliente tem uma proposta com o valor antigo: volta a ser preciso enviá-la.
      await limparPropostaEnviada(pedidoId);
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
      // O motivo, como no «Cancelar pedido» da Mesa (19-10-2026): fica no histórico e vai no aviso.
      const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim().slice(0, 300) : "";
      const pedido = await getSimulatorOrderById(pedidoId);
      const r = await cancelarPedido(pedidoId);
      if (!r) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
      const avisados = await avisarCancelamentoDoTrabalhoClyon({
        pedidoId,
        servico: pedido?.serviceType ?? null,
        localidade: pedido?.city ?? null,
        motivo: motivo || null,
        quem: antes.vivos,
      });
      const resumo =
        `Trabalho CLYON cancelado por ${quem}${motivo ? ` — motivo: ${motivo}` : ""}. ` +
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

    // ── Passar a negociação (20-10-2026, fase 4) ─────────────────────────────
    //
    // Ninguém aceitou o valor fixo: a oferta sai e o pedido deixa de ser um
    // Trabalho CLYON. O envio como negociação é o de sempre (o «Negociação» do
    // «Por decidir», pela rota de promover), que o ecrã chama a seguir.
    if (accao === "para_negociacao") {
      const m = await prepararAMudancaDeTipo(pedidoId, "negociacao");
      if (!m.ok) {
        const [texto, estado] = PORQUE_NAO_MUDA_DE_TIPO[m.porque];
        return NextResponse.json({ error: texto }, { status: estado });
      }
      const resumo =
        `Passou de Trabalho CLYON de valor fixo a negociação, por ${quem}.` +
        (m.tinham.length > 0 ? ` A oferta saiu de ${m.tinham.join(", ")}.` : "");
      await appendOrderHistory(pedidoId, { type: "note", by: por, message: resumo });
      return NextResponse.json({ ok: true, feito: resumo });
    }

    // ── Arquivar (19-10-2026, o «Arquivar» em lote da Mesa) ─────────────────
    //
    // Tira da lista sem apagar, e restaura-se. Ainda por fazer, sai dos
    // profissionais (`updateSimulatorOrder` encerra as negociações vivas) e
    // quem o tinha é avisado — arquivar tira-lho do painel. O que já foi
    // feito fica (`pedido-arrumado.ts`), e por isso ninguém é avisado. O
    // operador não se mexe: a comissão dele não depende de onde está.
    if (accao === "arquivar") {
      const pedido = await getSimulatorOrderById(pedidoId);
      if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
      if (pedido.valorFixoClyon == null) {
        return NextResponse.json({ error: "Esse pedido não é um Trabalho CLYON." }, { status: 404 });
      }
      // `OrderStatus` não tem o «arquivado» (vem do «Arquivar» da Mesa), daí o String.
      if (String(pedido.status) === "arquivado") {
        return NextResponse.json({ error: "Este trabalho já está arquivado." }, { status: 409 });
      }
      // Feito e por confirmar: arquivado, o dinheiro dele ficava sem ninguém a ver.
      const negs = await negociacoesDoPedido(pedidoId);
      if (negs.some((n) => n.estado === "acordada" && n.execucaoEnviadaEm && !n.confirmadoEm)) {
        return NextResponse.json(
          { error: "O profissional já o deu por feito — confirme-o primeiro, e arquive-o depois." },
          { status: 409 },
        );
      }
      const antes = await quemTemOTrabalhoClyon(pedidoId);
      // Num cancelado já ninguém o tem; num feito, fica com quem o fez.
      const avisar = pedidoArrumado(pedido.status) || antes.jaFeito ? [] : antes.vivos;
      await updateSimulatorOrder(pedidoId, { status: "arquivado" });
      const avisados = await avisarCancelamentoDoTrabalhoClyon({
        pedidoId,
        servico: pedido.serviceType ?? null,
        localidade: pedido.city ?? null,
        quem: avisar,
      });
      const resumo =
        `Trabalho CLYON arquivado por ${quem}. ` +
        (avisar.length === 0
          ? "Não estava com nenhum profissional por fazer."
          : `Estava com ${avisar.map((q) => q.profissional).join(", ")} — ` +
            `${avisados} avisado${avisados === 1 ? "" : "s"} por WhatsApp.`);
      await appendOrderHistory(pedidoId, { type: "archived", by: por, message: resumo });
      return NextResponse.json({ ok: true, feito: resumo, avisados });
    }

    // ── Restaurar ────────────────────────────────────────────────────────────
    if (accao === "restaurar") {
      const pedido = await getSimulatorOrderById(pedidoId);
      if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
      if (pedido.valorFixoClyon == null) {
        return NextResponse.json({ error: "Esse pedido não é um Trabalho CLYON." }, { status: 404 });
      }
      if (!pedidoArrumado(pedido.status)) {
        return NextResponse.json({ error: "Este trabalho não está cancelado." }, { status: 409 });
      }
      const r = await restaurarPedidoArrumado(pedidoId);
      if (!r.ok) {
        return r.porque === "nao_existe"
          ? NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
          : NextResponse.json({ error: "Este trabalho não está cancelado." }, { status: 409 });
      }

      /*
       * SEM AVISAR NINGUÉM — decisão do dono, 16-10-2026. Quem soube do
       * cancelamento não sabe que voltou: o resumo diz quem o tem, para se
       * lhe dizer à mão.
       */
      const agora = await quemTemOTrabalhoClyon(pedidoId);
      const dele = agora.vivos.find((q) => q.eraDele);
      const resumo =
        `Trabalho CLYON restaurado por ${quem}, sem avisar ninguém. ` +
        (agora.vivos.length === 0
          ? "Não estava com nenhum profissional."
          : dele
            ? `Voltou a ${dele.profissional}, que o tinha — se ele soube do cancelamento, diga-lhe que voltou.`
            : `Voltou a ${agora.vivos.length} ${agora.vivos.length === 1 ? "profissional" : "profissionais"}, como estava.`) +
        (r.reconstruido && agora.vivos.length > 0
          ? " O estado de cada negociação foi deduzido das propostas — o cancelamento era anterior a ficar guardado."
          : "");
      await appendOrderHistory(pedidoId, { type: "note", by: por, message: resumo });
      await registarSemFalhar({
        acontecimento: "pedido_reaberto",
        pedidoId,
        autorTipo: colab?.papel === "assistente" ? "assistente" : "clyon",
        autorNome: quem,
        estadoAntes: r.estadoAntes,
        estadoDepois: r.statusDeVolta,
        resumo: resumo.slice(0, 500),
      });
      return NextResponse.json({ ok: true, feito: resumo });
    }

    // ── O preço ao cliente de um trabalho antigo ─────────────────────────────
    if (accao === "preco") {
      const lido = lerPrecoAoCliente(corpo.precoAoCliente);
      if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
      const r = await definirPrecoAoClienteClyon(pedidoId, lido.valor);
      await limparPropostaEnviada(pedidoId);
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
