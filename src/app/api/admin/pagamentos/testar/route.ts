import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import {
  IDENTIFICADOR_DE_TESTE,
  MINIMO_MULTIBANCO,
  configuracaoDoEupago,
} from "@/lib/eupago";
import { pedirPagamento } from "@/lib/pedir-ao-eupago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A CHAVE SERVE? — uma pergunta que se responde num clique.
 *
 * Sem isto, a única forma de saber se a `EUPAGO_API_KEY` está certa era montar
 * um trabalho inteiro: um pedido, um profissional, uma negociação fechada, e um
 * cliente a carregar em «pagar». É demasiado caminho para uma pergunta de sim
 * ou não — e é caminho que se percorre com a suspeita de que a culpa pode estar
 * em qualquer um dos passos.
 *
 * ⚠️ O ERRO MAIS PROVÁVEL DE TODOS, e é o que isto existe para apanhar:
 * `EUPAGO_AMBIENTE=sandbox` com a chave de PRODUÇÃO. As duas casas do euPago
 * têm contas separadas, e a chave de uma não serve na outra. A resposta é um
 * `-10` limpo — mas só se alguém chegar a perguntar.
 *
 * O QUE ISTO FAZ, exactamente: pede uma referência Multibanco de 1 € que
 * ninguém vai pagar e que expira sozinha. Não cobra a ninguém, não cria linha
 * nenhuma em `pagamentos`, e leva um identificador que NÃO é parseável como um
 * pagamento nosso — se alguém a pagasse por engano, o aviso chegava e era
 * arrumado como «identificador alheio» em vez de creditar um trabalho.
 *
 * Multibanco e não MB WAY porque o MB WAY precisava de um telemóvel real e
 * mandava uma notificação a alguém.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  const conf = configuracaoDoEupago(process.env);
  if (!conf.ok) {
    return NextResponse.json({ ok: false, porque: conf.falta }, { status: 200 });
  }

  try {
    const r = await pedirPagamento(conf.config, "multibanco", {
      pagamentoId: 0,
      valor: MINIMO_MULTIBANCO,
      // Uma prova de ligação não precisa de viver três dias.
      prazo: new Date(Date.now() + 86_400_000),
      identificador: `${IDENTIFICADOR_DE_TESTE}-${Date.now()}`,
    });

    if (!r.ok) {
      return NextResponse.json({
        ok: false,
        ambiente: conf.config.ambiente,
        codigo: r.recusa.codigo,
        porque: r.recusa.paraNos,
        /*
         * A PISTA, e é a que poupa a tarde.
         *
         * `-10` com estas duas variáveis é quase sempre a mesma coisa: a chave
         * é de uma casa e o ambiente aponta para a outra.
         */
        pista:
          r.recusa.codigo === "-10"
            ? `A chave não serve para ${conf.config.base}. As duas casas do euPago têm contas ` +
              `separadas — confirme se esta chave é mesmo a de ${conf.config.ambiente}.`
            : null,
      });
    }

    return NextResponse.json({
      ok: true,
      ambiente: conf.config.ambiente,
      base: conf.config.base,
      entidade: r.entidade,
      referencia: r.referencia,
      temSegredoDoWebhook: Boolean(conf.config.segredoDoWebhook),
    });
  } catch (error) {
    console.error("[admin/pagamentos/testar]", error);
    return NextResponse.json({ ok: false, porque: "Falhou a chamada ao euPago." });
  }
}
