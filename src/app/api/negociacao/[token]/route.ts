import { NextRequest, NextResponse } from "next/server";
import {
  negociacaoPorTokenHash,
  gravarNegociacao,
  getSimulatorOrderByAcessoTokenHash,
  negociacoesDoPedido,
  encerrarOutrasNegociacoes,
  appendOrderHistory,
  confirmarExecucao,
} from "@/lib/db";
import { hashDeToken, verificarTokenDeAcesso } from "@/lib/pedido-acesso";
import {
  propor,
  aceitar,
  desistir,
  contratar,
  type Negociacao,
  type Proposta,
  type Lado,
} from "@/lib/negociacao";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";

export const runtime = "nodejs";

/**
 * Agir numa negociação.
 *
 * Uma rota para os dois lados, e é o **token** que diz quem está a falar — não
 * um campo no corpo do pedido. Se o lado viesse do cliente, qualquer pessoa
 * podia enviar `lado: "cliente"` e aceitar propostas em nome dele.
 *
 * O token do profissional é o da negociação; o do cliente é o do pedido. São
 * credenciais diferentes para portas diferentes, e nenhuma serve na outra.
 */

type Corpo = { accao?: string; valor?: unknown };

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Uma negociação a sério tem no máximo dez acções. Este travão não incomoda
  // ninguém e trava quem tente adivinhar tokens à força.
  const limite = await limitarRotaPublica(req, "negociacao", 30, 300);
  if (limite.erro) return limite.erro;

  const { token } = await params;
  const hash = hashDeToken(token);

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  // ── Quem está a falar ─────────────────────────────────────────────────────
  let lado: Lado;
  let negociacaoId: number;
  let pedidoId: number;
  let linha: { estado: string; valorAcordado: string | null; propostasJson: string | null };

  const doProfissional = await negociacaoPorTokenHash(hash);

  if (doProfissional) {
    const r = verificarTokenDeAcesso(
      token,
      doProfissional.acessoTokenHash,
      doProfissional.acessoTokenExpiraEm,
    );
    if (!r.valido) {
      return NextResponse.json({ ok: false, error: "Link inválido ou expirado." }, { status: 403 });
    }
    lado = "profissional";
    negociacaoId = doProfissional.id;
    pedidoId = doProfissional.pedidoId;
    linha = doProfissional;
  } else {
    // Não é de profissional — pode ser o link do cliente. Aí a acção precisa de
    // dizer sobre QUAL das negociações do pedido é, porque o cliente pode ter
    // várias a decorrer.
    const pedido = await getSimulatorOrderByAcessoTokenHash(hash);
    const r = verificarTokenDeAcesso(
      token,
      pedido?.acessoTokenHash ?? null,
      pedido?.acessoTokenExpiraEm ?? null,
    );
    if (!pedido || !r.valido) {
      return NextResponse.json({ ok: false, error: "Link inválido ou expirado." }, { status: 403 });
    }

    const alvo = Number((corpo as Record<string, unknown>).negociacaoId);
    const todas = await negociacoesDoPedido(pedido.id);
    const escolhida = todas.find((n) => n.id === alvo);
    if (!escolhida) {
      return NextResponse.json(
        { ok: false, error: "Negociação não encontrada." },
        { status: 404 },
      );
    }
    lado = "cliente";
    negociacaoId = escolhida.id;
    pedidoId = pedido.id;
    linha = escolhida;
  }

  // ── Confirmar que o trabalho está feito ───────────────────────────────────
  //
  // Não passa pelo motor de negociação: a negociação acabou quando ele foi
  // contratado. Isto é a fase seguinte, e a regra dela está em trabalho.ts.
  if (corpo.accao === "confirmar") {
    if (lado !== "cliente") {
      return NextResponse.json(
        { ok: false, error: "Só o cliente confirma o trabalho." },
        { status: 403 },
      );
    }
    try {
      const gravou = await confirmarExecucao(negociacaoId, pedidoId);
      if (!gravou) {
        return NextResponse.json(
          { ok: false, error: "Este trabalho não está à espera de confirmação." },
          { status: 409 },
        );
      }
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message: `Cliente confirmou o trabalho da negociação #${negociacaoId}. Valor libertado.`,
      });
      return NextResponse.json({ ok: true, confirmado: true });
    } catch (err) {
      console.error("[negociacao] falha ao confirmar:", err);
      return NextResponse.json(
        { ok: false, error: "Não foi possível confirmar. Tente novamente." },
        { status: 500 },
      );
    }
  }

  // ── Aplicar a acção ───────────────────────────────────────────────────────
  const agora = new Date();
  const estadoActual: Negociacao = {
    estado: linha.estado as Negociacao["estado"],
    valorAcordado: linha.valorAcordado != null ? Number(linha.valorAcordado) : null,
    propostas: propostasDe(linha.propostasJson),
  };

  let resultado;
  switch (corpo.accao) {
    case "propor": {
      const valor = typeof corpo.valor === "string" ? Number(corpo.valor.replace(",", ".")) : corpo.valor;
      resultado = propor(estadoActual, lado, Number(valor), agora);
      break;
    }
    case "aceitar":
      resultado = aceitar(estadoActual, lado, agora);
      break;
    case "contratar":
      // Fechar o negócio é do cliente e só dele — ver a regra do aperto de mão
      // duplo. O motor já o garante; recusar aqui evita sequer a tentativa.
      if (lado !== "cliente") {
        return NextResponse.json(
          { ok: false, error: "Só o cliente contrata." },
          { status: 403 },
        );
      }
      resultado = contratar(estadoActual, agora);
      break;
    case "desistir":
      resultado = desistir(estadoActual, lado, agora);
      break;
    default:
      return NextResponse.json({ ok: false, error: "Acção desconhecida." }, { status: 400 });
  }

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, error: resultado.erro }, { status: 409 });
  }

  const nova = resultado.negociacao;

  try {
    await gravarNegociacao(negociacaoId, {
      estado: nova.estado,
      valorAcordado: nova.valorAcordado ?? null,
      propostasJson: JSON.stringify(nova.propostas),
    });

    // Fechar uma fecha as outras. Sem isto, os restantes profissionais
    // continuavam a propor valores para um trabalho que já tinha dono — e o
    // ecrã do cliente promete-lhes o contrário.
    if (nova.estado === "acordada") {
      const encerradas = await encerrarOutrasNegociacoes(pedidoId, negociacaoId);
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message:
          `Negociação #${negociacaoId} fechada em ${nova.valorAcordado} € (contratado pelo cliente).` +
          (encerradas > 0 ? ` ${encerradas} outra(s) negociação(ões) encerrada(s).` : ""),
      });
    }
  } catch (err) {
    console.error("[negociacao] falha ao gravar:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível guardar. Tente novamente." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    estado: nova.estado,
    valorAcordado: nova.valorAcordado ?? null,
    propostas: nova.propostas,
  });
}
