import { NextRequest, NextResponse } from "next/server";
import {
  negociacoesDoProfissional,
  gravarNegociacao,
  encerrarOutrasNegociacoes,
  appendOrderHistory,
} from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
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
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { accao?: unknown; valor?: unknown; negociacaoId?: unknown };
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

    let resultado;
    switch (corpo.accao) {
      case "propor": {
        const valor =
          typeof corpo.valor === "string" ? Number(corpo.valor.replace(",", ".")) : corpo.valor;
        resultado = propor(estadoActual, "profissional", Number(valor), agora);
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
    await gravarNegociacao(negociacaoId, {
      estado: nova.estado,
      valorAcordado: nova.valorAcordado ?? null,
      propostasJson: JSON.stringify(nova.propostas),
    });

    // Um profissional a aceitar não fecha nada — passa a bola ao cliente. Mas
    // se o motor chegar a "acordada" por outro caminho, as outras negociações
    // do mesmo pedido têm de terminar, como na rota do token.
    if (nova.estado === "acordada") {
      const encerradas = await encerrarOutrasNegociacoes(linha.pedidoId, negociacaoId);
      await appendOrderHistory(linha.pedidoId, {
        type: "created",
        by: null,
        message:
          `Negociação #${negociacaoId} fechada em ${nova.valorAcordado} €.` +
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
      try {
        const { getSimulatorOrderById, regimeDeIvaDoProfissional } = await import("@/lib/db");
        const pedido = await getSimulatorOrderById(linha.pedidoId);
        const aceite = [...nova.propostas].reverse().find((p) => p.estado === "aceite");
        if (pedido && !(pedido.contactEmail ?? "").trim() && pedido.contactPhone && aceite) {
          const { aceitacaoParaOWhatsApp } = await import("@/lib/whatsapp-negociacao");
          await aceitacaoParaOWhatsApp({
            telefone: pedido.contactPhone,
            pedidoId: linha.pedidoId,
            negociacaoId,
            profissionalNome: sessao.nome,
            valor: aceite.valor,
            // Quem factura e ele: e o regime dele que decide se o total que o
            // cliente le leva IVA por cima do valor acordado. Vem da base e
            // nao da sessao -- um token dura dias, um regime muda hoje.
            regimeIva: await regimeDeIvaDoProfissional(sessao.providerId),
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
    });
  } catch (error) {
    console.error("[profissionais/negociacao]", error);
    return NextResponse.json({ error: "Não foi possível guardar." }, { status: 500 });
  }
}
