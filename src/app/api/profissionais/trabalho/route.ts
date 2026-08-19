import { NextRequest, NextResponse } from "next/server";
import {
  registarExecucao,
  negociacoesDoProfissional,
  appendOrderHistory,
  getSimulatorOrderById,
  substituirTokenDoPedido,
} from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { podeEnviarProva, DIAS_ATE_LIBERTAR_SOZINHO } from "@/lib/trabalho";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { pedirConfirmacaoAoCliente } from "@/lib/email-trabalho";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";

export const runtime = "nodejs";

/**
 * "Está feito" — com fotografia.
 *
 * A fotografia é a peça que faz o resto funcionar. É o que o cliente vê antes
 * de confirmar, é o que decide uma reclamação, e é o que permite libertar o
 * dinheiro ao fim de sete dias sem ninguém dizer nada: sem prova, o silêncio do
 * cliente não podia valer como aceitação.
 *
 * As fotos já estão no armazenamento — chegam aqui como URLs, não como
 * ficheiros. É o mesmo caminho do pedido do cliente, e é o que impede um corpo
 * grande de bater no limite do Vercel.
 */

const MAX_FOTOS = 8;

export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { negociacaoId?: unknown; fotos?: unknown; nota?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  // Só URLs do nosso armazenamento. Sem isto, a "prova" podia apontar para
  // qualquer sítio da internet — e o cliente confirmava a partir de uma imagem
  // que nós não guardamos e que pode desaparecer amanhã.
  const fotos = Array.isArray(corpo.fotos)
    ? corpo.fotos
        .filter((f): f is string => typeof f === "string")
        .filter((u) => /^https:\/\/[a-z0-9.-]*\.(?:public\.)?blob\.vercel-storage\.com\//i.test(u))
        .slice(0, MAX_FOTOS)
    : [];

  if (fotos.length === 0) {
    return NextResponse.json(
      { error: "Envie pelo menos uma fotografia do trabalho feito." },
      { status: 400 },
    );
  }

  try {
    // O trabalho tem de ser dele e estar na fase certa. A condição repete-se no
    // UPDATE — esta é para dar uma mensagem, aquela é para garantir o facto.
    const linhas = await negociacoesDoProfissional(sessao.providerId);
    const trabalho = linhas.find((l) => l.id === negociacaoId);
    if (!trabalho) {
      return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    }
    if (!podeEnviarProva(trabalho as never)) {
      return NextResponse.json(
        { error: "Este trabalho não está à espera de prova." },
        { status: 409 },
      );
    }

    const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 500) : "";
    const gravou = await registarExecucao(
      negociacaoId,
      sessao.providerId,
      JSON.stringify({ fotos, nota, em: new Date().toISOString() }),
    );
    if (!gravou) {
      return NextResponse.json({ error: "A prova já tinha sido enviada." }, { status: 409 });
    }

    await appendOrderHistory(trabalho.pedidoId, {
      type: "created",
      by: null,
      message: `${sessao.nome} marcou o trabalho como feito (${fotos.length} fotografia(s)).`,
    });

    // O cliente tem de saber que o prazo começou a correr. Sem este email, os
    // sete dias passavam sem ele saber que existiam — e a libertação automática
    // deixava de ser um prazo para ser uma surpresa.
    //
    // O link vai novo porque o antigo não é recuperável: guardamos o hash, não
    // o token. O email diz que substitui o anterior.
    try {
      const doPedido = await getSimulatorOrderById(trabalho.pedidoId);
      if (doPedido?.contactEmail) {
        const novo = gerarTokenDeAcesso();
        await substituirTokenDoPedido(trabalho.pedidoId, novo.hash, novo.expiraEm);
        await pedirConfirmacaoAoCliente({
          paraEmail: doPedido.contactEmail,
          paraNome: doPedido.contactName ?? null,
          pedidoId: trabalho.pedidoId,
          profissionalNome: sessao.nome,
          token: novo.token,
          quantasFotos: fotos.length,
          diasParaConfirmar: DIAS_ATE_LIBERTAR_SOZINHO,
          baseUrl: urlDeAccaoDoPedido(req.headers),
        });
      }
    } catch (err) {
      console.error("[profissionais/trabalho] pedido de confirmação não saiu:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[profissionais/trabalho]", error);
    return NextResponse.json({ error: "Não foi possível registar" }, { status: 500 });
  }
}
