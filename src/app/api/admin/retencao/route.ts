import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  interruptorDasRegrasNovas,
  noitesDaPurga,
  purgarPedidosTerminados,
  purgarRecolhasDoWhatsApp,
} from "@/lib/db";
import {
  DIAS_DE_RETENCAO_DOS_PEDIDOS,
  DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP,
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

  /*
   * AS NOITES, POR PÁGINAS — 26-10-2026 (d32, parte G). Uma linha por noite (o
   * resumo, sem pedido), vinte de cada vez; `?pagina=2` traz as anteriores.
   * Eram as últimas vinte linhas `pedido_expurgado`, com as de cada pedido
   * misturadas: uma noite de 31 apagados empurrava os resumos para fora.
   */
  const pagina = Math.max(1, Math.min(1000, Number(req.nextUrl.searchParams.get("pagina")) || 1));

  try {
    const [conta, recolhas, noites, interruptor] = await Promise.all([
      // `aSerio: false` — conta e devolve antes de apagar. Ver a função.
      purgarPedidosTerminados(DIAS_DE_RETENCAO_DOS_PEDIDOS, {
        aSerio: false,
        diasDosAbandonados: DIAS_PARA_OS_ABANDONADOS,
      }),
      // O bloco de notas do assistente, pela mesma regra e também sem tocar.
      purgarRecolhasDoWhatsApp(DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP, { aSerio: false }).catch(() => ({
        abandonadas: 0,
        orfas: 0,
        aSerio: false,
      })),
      noitesDaPurga(pagina, 20).catch(() => ({ noites: [], total: 0 })),
      // Desligado na dúvida — ver `interruptorDasRegrasNovas`.
      interruptorDasRegrasNovas(),
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
      /**
       * E quantos eventos sairiam da agenda do Google. Cada um leva o nome, o
       * telefone e a morada do cliente — até 14-09-2026 ficavam lá para sempre.
       */
      eventos: conta.eventosApagados,
      /**
       * O bloco de notas do assistente: as conversas paradas a meio e as que
       * apontam para um pedido que já não existe. Ambas guardam nome e morada.
       */
      recolhasAbandonadas: recolhas.abandonadas,
      recolhasOrfas: recolhas.orfas,
      diasDasRecolhas: DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP,
      restantes: conta.restantes,
      /** Os números dos pedidos na mira, para se poder ir ver um antes. */
      naMira: conta.naMira ?? [],
      /**
       * As regras novas da d32: em ensaio enquanto o interruptor estiver
       * desligado. As contagens delas vêm de `/api/admin/retencao/ensaio`, à
       * parte: lêem o Blob inteiro, e este ecrã refresca-se sozinho.
       */
      regrasNovas: interruptor,
      noites: noites.noites.map((l) => ({
        id: l.id,
        ocorridoEm: l.ocorridoEm,
        resumo: l.resumo,
        autorNome: l.autorNome,
        regrasNovas: lerRegrasNovasDoDetalhe(l.detalheJson),
      })),
      noitesTotal: noites.total,
      pagina,
    });
  } catch (error) {
    console.error("[admin/retencao]", error);
    return NextResponse.json({ error: "Não foi possível contar." }, { status: 500 });
  }
}

/** As contagens das regras novas guardadas no detalhe da noite, ou nada. */
function lerRegrasNovasDoDetalhe(detalheJson: string | null): unknown {
  if (!detalheJson) return null;
  try {
    const d = JSON.parse(detalheJson) as { regrasNovas?: unknown; regrasNovasLigadas?: unknown };
    return d.regrasNovas ? { ...(d.regrasNovas as object), ligadas: d.regrasNovasLigadas === true } : null;
  } catch {
    return null;
  }
}
