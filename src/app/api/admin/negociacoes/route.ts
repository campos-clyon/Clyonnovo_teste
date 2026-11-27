import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  appendOrderHistory,
  comOsChoquesDaAgenda,
  getSimulatorOrderById,
  gravarValorUnico,
  marcarConcluidoComoVisto,
  parceirosParaOValorUnico,
  marcarOrcamentoEnviado,
  numeroBloqueadoWhatsApp,
  pedidosComNegociacoes,
  retomarNumeroWhatsApp,
} from "@/lib/db";
import { enviarTextoManualWhatsApp } from "@/lib/whatsapp-cloud";
import { confiancaDasNegociacoes, type ConfiancaDaNegociacao } from "@/lib/confianca-na-mesa";
import { escolhidosDeJson, estadoNaMesa } from "@/lib/escolhidos-sem-resposta";
import { registarQueOClientePediu } from "@/lib/escolhidos-sem-resposta-no-servidor";
import { pedidoFechado } from "@/lib/pedido-arrumado";
import { negociacoesNoNovoModelo, regimesDasNegociacoes } from "@/lib/novo-modelo-no-servidor";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";
import { negociacoesComDadosDePagamentoMudados } from "@/lib/dados-de-pagamento-mudados-na-base";
import { negociacoesComDadosPorConfirmar } from "@/lib/dados-de-pagamento-por-confirmar-na-base";
import { lerValorUnico, linhasDoValorUnico, valorUnicoComIva } from "@/lib/valor-unico";
import { avisarClienteDoValorUnico } from "@/lib/email-proposta";
import { aceitesDoValorUnico, marcarValorUnicoAceite, type AceiteDoValorUnico } from "@/lib/valor-unico-no-whatsapp-na-base";
import { lerBase } from "@/lib/base-do-preco";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";
import { notaDaVariante } from "@/lib/mensagem-das-propostas";
import { foraDaGrelhaDosPedidos } from "@/lib/custo-do-trabalho-no-servidor";
import type { ForaDaGrelhaNaMesa } from "@/lib/custo-do-trabalho";
import { ruaEmFaltaDosPedidos } from "@/lib/rua-depois-do-aceite-na-base";
import { registosDoPagamento } from "@/lib/pagamento-registado-na-base";
import { registoDoPagamento } from "@/lib/pagamento-registado";
import { reservasDe } from "@/lib/reserva-na-base";

export const runtime = "nodejs";

/** As negociações do modelo de 15-11 (d10): a regra é uma só — `negociacoesNoNovoModelo`. */
function modeloDasNegociacoes(
  negociacoes: Array<{ id: unknown; estado?: unknown; ofertaClyon?: unknown }>,
): Promise<Set<number>> {
  return negociacoesNoNovoModelo(negociacoes, agoraDoModelo());
}

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
    // Quem já tem outro trabalho a essa hora fica a vermelho ao escolher (21-10-2026).
    const pedidos = await comOsChoquesDaAgenda(await pedidosComNegociacoes(tudo ? 500 : 60));
    /*
     * A CONFIANÇA — 04-11-2026 (d10.1, d10.3): a guia por verificar trava o
     * aceitar e o contratar, e o cliente e o parceiro com o mesmo contacto dão
     * alerta. Se a leitura falhar, a Mesa sai na mesma, sem isto.
     */
    const confianca = await confiancaDasNegociacoes(
      pedidos.flatMap((p) => p.negociacoes.map((n) => Number(n.id))),
    ).catch((e) => {
      console.error("[api/admin/negociacoes GET] confiança:", e);
      return new Map<number, ConfiancaDaNegociacao>();
    });
    // Os escolhidos sem resposta (d6): o selo, a linha e os botões saem escritos daqui, pela regra de todos.
    const agora = new Date();
    // d10: o modelo de 15-11 de cada negociação, para a mensagem do orçamento (`mensagemDasPropostas`).
    const doNovoModelo = await modeloDasNegociacoes(pedidos.flatMap((p) => p.negociacoes));
    // d17: e o regime de cada uma, para o texto dizer o total do cartão (`totalAoClienteDaNegociacao`).
    const regimes = await regimesDasNegociacoes([...doNovoModelo]);
    // d143: a reserva do valor único, para o «parceiro recebe» do cabeçalho sair da mesma conta.
    const reservas = await reservasDe([...doNovoModelo]).catch(() => new Map<number, number>());
    // d28: o selo «dados de pagamento mudados» — o IBAN ou o MB WAY mudaram depois de o cliente contratar.
    const dadosMudados = await negociacoesComDadosDePagamentoMudados(
      pedidos.flatMap((p) => p.negociacoes).filter((n) => n.estado === "acordada" && doNovoModelo.has(Number(n.id))).map((n) => Number(n.id)),
    ).catch((e) => {
      console.error("[api/admin/negociacoes GET] dados de pagamento mudados:", e);
      return new Set<number>();
    });
    // d3 (23-11-2026): o pagamento ao parceiro registado — «cliente disse», «pago» ou «em dúvida» (o selo).
    const registos = await registosDoPagamento(
      pedidos.flatMap((p) => p.negociacoes).filter((n) => n.estado === "acordada" && doNovoModelo.has(Number(n.id))).map((n) => Number(n.id)),
    ).catch((e) => {
      console.error("[api/admin/negociacoes GET] registo do pagamento:", e);
      return new Map<number, Awaited<ReturnType<typeof registosDoPagamento>> extends Map<number, infer V> ? V : never>();
    });
    // d5: os dados de pagamento retidos até a CLYON os confirmar com o parceiro (mudados, ou titular que não bate).
    const porConfirmar = await negociacoesComDadosPorConfirmar(
      pedidos.flatMap((p) => p.negociacoes).filter((n) => n.estado === "acordada" && doNovoModelo.has(Number(n.id))).map((n) => Number(n.id)),
    ).catch((e) => {
      console.error("[api/admin/negociacoes GET] dados por confirmar:", e);
      return new Map<number, "mudaram" | "titular">();
    });
    // d39: a nota e o «verificado» de quem propôs, para o «Escolher por mim» do valor único.
    const dosParceiros = await parceirosParaOValorUnico(
      pedidos.filter((p) => p.valorUnicoCliente != null).flatMap((p) => p.negociacoes.map((n) => Number(n.providerId))),
    ).catch((e) => {
      console.error("[api/admin/negociacoes GET] parceiros do valor único:", e);
      return new Map<number, { nota: { media: number; quantas: number } | null; verificado: boolean }>();
    });
    // d39: o valor único aceite pelo cliente (WhatsApp ou marcado pela equipa) — «escolher o parceiro».
    const aceites = await aceitesDoValorUnico(pedidos.filter((p) => p.valorUnicoCliente != null).map((p) => Number(p.id))).catch(
      () => new Map<number, AceiteDoValorUnico>(),
    );
    // d61 (modo sombra): a etiqueta «Fora da grelha», com o custo em degraus — só a equipa a vê.
    const foraDaGrelha = await foraDaGrelhaDosPedidos(pedidos.map((p) => Number(p.id))).catch((e) => {
      console.error("[api/admin/negociacoes GET] fora da grelha:", e);
      return new Map<number, ForaDaGrelhaNaMesa>();
    });
    // d69: «falta a rua» — o pedido só com a zona, e se a Vitória já a pediu ao cliente.
    const semRua = await ruaEmFaltaDosPedidos(pedidos.map((p) => Number(p.id))).catch((e) => {
      console.error("[api/admin/negociacoes GET] falta a rua:", e);
      return new Map<number, { aceite: boolean; pedidaEm: string | null; passadaEm: string | null }>();
    });
    // d128: «fora da zona» — a morada (ou a origem da mudança) acima do limite das Configs.
    const { foraDaZonaDosPedidos: foraDaZonaDe } = await import("@/lib/fora-da-zona-na-base");
    const foraDaZona = await foraDaZonaDe(pedidos.map((p) => Number(p.id)));
    // d88: o envio automático das propostas ao cliente — a linha do cartão (quando a Vitória envia, ou porque fica com uma pessoa).
    const { linhasDoEnvioNaMesa } = await import("@/lib/envio-das-propostas-ao-cliente-na-base");
    const envioAutomatico = await linhasDoEnvioNaMesa(agora, pedidos).catch(() => new Map<number, string>());
    return NextResponse.json({
      pedidos: pedidos.map((p) => ({
        ...p,
        envioAutomatico: envioAutomatico.get(Number(p.id)) ?? null,
        valorUnicoAceite: aceites.get(Number(p.id)) ?? null,
        foraDaGrelha: foraDaGrelha.get(Number(p.id)) ?? null,
        foraDaZona: foraDaZona.get(Number(p.id)) ?? null,
        faltaARua: semRua.get(Number(p.id)) ?? null,
        escolhidosNaMesa: estadoNaMesa(
          JSON.parse(JSON.stringify(p.negociacoes)),
          escolhidosDeJson(p.escolhidosJson),
          agora,
          pedidoFechado(p.status),
        ),
        negociacoes: p.negociacoes.map((n) => ({
          ...n,
          ...(confianca.get(Number(n.id)) ?? {}),
          ...(doNovoModelo.has(Number(n.id)) ? { noNovoModelo: true } : {}),
          ...(dadosMudados.has(Number(n.id)) ? { dadosDePagamentoMudados: true } : {}),
          ...(registos.has(Number(n.id)) ? { pagamentoRegistado: registoDoPagamento(registos.get(Number(n.id))!) } : {}),
          ...(porConfirmar.has(Number(n.id)) ? { dadosDePagamentoPorConfirmar: porConfirmar.get(Number(n.id)) } : {}),
          ...(dosParceiros.has(Number(n.providerId)) ? { doValorUnico: dosParceiros.get(Number(n.providerId)) } : {}),
          ...(reservas.has(Number(n.id)) ? { reservaCent: reservas.get(Number(n.id)) } : {}),
          ...(doNovoModelo.has(Number(n.id)) && regimes.has(Number(n.id))
            ? { regimeParaOTotal: regimes.get(Number(n.id)) }
            : {}),
        })),
      })),
    });
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
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { accao?: unknown; pedidoId?: unknown; texto?: unknown; marcarEnviado?: unknown; valor?: unknown; email?: unknown; outraVez?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  // «O cliente pediu que procurássemos» (d6): o pedido feito por telefone ou WhatsApp, registado por quem o ouviu.
  if (corpo.accao === "cliente_pediu_mais_parceiros" && Number.isInteger(Number(corpo.pedidoId)) && Number(corpo.pedidoId) > 0) {
    const r = await registarQueOClientePediu(Number(corpo.pedidoId), colab?.nome ?? "a CLYON");
    return NextResponse.json(r.corpo, { status: r.status });
  }
  /*
   * O VALOR ÚNICO ACEITE, MARCADO PELA EQUIPA — 15-11-2026 (d39): o cliente
   * aceitou por telefone. O mesmo estado que a Vitória grava quando lê o «SIM».
   */
  if (corpo.accao === "valor_unico_aceite" && Number.isInteger(Number(corpo.pedidoId)) && Number(corpo.pedidoId) > 0) {
    const pedidoId = Number(corpo.pedidoId);
    const quem = colab?.nome ?? "a CLYON";
    if (!(await marcarValorUnicoAceite(pedidoId, quem))) {
      return NextResponse.json(
        { error: "Este pedido não tem valor único por aceitar (ou já está marcado como aceite)." },
        { status: 409 },
      );
    }
    await appendOrderHistory(pedidoId, {
      type: "valor_unico_aceite",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: `O cliente aceitou o valor único por telefone (registado por ${quem}). Falta escolher o parceiro e aceitar a proposta dele na Mesa.`,
    });
    return NextResponse.json({ ok: true });
  }
  /*
   * O VALOR ÚNICO AO CLIENTE — 15-11-2026 (d39). Grava (ou tira, com
   * `valor: null`) o valor único de um pedido que negoceia; as negociações
   * continuam vivas. Com `email: true`, manda-lhe também o email com a mesma
   * mensagem (só quando a equipa carrega).
   */
  if (corpo.accao === "valor_unico" && Number.isInteger(Number(corpo.pedidoId)) && Number(corpo.pedidoId) > 0) {
    const pedidoId = Number(corpo.pedidoId);
    const tirar = corpo.valor === null;
    const lido = tirar ? null : lerValorUnico(corpo.valor);
    if (lido && !lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
    const valor = lido && lido.ok ? lido.valor : null;
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (!(await gravarValorUnico(pedidoId, valor))) {
      return NextResponse.json(
        { error: "Este pedido já não aceita valor único: é um Trabalho CLYON, está fechado ou já tem parceiro contratado." },
        { status: 409 },
      );
    }
    const quem = colab?.nome ?? "a CLYON";
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message:
        valor == null
          ? `Valor único tirado por ${quem}: o cliente volta a ver as propostas.`
          : `Valor único ao cliente: ${valorUnicoComIva(valor)}, por ${quem}. As propostas continuam abertas; a CLYON escolhe o parceiro.`,
    });
    let email: "enviado" | "sem_email" | "falhou" | null = null;
    if (valor != null && corpo.email === true) {
      const para = String(pedido.contactEmail ?? "").trim();
      if (!para.includes("@")) email = "sem_email";
      else {
        const saiu = await avisarClienteDoValorUnico({
          para,
          pedidoId,
          linhas: linhasDoValorUnico(
            {
              nomeCliente: pedido.contactName ?? null,
              servico: servicoEmPalavras(pedido.serviceType ?? null).toLowerCase(),
              servicoId: pedido.serviceType ?? null,
              cidade: pedido.city ?? null,
              valorSemIva: valor,
              base: lerBase(pedido.baseDoPreco),
            },
            new Date(),
          ),
          valorComIva: valorUnicoComIva(valor),
        });
        email = saiu ? "enviado" : "falhou";
        if (saiu) {
          await appendOrderHistory(pedidoId, {
            type: "note",
            by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
            message: `Valor único enviado ao cliente por email, por ${quem}.`,
          });
        }
      }
    }
    return NextResponse.json({ ok: true, valor, email });
  }
  if (
    !["concluido_visto", "orcamento_enviado", "enviar_pela_clyon"].includes(String(corpo.accao)) ||
    !Number.isInteger(Number(corpo.pedidoId))
  ) {
    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  }
  /*
   * O ORÇAMENTO FOI AO CLIENTE — 21-10-2026. «Enviar orçamento» abriu o
   * WhatsApp com as propostas, ou «Já enviei» (seguiu por outro canal): o
   * pedido passa a «A aguardar cliente», e fica no histórico quem foi.
   */
  if (corpo.accao === "orcamento_enviado") {
    const pedidoId = Number(corpo.pedidoId);
    await marcarOrcamentoEnviado(pedidoId);
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      // d91: a variante A/B da mensagem das propostas, lida do texto que saiu.
      message: `Orçamento enviado ao cliente, por ${colab?.nome ?? "a CLYON"} — à espera da resposta dele.${notaDaVariante(typeof corpo.texto === "string" ? corpo.texto : null)}`,
    });
    return NextResponse.json({ ok: true });
  }
  /*
   * «ENVIAR PELA CLYON» — 23-10-2026. *«As negociações, as mesmas opções de
   * enviar mensagem no WhatsApp para o cliente — enviar a proposta, enviar
   * pela CLYON…»* — o dono. O orçamento sai do número da plataforma, como o
   * dos Trabalhos CLYON (`accao: "proposta"` na rota deles), e a conversa
   * fica com a CLYON. O texto é o do ecrã (`mensagemDasPropostas`); o
   * número é o do pedido, lido aqui — nunca um que venha do browser.
   */
  if (corpo.accao === "enviar_pela_clyon") {
    const pedidoId = Number(corpo.pedidoId);
    const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
    if (!texto || texto.length > 4000) {
      return NextResponse.json({ error: "A mensagem está vazia, ou é longa demais." }, { status: 400 });
    }
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    const telefone = String(pedido.contactPhone ?? "");
    if (telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "O pedido não tem telemóvel." }, { status: 400 });
    }
    if (await numeroBloqueadoWhatsApp(telefone)) {
      return NextResponse.json(
        { error: "Este número está bloqueado. Desbloqueie-o primeiro, no ecrã do WhatsApp." },
        { status: 409 },
      );
    }
    /*
     * UMA VEZ SÓ — 15-11-2026 (d47). Ao #623 a proposta saiu duas vezes seguidas
     * (o link em português e a CLYON em inglês). Se já foi há pouco — por aqui
     * ou pelo link —, pergunta-se antes de mandar outra vez.
     */
    if (corpo.outraVez !== true) {
      const { minutosDesdeAPropostaEnviada, MINUTOS_PARA_REENVIAR_A_PROPOSTA } = await import("@/lib/db");
      const ha = await minutosDesdeAPropostaEnviada(pedidoId).catch(() => null);
      if (ha != null && ha < MINUTOS_PARA_REENVIAR_A_PROPOSTA) {
        return NextResponse.json(
          {
            error: `A proposta já foi ao cliente há ${ha} min (pela ligação ou pela CLYON). Mandar outra vez?`,
            jaEnviada: true,
            haMinutos: ha,
          },
          { status: 409 },
        );
      }
    }
    /*
     * NA LÍNGUA DA CONVERSA, OU NÃO SAI — 23-11-2026 (d88, o #659): a cliente
     * escrevia em inglês e o orçamento saiu em português. Noutra língua sai
     * traduzido (o tradutor, ou a tradução fixa); sem tradução, não sai e
     * diz-se porquê — a equipa escreve-lhe à mão, na língua dele.
     */
    const { orcamentoNaLinguaDaConversa } = await import("@/lib/lingua-da-conversa");
    const naLingua = await orcamentoNaLinguaDaConversa(telefone, texto, { guardar: true });
    if (!naLingua.ok) {
      return NextResponse.json(
        { error: `Não saiu: ${naLingua.motivo}.`, semTraducao: naLingua.lingua },
        { status: 409 },
      );
    }
    const saiu = await enviarTextoManualWhatsApp(telefone, texto, { semLinguaErrada: true });
    if (!saiu) {
      return NextResponse.json(
        {
          error:
            "Não saiu. Ou não há canal configurado, ou a janela de 24 horas desde a última mensagem dele já fechou — use «Enviar orçamento», do seu WhatsApp.",
        },
        { status: 400 },
      );
    }
    await retomarNumeroWhatsApp(telefone);
    if (corpo.marcarEnviado === true) await marcarOrcamentoEnviado(pedidoId);
    const resumo = `Orçamento enviado ao cliente pelo WhatsApp da CLYON, por ${colab?.nome ?? "a CLYON"}.`;
    await appendOrderHistory(pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      // d91: a variante A/B da mensagem das propostas, lida do texto que saiu.
      message: `${resumo}${notaDaVariante(texto)}`,
    });
    return NextResponse.json({
      ok: true,
      feito: `#${pedidoId}: ${resumo.charAt(0).toLowerCase()}${resumo.slice(1)}${corpo.marcarEnviado === true ? " Fica em «A aguardar cliente»." : ""}`,
    });
  }
  await marcarConcluidoComoVisto(Number(corpo.pedidoId));
  return NextResponse.json({ ok: true });
}
