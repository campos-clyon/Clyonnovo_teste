import { NextRequest, NextResponse } from "next/server";
import {
  apagarProfissional,
  definirEstadoDoProfissional,
  ContaComPendencias,
  perfilDoProfissional,
} from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";

export const runtime = "nodejs";

/**
 * O profissional apaga a própria conta.
 *
 * PORQUE É QUE SUSPENDE ANTES
 *
 * `apagarProfissional` exige a conta suspensa, e a exigência não é burocracia:
 * suspender é o que o tira da distribuição, e é a ÚNICA coisa que impede um
 * pedido novo de lhe chegar a meio do apagar — uma negociação criada para uma
 * conta que está a desaparecer, sem ninguém do outro lado a responder.
 *
 * No painel do backoffice esse passo é dado à mão. Aqui é dado por nós, e em
 * transacção própria: tem de estar GRAVADO antes de o apagar começar, senão a
 * distribuição continua a ver a conta aberta durante a janela toda.
 *
 * Se o apagar for recusado a seguir — dinheiro por levantar, trabalho por
 * confirmar — a suspensão fica. E fica bem: quem pediu para sair não deve
 * continuar a receber pedidos enquanto resolve o que falta. O ecrã diz-lho.
 *
 * OS GUARDAS SÃO OS MESMOS DO BACKOFFICE
 *
 * Não há uma versão mais branda para quem se apaga a si próprio. Se lhe
 * devemos dinheiro, apagar a conta apagava o nome e o IBAN com que lho
 * pagaríamos — e a dívida não desaparece com a linha.
 */
export async function DELETE(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // A palavra escrita à mão. Sem ela, qualquer página aberta com a sessão dele
  // podia apagar-lhe a conta com um `fetch`.
  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    /* corpo vazio — cai na verificação seguinte */
  }
  if (corpo.confirmacao !== "ELIMINAR") {
    return NextResponse.json(
      { error: "Falta a confirmação. Escreva ELIMINAR para continuar." },
      { status: 400 },
    );
  }

  try {
    const perfil = await perfilDoProfissional(sessao.providerId);
    const nome = perfil?.nome ?? "profissional";

    // Gravado antes de o apagar começar — ver acima.
    await definirEstadoDoProfissional(sessao.providerId, "suspenso");

    const r = await apagarProfissional(sessao.providerId, `${nome} (o próprio)`);

    // A sessão morre com a conta. Sem isto, o cookie continuava válido para uma
    // conta que já não existe, e o painel dele respondia com ecrãs vazios em
    // vez de o mandar embora.
    const resposta = NextResponse.json({ ok: true, modo: r.modo });
    resposta.cookies.set(COOKIE_SESSAO_PROFISSIONAL, "", { maxAge: 0, path: "/" });
    return resposta;
  } catch (error) {
    if (error instanceof ContaComPendencias) {
      return NextResponse.json(
        {
          error: error.message,
          motivos: error.motivos,
          // A conta ficou suspensa mesmo assim, e ele tem de saber: deixou de
          // receber pedidos, e não foi por engano.
          suspensa: true,
        },
        { status: 409 },
      );
    }
    console.error("[api/profissionais/conta DELETE]", error);
    return NextResponse.json({ error: "Erro ao apagar a conta" }, { status: 500 });
  }
}
