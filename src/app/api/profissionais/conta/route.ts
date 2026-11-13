import { NextRequest, NextResponse } from "next/server";
import {
  apagarProfissional,
  definirEstadoDoProfissional,
  ContaComPendencias,
  perfilDoProfissional,
} from "@/lib/db";
import { COOKIE_SESSAO_PROFISSIONAL, tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { dividasDoProfissional } from "@/lib/cobrancas-na-base";
import { agoraDoModelo } from "@/lib/relogio-do-modelo";
import {
  NAO_SE_CONFIRMOU_O_QUE_FALTA_PAGAR,
  fraseDaContaComValorPorPagar,
  valorPorPagarAntesDeApagar,
} from "@/lib/conta-com-valor-por-pagar";

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
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
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

  /*
   * COM VALORES POR PAGAR À CLYON, NÃO SE ELIMINA — d15, 13-11-2026. A taxa da
   * plataforma e o IVA por pagar (`porPagar` das dívidas, a mesma conta da
   * carteira) travam ANTES de suspender: nada muda na conta, e ele sabe porquê.
   * Na dúvida (a leitura falhou), também não se elimina.
   */
  try {
    const porPagar = valorPorPagarAntesDeApagar(await dividasDoProfissional(sessao.providerId, agoraDoModelo()));
    if (porPagar > 0) {
      return NextResponse.json(
        { error: fraseDaContaComValorPorPagar(porPagar), valorPorPagar: porPagar, comValoresPorPagar: true },
        { status: 409 },
      );
    }
  } catch (error) {
    console.error("[api/profissionais/conta DELETE] o que falta pagar não se leu:", error);
    return NextResponse.json({ error: NAO_SE_CONFIRMOU_O_QUE_FALTA_PAGAR }, { status: 503 });
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
