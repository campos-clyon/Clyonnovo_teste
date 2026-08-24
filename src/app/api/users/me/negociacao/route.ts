import { NextRequest, NextResponse, after } from "next/server";
import { avisarProfissionalTrabalhoConfirmado } from "@/lib/avisar-confirmacao";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  negociacoesDoPedido,
  getSimulatorOrderById,
  gravarNegociacao,
  encerrarOutrasNegociacoes,
  appendOrderHistory,
  confirmarExecucao,
  avaliarProfissional,
} from "@/lib/db";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";
import { validarAvaliacao } from "@/lib/avaliacao-profissional";
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
 * O cliente negoceia a partir da conta, com sessão em vez de link.
 *
 * O link do email continua a servir — é o caminho de quem não tem conta. Mas
 * quem tem conta não devia ter de ir procurar um email para responder a uma
 * proposta: os pedidos dele estão à frente, e é aí que a resposta faz sentido.
 *
 * O pedido é dele porque o email do pedido é o email da sessão — a mesma regra
 * que a lista de pedidos usa, e a única que existe deste lado. Um id de
 * negociação de outra pessoa não passa: procura-se dentro das negociações do
 * pedido, e o pedido tem de ser dele primeiro.
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
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { accao?: unknown; valor?: unknown; negociacaoId?: unknown; pedidoId?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const pedidoId = Number(corpo.pedidoId);
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(pedidoId) || !Number.isInteger(negociacaoId)) {
    return NextResponse.json({ error: "Pedido ou negociação em falta." }, { status: 400 });
  }

  try {
    const pedido = await getSimulatorOrderById(pedidoId);
    const doCliente =
      pedido && (pedido.contactEmail ?? "").trim().toLowerCase() === email;
    // A mesma resposta para "não existe" e "não é seu". Distinguir dizia a quem
    // tenta que aquele número de pedido existe.
    if (!pedido || !doCliente) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const todas = await negociacoesDoPedido(pedidoId);
    const linha = todas.find((n) => n.id === negociacaoId);
    if (!linha) {
      return NextResponse.json({ error: "Negociação não encontrada." }, { status: 404 });
    }

    // ── Confirmar o trabalho feito ───────────────────────────────────────
    if (corpo.accao === "confirmar") {
      const gravou = await confirmarExecucao(negociacaoId, pedidoId);
      if (!gravou) {
        return NextResponse.json(
          { error: "Este trabalho não está à espera de confirmação." },
          { status: 409 },
        );
      }
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message: `Cliente confirmou o trabalho da negociação #${negociacaoId}. Valor libertado.`,
      });
      after(() => avisarProfissionalTrabalhoConfirmado({ pedidoId, negociacaoId }));
      return NextResponse.json({ ok: true, confirmado: true });
    }

    // ── Avaliar o profissional ───────────────────────────────────────────
    //
    // Só depois de confirmar. Uma avaliação de quem não chegou a ser servido
    // não diz nada sobre o trabalho, e é a porta por onde entram as avaliações
    // compradas e as vinganças.
    if (corpo.accao === "avaliar") {
      const validacao = validarAvaliacao(corpo);
      if (!validacao.ok) {
        return NextResponse.json({ error: validacao.erros[0].mensagem }, { status: 400 });
      }
      const gravou = await avaliarProfissional(
        negociacaoId,
        pedidoId,
        validacao.dados.estrelas,
        validacao.dados.comentario,
      );
      if (!gravou) {
        return NextResponse.json(
          { error: "Só pode avaliar depois de confirmar o trabalho, e uma vez." },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true, avaliado: true });
    }

    const agora = new Date();
    const estadoActual: Negociacao = {
      estado: linha.estado as Negociacao["estado"],
      valorAcordado: linha.valorAcordado != null ? Number(linha.valorAcordado) : null,
      propostas: propostasDe(linha.propostasJson),
    };

    let resultado;
    switch (corpo.accao) {
      case "propor": {
        const valor =
          typeof corpo.valor === "string" ? Number(corpo.valor.replace(",", ".")) : corpo.valor;
        resultado = propor(estadoActual, "cliente", Number(valor), agora);
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
      default:
        return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
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

    // Fechar uma fecha as outras: os restantes profissionais deixam de propor
    // valores para um trabalho que já tem dono.
    if (nova.estado === "acordada") {
      const encerradas = await encerrarOutrasNegociacoes(pedidoId, negociacaoId);
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message:
          `Negociação #${negociacaoId} fechada em ${nova.valorAcordado} € (contratado na conta).` +
          (encerradas > 0 ? ` ${encerradas} outra(s) encerrada(s).` : ""),
      });
    }


    // Avisar o outro lado. Uma proposta que ninguém vê expira em 48 horas, e
    // perder um trabalho porque ninguém foi ver a página é a pior forma de o
    // perder. Nunca lança: a proposta já está gravada.
    if (corpo.accao === "propor" && nova.valorAcordado == null) {
      const ultima = nova.propostas[nova.propostas.length - 1];
      if (ultima) {
        await avisarDaProposta({
          pedidoId: pedidoId,
          negociacaoId: negociacaoId,
          quemPropos: "cliente",
          valor: ultima.valor,
          baseUrl: urlDeAccaoDoPedido(req.headers),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      estado: nova.estado,
      valorAcordado: nova.valorAcordado ?? null,
      propostas: nova.propostas,
    });
  } catch (error) {
    console.error("[users/me/negociacao]", error);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
