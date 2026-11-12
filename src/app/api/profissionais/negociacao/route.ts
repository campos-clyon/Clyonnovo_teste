import { NextRequest, NextResponse } from "next/server";
import { lerForma } from "@/lib/forma-de-pagamento";
import {
  negociacoesDoProfissional,
  gravarNegociacao,
  appendOrderHistory,
  tarifaCongeladaDaNegociacao,
  prazoDoEscolhido,
} from "@/lib/db";
import { guardaDaHoraCongelada, horaCongeladaCent, pessoasDaEscolha, SEM_CONFERIR_A_HORA } from "@/lib/mudanca-escolhida-pelo-cliente";
import { tarifaCongeladaDeJson } from "@/lib/conta-da-mudanca";
import {
  ACCAO_DE_CONFIRMAR_A_HORA,
  erroDaConfirmacao,
  ERROS_DO_ESCOLHIDO,
  linhaDaRespostaTardia,
  textoDaPropostaMaisBaixa,
  textoDepoisDeConfirmar,
} from "@/lib/escolhidos-sem-resposta";
import { pedidoFechado } from "@/lib/pedido-arrumado";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { JA_FOI_DECIDIDO } from "@/lib/ja-foi-decidido";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { modoDaOferta } from "@/lib/oferta-clyon";
import { responderOfertaClyon } from "@/lib/responder-oferta-clyon";
import { avisarOClienteDoPedido } from "@/lib/avisos-ao-cliente";
import {
  propor,
  aceitar,
  desistir,
  type Negociacao,
  type Proposta,
} from "@/lib/negociacao";

export const runtime = "nodejs";

/**
 * Negociar a partir do painel, com sessão em vez de token.
 *
 * A mesma negociação e o mesmo motor da rota do link do email — muda só como
 * se prova quem está a falar. Existe porque obrigar o profissional a ir buscar
 * o email para responder a uma proposta era pedir-lhe que guardasse mensagens
 * antigas para trabalhar: ao terceiro pedido já não sabe qual é qual.
 *
 * O `providerId` vem da sessão e NUNCA do corpo. A negociação é procurada
 * dentro das que são dele; um id de outro profissional simplesmente não
 * aparece nessa lista, e a resposta é "não encontrada".
 *
 * Contratar não está aqui. É acção do cliente — o aperto de mão duplo perdia o
 * sentido se o profissional pudesse fechar sozinho.
 */
function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: {
    accao?: unknown;
    valor?: unknown;
    negociacaoId?: unknown;
    /** O profissional leu os avisos e quer avançar mesmo assim. */
    avisosAceites?: unknown;
    /** Os materiais da proposta (31-10-2026): `{ incluidos: true }` ou `{ incluidos: false, itens }`. */
    materiais?: unknown;
  };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Negociação não indicada." }, { status: 400 });
  }

  try {
    const minhas = await negociacoesDoProfissional(sessao.providerId);
    const linha = minhas.find((n) => n.id === negociacaoId);
    if (!linha) {
      return NextResponse.json({ error: "Negociação não encontrada." }, { status: 404 });
    }

    const agora = new Date();
    const estadoActual: Negociacao = {
      estado: linha.estado as Negociacao["estado"],
      valorAcordado: linha.valorAcordado != null ? Number(linha.valorAcordado) : null,
      propostas: propostasDe(linha.propostasJson),
    };

    /*
     * OS AVISOS, ANTES DE O NÚMERO SAIR — 14-09-2026.
     *
     * A fatura e a guia deixaram de esconder o pedido (ver
     * `profissional-elegivel`). Em troca, param aqui: quem vai cotar vê o que
     * o cliente pediu e confirma, ou não avança.
     *
     * SÓ AO PROPOR E AO ACEITAR — as duas acções que criam um compromisso.
     * Desistir nunca se pergunta duas vezes a ninguém.
     *
     * A conta é feita do lado do SERVIDOR e não se fia no que o browser diz:
     * o `avisosAceites` só serve para saber que o ecrã os mostrou. Quais eram,
     * e se ainda são, é aqui que se decide.
     */
    /*
     * «CONFIRMO: FAÇO POR X/H + IVA» — 11-11-2026 (d6). Numa mudança em que o
     * cliente o escolheu, a primeira resposta é um toque: a hora dele, que
     * ficou congelada na negociação, vai como proposta num só pedido — o
     * valor lê-se da base, nunca do corpo. Depois do prazo ainda se confirma;
     * com o pedido cancelado, fechado, contratado a outro ou já respondido,
     * lê a frase certa (`erroDaConfirmacao`).
     */
    const confirmaAHora = corpo.accao === ACCAO_DE_CONFIRMAR_A_HORA;
    let horaConfirmada: { cent: number; iva: number } | null = null;
    if (confirmaAHora) {
      const estadoDoPedido = (linha as { estadoDoPedido?: string | null }).estadoDoPedido ?? null;
      const naoPode = erroDaConfirmacao({
        estado: linha.estado,
        propostasJson: linha.propostasJson,
        estadoDoPedido,
        pedidoFechado: pedidoFechado(estadoDoPedido),
      });
      if (naoPode) return NextResponse.json({ error: naoPode.erro, semBotoes: naoPode.semBotoes }, { status: 409 });
      let congelada: Awaited<ReturnType<typeof tarifaCongeladaDaNegociacao>>;
      try {
        congelada = await tarifaCongeladaDaNegociacao(negociacaoId, sessao.providerId);
      } catch (e) {
        console.error("[negociacao] a hora congelada não se leu; a confirmação não segue:", e instanceof Error ? e.message : e);
        return NextResponse.json({ error: SEM_CONFERIR_A_HORA }, { status: 503 });
      }
      const tarifa = tarifaCongeladaDeJson(congelada?.tarifaCongeladaJson ?? null);
      if (!congelada || !tarifa) return NextResponse.json({ error: ERROS_DO_ESCOLHIDO.semHora }, { status: 409 });
      horaConfirmada = {
        cent: horaCongeladaCent(tarifa, pessoasDaEscolha(congelada.pessoasEscolhidas)) ?? tarifa.precoHora2Cent,
        iva: tarifa.regras.iva,
      };
    }

    const compromete = corpo.accao === "propor" || corpo.accao === "aceitar" || confirmaAHora;

    /*
     * O MODELO DE 15-11-2026 — d10. Sem o IBAN, o MB WAY e o regime de IVA
     * (passado o aviso), ou em stand-by por um valor em atraso, não aceita nem
     * envia proposta. Antes da data não faz nada (nem vai à base).
     */
    if (compromete) {
      const { impedimentoDoNovoModelo } = await import("@/lib/novo-modelo-no-servidor");
      const impedimento = await impedimentoDoNovoModelo(sessao.providerId);
      if (impedimento) return NextResponse.json(impedimento.corpo, { status: impedimento.status });
    }

    /*
     * DÍVIDA EM ATRASO FECHA OS TRABALHOS EM DINHEIRO — 01-10-2026.
     *
     * «Abater no saldo + bloquear», decisão do dono: uma dívida à CLYON por
     * pagar há mais de 7 dias impede-o de propor e aceitar em trabalhos pagos
     * em dinheiro (os pela plataforma continuam). A forma é a desta negociação,
     * congelada quando nasceu. Ver `bloqueio-por-divida.ts`.
     */
    if (
      compromete &&
      lerForma((linha as { formaDePagamento?: unknown }).formaDePagamento) === "dinheiro"
    ) {
      const { bloqueioDoProfissional } = await import("@/lib/bloqueio-do-profissional");
      const b = await bloqueioDoProfissional(sessao.providerId, agora);
      if (b.bloqueado) {
        return NextResponse.json(
          { error: b.explicacao, bloqueadoPorDivida: true },
          { status: 403 },
        );
      }
    }

    if (compromete) {
      const { perfilDoProfissional } = await import("@/lib/db");
      const { avisosDoTrabalho } = await import("@/lib/profissional-elegivel");
      const perfil = await perfilDoProfissional(sessao.providerId).catch(() => undefined);
      const avisos = perfil
        ? avisosDoTrabalho(
            // A fatura já não entra: desde 22-09-2026 é a parceira da CLYON
            // que a emite, seja quem for o profissional (29-09-2026).
            {
              precisaGuiaTransporte: Number(linha.precisaGuiaTransporte) === 1,
              formaDePagamento: lerForma((linha as { formaDePagamento?: unknown }).formaDePagamento),
              // O entulho exige a guia sempre (04-11-2026, d10.1).
              serviceType: linha.serviceType ?? null,
            },
            {
              emiteGuiaTransporte: Number(perfil.emiteGuiaTransporte) === 1,
              guiaVerificadaEm: (perfil.guiaVerificadaEm as Date | string | null) ?? null,
            },
          )
        : [];

      if (avisos.length > 0 && corpo.avisosAceites !== true) {
        // 409 e não 400: o pedido está bem formado, falta é uma decisão de
        // quem o mandou. O ecrã pinta a caixa amarela com o que vem aqui.
        return NextResponse.json({ error: "Confirme os avisos.", avisos }, { status: 409 });
      }

      /*
       * O RASTO. É por isto que o aviso da guia pode dizer «fica registado no
       * pedido»: sem isto a frase era só uma frase, e no dia em que houvesse
       * um problema ninguém saberia quem tinha sido avisado de quê.
       */
      if (avisos.length > 0) {
        const { appendOrderHistory } = await import("@/lib/db");
        const { comoFicaRegistado } = await import("@/lib/avisos-antes-de-cotar");
        await appendOrderHistory(linha.pedidoId, {
          type: "aviso_aceite_pelo_profissional",
          by: { id: sessao.providerId, nome: sessao.nome ?? "profissional", role: "profissional" },
          message: comoFicaRegistado(avisos, sessao.nome ?? "O profissional"),
        }).catch(() => {});
      }
    }

    /*
     * UM TRABALHO CLYON DE VALOR FIXO — 02-10-2026. Só aceitar ou recusar, e a
     * resposta segue por `responderOfertaClyon` (a mesma nas duas portas). Sai
     * daqui antes de chegar aos avisos ao cliente lá em baixo: o cliente destes
     * trabalhos fala com a CLYON. Ver `oferta-clyon.ts`.
     */
    const modoOferta = modoDaOferta(linha.ofertaClyon);
    if (modoOferta) {
      const r = await responderOfertaClyon({
        negociacaoId,
        pedidoId: linha.pedidoId,
        providerId: sessao.providerId,
        nome: sessao.nome ?? "O profissional",
        estadoActual,
        accao: corpo.accao,
        modo: modoOferta,
        baseUrl: urlDeAccaoDoPedido(req.headers),
        agora,
        valorVisto: (corpo as { valorVisto?: unknown }).valorVisto,
      });
      return NextResponse.json(r.corpo, { status: r.status });
    }

    let resultado;
    switch (corpo.accao) {
      case "propor": {
        const valor =
          typeof corpo.valor === "string" ? Number(corpo.valor.replace(",", ".")) : corpo.valor;
        /*
         * UMA MUDANÇA EM QUE O CLIENTE O ESCOLHEU — 11-11-2026 (fase 2). A
         * proposta é à hora (o pedido é por hora) e não passa da hora dele que
         * ficou congelada quando o cliente o escolheu; pode descer. Ver
         * mudanca-escolhida-pelo-cliente.ts.
         */
        // Se a hora congelada não se conseguir ler, a proposta NÃO segue (11-11-2026).
        const recusa = await guardaDaHoraCongelada(
          () => tarifaCongeladaDaNegociacao(negociacaoId, sessao.providerId),
          Number(valor),
          "negociacao",
        );
        if (recusa) return NextResponse.json({ error: recusa.erro, ...(recusa.acimaDaHora ? { acimaDaHora: true } : {}) }, { status: recusa.status });
        resultado = propor(estadoActual, "profissional", Number(valor), agora);
        break;
      }
      // «Confirmo: faço por X/h + IVA» (d6): a hora congelada, lida da base lá em cima, como proposta num só pedido.
      case ACCAO_DE_CONFIRMAR_A_HORA: {
        if (!horaConfirmada) return NextResponse.json({ error: ERROS_DO_ESCOLHIDO.semHora }, { status: 409 });
        resultado = propor(estadoActual, "profissional", horaConfirmada.cent / 100, agora);
        break;
      }
      case "aceitar":
        resultado = aceitar(estadoActual, "profissional", agora);
        break;
      case "desistir":
        resultado = desistir(estadoActual, "profissional", agora);
        break;
      default:
        return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
    }

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.erro }, { status: 409 });
    }

    const nova = resultado.negociacao;
    // Quem fica sem o trabalho — lido antes de encerrar, avisado depois (28-10-2026, d5).
    const { quemVaiFicarSemOTrabalho, avisarQuemFicouSemOTrabalho } = await import("@/lib/avisar-quem-perdeu");
    const perdem = nova.estado === "acordada" ? await quemVaiFicarSemOTrabalho(linha.pedidoId, negociacaoId) : [];
    /*
     * SÓ SE NINGUÉM DECIDIU PRIMEIRO — 10-11-2026 (d26). A escrita leva o
     * estado que se leu: se o cliente recusou, contratou outro ou respondeu
     * entretanto, o parceiro lê «já foi decidido» em vez de escrever por cima.
     * Um fecho, se o motor lá chegar, faz-se numa só transacção.
     */
    const gravou = await gravarNegociacao(
      negociacaoId,
      {
        estado: nova.estado,
        valorAcordado: nova.valorAcordado ?? null,
        propostasJson: JSON.stringify(nova.propostas),
      },
      { estado: linha.estado, pedidoId: linha.pedidoId },
    );
    if (!gravou.ok) return NextResponse.json({ error: JA_FOI_DECIDIDO, jaDecidido: true }, { status: 409 });

    /*
     * O ESCOLHIDO RESPONDEU — 11-11-2026 (d6). Se a primeira resposta dele
     * (confirmar, propor mais baixo ou «Não estou interessado») chega depois
     * do prazo, fica escrito no pedido; e a resposta leva a frase que o
     * painel e a app mostram no lugar dos botões.
     */
    let textoDoEscolhido: string | null = null;
    let depoisDoPrazo = false;
    if (confirmaAHora || corpo.accao === "propor" || corpo.accao === "desistir") {
      const doEscolhido = await prazoDoEscolhido(negociacaoId, sessao.providerId);
      const prazo = instanteDaBase(doEscolhido?.prazoRespostaEm ?? null);
      const primeiraResposta = !estadoActual.propostas.some((x) => x.por === "profissional");
      depoisDoPrazo = !!prazo && primeiraResposta && prazo.getTime() < agora.getTime();
      if (depoisDoPrazo) {
        await appendOrderHistory(linha.pedidoId, {
          type: "note",
          by: null,
          message: linhaDaRespostaTardia(sessao.nome ?? "O profissional", agora),
        }).catch(() => {});
      }
      if (horaConfirmada) textoDoEscolhido = textoDepoisDeConfirmar(horaConfirmada.cent, horaConfirmada.iva, depoisDoPrazo);
      else if (doEscolhido && corpo.accao === "propor") {
        const tarifa = tarifaCongeladaDeJson(
          (await tarifaCongeladaDaNegociacao(negociacaoId, sessao.providerId).catch(() => null))?.tarifaCongeladaJson ?? null,
        );
        const ultima = nova.propostas[nova.propostas.length - 1];
        if (tarifa && ultima) textoDoEscolhido = textoDaPropostaMaisBaixa(Math.round(ultima.valor * 100), tarifa.regras.iva);
      }
    }

    /*
     * OS MATERIAIS DA PROPOSTA — 31-10-2026. Ao propor (ou aceitar), ele diz se
     * o valor já inclui os materiais ou o preço de cada um à parte. O último
     * que disse é o que vale; uma app antiga que não manda nada deixa o que lá
     * estava. Ver `materiais-da-proposta.ts`.
     */
    if (corpo.accao === "propor" || corpo.accao === "aceitar") {
      const { lerMateriaisDaProposta } = await import("@/lib/materiais-da-proposta");
      const materiais = lerMateriaisDaProposta(corpo.materiais);
      if (materiais) {
        const { gravarMateriaisDaProposta } = await import("@/lib/db");
        await gravarMateriaisDaProposta(negociacaoId, sessao.providerId, JSON.stringify(materiais)).catch((e) =>
          console.error("[negociacao] materiais não gravaram:", e),
        );
      }
    }

    // Um profissional a aceitar não fecha nada — passa a bola ao cliente. Mas
    // se o motor chegar a "acordada" por outro caminho, as outras negociações
    // do mesmo pedido têm de terminar, como na rota do token.
    if (nova.estado === "acordada") {
      const encerradas = gravou.encerradas;
      await appendOrderHistory(linha.pedidoId, {
        type: "created",
        by: null,
        message:
          `Negociação #${negociacaoId} fechada em ${nova.valorAcordado} €.` +
          (encerradas > 0 ? ` ${encerradas} outra(s) encerrada(s).` : ""),
      });
      if (encerradas > 0) await avisarQuemFicouSemOTrabalho({ pedidoId: linha.pedidoId, quem: perdem, porque: "outro" });
    }


    // Avisar o outro lado. Uma proposta que ninguém vê não morre (já não há
    // prazo, ver `AS_PROPOSTAS_EXPIRAM`), mas fica parada — e perder um
    // trabalho porque ninguém foi ver a página é a pior forma de o perder.
    // Nunca lança: a proposta já está gravada.
    if ((corpo.accao === "propor" || confirmaAHora) && nova.valorAcordado == null) {
      const ultima = nova.propostas[nova.propostas.length - 1];
      if (ultima) {
        await avisarDaProposta({
          pedidoId: linha.pedidoId,
          negociacaoId: negociacaoId,
          quemPropos: "profissional",
          valor: ultima.valor,
          baseUrl: urlDeAccaoDoPedido(req.headers),
        });
      }
    }

    // O profissional aceitou o valor do cliente — o "sim" tem de chegar a quem
    // propôs. Um cliente de telefone não tem painel nenhum onde o ver: sem
    // este aviso, a aceitação ficava à espera de que alguém a escrevesse à
    // mão no WhatsApp. Nunca lança — a aceitação já está gravada.
    if (corpo.accao === "aceitar" && nova.estado === "aguarda_contratacao") {
      // No telemóvel do cliente (S10): falta ele contratar.
      await avisarOClienteDoPedido(linha.pedidoId, "aceitou", { nome: sessao.nome, negociacaoId });
      try {
        const { getSimulatorOrderById } = await import("@/lib/db");
        const pedido = await getSimulatorOrderById(linha.pedidoId);
        const aceite = [...nova.propostas].reverse().find((p) => p.estado === "aceite");
        if (pedido && !(pedido.contactEmail ?? "").trim() && pedido.contactPhone && aceite) {
          const { aceitacaoParaOWhatsApp } = await import("@/lib/whatsapp-negociacao");
          const { lerBase } = await import("@/lib/base-do-preco");
          await aceitacaoParaOWhatsApp({
            telefone: pedido.contactPhone,
            pedidoId: linha.pedidoId,
            negociacaoId,
            profissionalNome: sessao.nome,
            valor: aceite.valor,
            // O regime de IVA dele já não entra na conta do cliente (22-09-2026);
            // o modelo do preço lê-se da negociação, lá dentro (01-10-2026).
            base: lerBase(pedido.baseDoPreco),
          });
        }
      } catch (e) {
        console.error("[negociacao] aviso de aceitação falhou:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      estado: nova.estado,
      valorAcordado: nova.valorAcordado ?? null,
      propostas: nova.propostas,
      // Numa mudança em que o cliente o escolheu (d6): a frase de depois de confirmar ou de propor.
      ...(confirmaAHora ? { confirmou: true, depoisDoPrazo } : {}),
      ...(textoDoEscolhido ? { texto: textoDoEscolhido } : {}),
    });
  } catch (error) {
    console.error("[profissionais/negociacao]", error);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
