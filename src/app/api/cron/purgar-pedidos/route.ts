import { NextRequest, NextResponse } from "next/server";
import { purgarPedidosTerminados, registarSemFalhar } from "@/lib/db";
import { DIAS_DE_RETENCAO_DOS_PEDIDOS } from "@/lib/retencao";

export const runtime = "nodejs";

/**
 * A purga dos pedidos terminados — todos os dias, aos 60 dias.
 *
 * O CÓDIGO FALAVA DELA COMO SE EXISTISSE
 *
 * Havia o acontecimento `pedido_expurgado`, a opção "só a purga automática o
 * usa", e comentários a contar com ela — e não havia cron nenhum. Nada apagava
 * um pedido sozinho, e apagar à mão deixava as fotografias no Blob para sempre.
 * Verificado a 10-09-2026.
 *
 * O que fica: o registo permanente, com o retrato de cada pedido apagado — é o
 * histórico para um processo judicial. O que sai: a linha do pedido, as
 * negociações, e as imagens. Ver `purgarPedidosTerminados` em db.ts para o
 * que conta como terminado e o que nunca se purga.
 */
export async function GET(req: NextRequest) {
  // Falha fechada: sem CRON_SECRET definido, a rota recusa. Aberta, seria um
  // endereço público que apaga pedidos.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/purgar-pedidos] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const r = await purgarPedidosTerminados(DIAS_DE_RETENCAO_DOS_PEDIDOS);

    // Só se regista quando houve alguma coisa: uma linha por dia a dizer
    // "zero" enterrava as que interessam. As linhas por pedido já lá estão,
    // escritas por `deleteSimulatorOrder`; esta é o resumo da passagem.
    if (r.expurgados > 0 || r.falhados.length > 0) {
      await registarSemFalhar({
        acontecimento: "pedido_expurgado",
        autorTipo: "sistema",
        autorNome: "retenção",
        resumo:
          `Purga dos ${DIAS_DE_RETENCAO_DOS_PEDIDOS} dias: ${r.expurgados} pedido(s) expurgado(s), ` +
          `${r.fotosApagadas} fotografia(s) apagada(s)` +
          (r.falhados.length > 0 ? `, ${r.falhados.length} falhado(s)` : "") +
          (r.restantes > 0 ? `, ${r.restantes} ainda por fazer` : ""),
        detalhe: { falhados: r.falhados, restantes: r.restantes },
      });
    }

    // Nunca em silêncio: um tecto que não se anuncia lê-se como "estava tudo feito".
    if (r.restantes > 0) {
      console.warn(`[cron/purgar-pedidos] ${r.restantes} pedido(s) elegível(eis) ficaram para a próxima passagem`);
    }
    for (const f of r.falhados) {
      console.error(`[cron/purgar-pedidos] pedido #${f.pedidoId} não foi expurgado: ${f.erro}`);
    }

    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[cron/purgar-pedidos]", error);
    return NextResponse.json({ error: "Erro ao purgar" }, { status: 500 });
  }
}
