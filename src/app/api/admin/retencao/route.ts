import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { purgarPedidosTerminados, registoParaOBackoffice } from "@/lib/db";
import {
  DIAS_DE_RETENCAO_DOS_PEDIDOS,
  DIAS_PARA_OS_ABANDONADOS,
  purgaArmada,
} from "@/lib/retencao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O QUE A PURGA APAGARIA, E O QUE JÁ APAGOU.
 *
 * O registo permanente era ESCRITO E NUNCA LIDO. Havia três funções para o
 * consultar — `registoParaOBackoffice`, `registoDoCliente`,
 * `registoDoProfissional` — e nenhuma era chamada em lado nenhum. Um histórico
 * que ninguém consegue abrir é meio histórico: guarda-se «para um processo
 * judicial» e no dia do processo não há por onde lhe pegar.
 *
 * E era esse registo que guardava o número da purga. Todas as noites ela
 * escrevia lá «MODO SECO — apagaria N pedidos», e esse N — que é justamente o
 * que é preciso ver ANTES de armar — não aparecia em ecrã nenhum.
 *
 * ESTA ROTA NÃO APAGA NADA, E NÃO PODE. Chama a purga em modo seco, que conta
 * e sai antes de tocar em coisa alguma. É de propósito que não há aqui um botão
 * de armar: arma-se numa variável de ambiente, com um redeploy pelo meio, e
 * essa lentidão é a última coisa que separa uma tarde má de uma base vazia.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const [conta, ultimas] = await Promise.all([
      // `aSerio: false` — conta e devolve antes de apagar. Ver a função.
      purgarPedidosTerminados(DIAS_DE_RETENCAO_DOS_PEDIDOS, {
        aSerio: false,
        diasDosAbandonados: DIAS_PARA_OS_ABANDONADOS,
      }),
      registoParaOBackoffice({ acontecimento: "pedido_expurgado", limite: 20 }).catch(() => []),
    ]);

    return NextResponse.json({
      armada: purgaArmada(),
      diasDosTerminados: DIAS_DE_RETENCAO_DOS_PEDIDOS,
      diasDosAbandonados: DIAS_PARA_OS_ABANDONADOS,
      /** Quantos cumprem a regra hoje — o total, não só os desta passagem. */
      elegiveis: conta.elegiveis,
      /** Quantos a próxima passagem levaria, e quantas fotografias com eles. */
      naProximaPassagem: conta.expurgados,
      fotografias: conta.fotosApagadas,
      restantes: conta.restantes,
      /** Os números dos pedidos na mira, para se poder ir ver um antes. */
      naMira: conta.naMira ?? [],
      ultimas,
    });
  } catch (error) {
    console.error("[admin/retencao]", error);
    return NextResponse.json({ error: "Não foi possível contar." }, { status: 500 });
  }
}
