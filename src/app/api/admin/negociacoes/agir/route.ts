import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  negociacoesDoPedido,
  gravarNegociacao,
  encerrarOutrasNegociacoes,
  appendOrderHistory,
  confirmarExecucao,
  getSimulatorOrderById,
  registarSemFalhar,
} from "@/lib/db";
import { clyonPodeConfirmar, porqueNaoPodeConfirmar } from "@/lib/quem-negoceia";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import {
  propor,
  aceitar,
  desistir,
  contratar,
  type Negociacao,
  type Proposta,
} from "@/lib/negociacao";

export const runtime = "nodejs";

/**
 * A CLYON responde às propostas, pelo lado do cliente.
 *
 * PORQUE EXISTE
 *
 * Muitos pedidos chegam por WhatsApp e por telefone. A pessoa não vai ao site,
 * não cria conta, e não abre link nenhum — descreve o que precisa e desliga.
 * Até aqui, esses pedidos não podiam viver na plataforma: o motor da
 * negociação está pronto para os dois lados, mas as portas de entrada estavam
 * todas fechadas a uma identidade que estes pedidos não têm. O cliente
 * respondia com sessão (que não tem) ou com um token do email (que não
 * recebeu). Ficavam de fora os profissionais, que é onde está o valor.
 *
 * O motor não precisou de mudar. Recebe `lado` como argumento desde o
 * princípio, e nunca soube o que é uma sessão. O que faltava era isto: uma
 * porta com autenticação de administrador que lhe passe `lado: "cliente"`.
 *
 * FICA ESCRITO QUEM AGIU
 *
 * Uma proposta feita pela CLYON e uma feita pelo cliente não são a mesma
 * coisa, e o profissional do outro lado tem o direito de saber com quem está a
 * falar. O nome do colaborador entra no histórico do pedido em todas as
 * acções — `requireAdmin` já o devolve, e até aqui ninguém o usava. Sem isso,
 * o registo dizia "o cliente propôs 300 €" sobre uma decisão que o cliente
 * nunca tomou, e no dia de um desacordo era essa a única versão escrita.
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

const ACCOES = ["propor", "aceitar", "contratar", "desistir", "confirmar"] as const;
type AccaoDeAdmin = (typeof ACCOES)[number];

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pedidoId?: unknown; negociacaoId?: unknown; accao?: unknown; valor?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Negociação inválida." }, { status: 400 });
  }
  if (!ACCOES.includes(corpo.accao as AccaoDeAdmin)) {
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  }
  const accao = corpo.accao as AccaoDeAdmin;

  try {
    /*
     * A negociação tem de pertencer a ESTE pedido.
     *
     * Procura-se dentro das negociações do pedido em vez de ir buscar a
     * negociação pelo id diretamente. Um id solto vindo do corpo abriria a
     * porta a agir sobre a negociação de outro pedido por engano — e o engano
     * aqui fecha um trabalho com o profissional errado.
     */
    const todas = await negociacoesDoPedido(pedidoId);
    const linha = todas.find((n) => Number(n.id) === negociacaoId);
    if (!linha) {
      return NextResponse.json({ error: "Negociação não encontrada." }, { status: 404 });
    }

    /*
     * CONFIRMAR — e o único portao a serio desta rota.
     *
     * As outras accoes negoceiam: propoem, aceitam, desistem. Nenhuma mexe em
     * dinheiro. Esta liberta o pagamento do profissional, e por isso nao pode
     * estar ao alcance da CLYON em qualquer pedido.
     *
     * O QUE ACONTECIA SEM ISTO
     *
     * Um pedido registado pela equipa — chegado por WhatsApp, com a cliente
     * sem email — nao tinha ninguem que pudesse confirmar. O profissional
     * fazia o trabalho, mandava a prova, e ficava ali: `confirmadoEm` nunca
     * era preenchido. A carteira dele mostrava o dinheiro libertado pelo
     * prazo, mas a data nunca era gravada — e e essa data que fecha o
     * trabalho, que deixa apagar o pedido, e que deixa apagar a conta dele ou
     * a dela. Um beco sem saida, e a apanhar TODOS os pedidos que a equipa
     * regista ao telefone.
     *
     * PORQUE E QUE NAO SERVE PARA TODOS
     *
     * Se o cliente TEM como confirmar — tem email, recebeu o link — entao e
     * ele que confirma e mais ninguem. A promessa da plataforma e que o
     * dinheiro so se solta quando quem pagou disser que esta feito. Deixar a
     * CLYON faze-lo por um cliente que podia falar por si e desfazer a
     * promessa por conveniencia de quem esta do lado de dentro.
     *
     * A regra e a mesma que o painel usa para separar os dois grupos — vem de
     * `@/lib/quem-negoceia`, e nao de uma copia.
     */
    if (accao === "confirmar") {
      const pedido = await getSimulatorOrderById(pedidoId);
      if (!pedido) {
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
      }

      let origem: string | null = null;
      try {
        origem = pedido.rawOrderJson
          ? ((JSON.parse(pedido.rawOrderJson) as Record<string, unknown>).origemPedido as string) ?? null
          : null;
      } catch {
        /* JSON estragado — conta como sem origem, e o email decide */
      }

      const alvo = { origem, contactEmail: pedido.contactEmail };
      if (!clyonPodeConfirmar(alvo)) {
        return NextResponse.json({ error: porqueNaoPodeConfirmar(alvo) }, { status: 403 });
      }

      // Os restantes guardas vivem no SQL: só grava se estiver `acordada`, com
      // prova enviada e ainda por confirmar. Se não gravou, uma delas falhou.
      const gravou = await confirmarExecucao(negociacaoId, pedidoId);
      if (!gravou) {
        return NextResponse.json(
          {
            error:
              "Não há nada para confirmar: ou o trabalho ainda não foi entregue, ou já foi confirmado.",
          },
          { status: 409 },
        );
      }

      const porQuem = colab?.nome ?? "a CLYON";
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message:
          `CLYON (${porQuem}) confirmou a execução em nome do cliente — ` +
          `negociação #${negociacaoId}. Pagamento libertado.`,
      });

      // No registo permanente fica escrito QUEM confirmou. Um trabalho fechado
      // pela CLYON e um fechado pelo cliente não são a mesma coisa, e no dia de
      // um desacordo esta é a única versão escrita.
      await registarSemFalhar({
        acontecimento: "execucao_confirmada",
        pedidoId,
        negociacaoId,
        autorTipo: "clyon",
        autorNome: porQuem,
        valor: linha.valorAcordado != null ? Number(linha.valorAcordado) : null,
        resumo: `Execução confirmada pela CLYON em nome do cliente (${porQuem})`,
      });

      return NextResponse.json({ ok: true, confirmado: true });
    }

    const agora = new Date();
    const estadoActual: Negociacao = {
      estado: linha.estado as Negociacao["estado"],
      valorAcordado: linha.valorAcordado != null ? Number(linha.valorAcordado) : null,
      propostas: propostasDe(linha.propostasJson),
    };

    let resultado;
    let valorProposto: number | null = null;
    switch (accao) {
      case "propor": {
        const bruto =
          typeof corpo.valor === "string" ? Number(corpo.valor.replace(",", ".")) : corpo.valor;
        valorProposto = Number(bruto);
        resultado = propor(estadoActual, "cliente", valorProposto, agora);
        break;
      }
      case "aceitar":
        resultado = aceitar(estadoActual, "cliente", agora);
        break;
      case "contratar":
        resultado = contratar(estadoActual, agora);
        break;
      case "desistir":
        resultado = desistir(estadoActual, "cliente", agora);
        break;
    }

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.erro }, { status: 409 });
    }

    const nova = resultado.negociacao;
    await gravarNegociacao(negociacaoId, {
      estado: nova.estado,
      valorAcordado: nova.valorAcordado ?? null,
      propostasJson: JSON.stringify(nova.propostas),
    });

    const quem = colab?.nome ?? "a CLYON";
    const rotulo: Record<AccaoDeAdmin, string> = {
      propor: `propôs ${valorProposto} € ao profissional`,
      aceitar: "aceitou a proposta do profissional",
      contratar: "contratou o profissional",
      desistir: "desistiu da negociação",
      // `confirmar` sai mais acima, com histórico próprio.
      confirmar: "confirmou a execução",
    };

    // Fechar uma fecha as outras: os restantes profissionais deixam de propor
    // valores para um trabalho que já tem dono.
    let encerradas = 0;
    if (nova.estado === "acordada") {
      encerradas = await encerrarOutrasNegociacoes(pedidoId, negociacaoId);
    }

    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message:
        `CLYON (${quem}) ${rotulo[accao]} — negociação #${negociacaoId}, ` +
        `em nome do cliente.` +
        (encerradas > 0 ? ` ${encerradas} outra(s) encerrada(s).` : ""),
    });

    // Avisar o profissional. Uma proposta que ninguém vê expira em 48 horas, e
    // perder um trabalho porque ninguém foi ver a página é a pior forma de o
    // perder. Nunca lança: a proposta já está gravada.
    if (accao === "propor" && nova.valorAcordado == null) {
      await avisarDaProposta({
        pedidoId,
        negociacaoId,
        quemPropos: "cliente",
        valor: valorProposto ?? 0,
        baseUrl: urlDeAccaoDoPedido(req.headers),
      });
    }

    return NextResponse.json({
      ok: true,
      estado: nova.estado,
      valorAcordado: nova.valorAcordado ?? null,
      propostas: nova.propostas,
      encerradas,
    });
  } catch (error) {
    console.error("[admin/negociacoes/agir]", error);
    return NextResponse.json({ error: "Não foi possível registar a acção." }, { status: 500 });
  }
}
