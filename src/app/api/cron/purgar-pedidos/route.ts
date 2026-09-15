import { NextRequest, NextResponse } from "next/server";
import {
  purgarPedidosTerminados,
  purgarRecolhasDoWhatsApp,
  registarSemFalhar,
} from "@/lib/db";
import {
  DIAS_DE_RETENCAO_DOS_PEDIDOS,
  DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP,
  DIAS_PARA_OS_ABANDONADOS,
  purgaArmada,
} from "@/lib/retencao";

export const runtime = "nodejs";

/**
 * TEMPO PARA A PASSAGEM INTEIRA, E PARA ESCREVER O QUE FEZ.
 *
 * Cada pedido é uma transacção mais um punhado de chamadas ao Blob para lhe
 * apagar as fotografias. Com o tempo por omissão, uma passagem cheia podia ser
 * cortada a meio — e o pior disso não é o que fica por apagar (a passagem
 * seguinte apanha-o): é a linha de resumo, que é escrita no FIM e é a única
 * prova de que a purga correu. Uma purga que apaga e não conta o que apagou é
 * a pior das duas.
 */
export const maxDuration = 300;

/**
 * A purga dos pedidos velhos — todos os dias.
 *
 * DOIS PRAZOS E UMA GARANTIA (14-09-2026):
 *
 *   · os que acabaram — concluído, cancelado, arquivado — aos 60 dias;
 *   · os ABANDONADOS a meio, que nunca tiveram fim, aos 90;
 *   · e NUNCA um pedido que tenha produzido trabalho, seja qual for a idade.
 *
 * A garantia é a que faltava. A carteira do profissional é calculada a partir
 * das linhas de `negociacoes`: apagar um trabalho concluído tirava-lhe o total
 * ganho e o movimento que explica o saldo. "Quero que garanta que os valores
 * gerados pelos trabalhos concluídos não sejam apagados das contas dos pros
 * nem da nossa base."
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
    const armada = purgaArmada();
    const r = await purgarPedidosTerminados(DIAS_DE_RETENCAO_DOS_PEDIDOS, {
      aSerio: armada,
      // Os abandonados esperam mais: nunca tiveram fim a partir do qual contar.
      diasDosAbandonados: DIAS_PARA_OS_ABANDONADOS,
    });

    /*
     * E O BLOCO DE NOTAS DO ASSISTENTE, na mesma passagem e a seguir.
     *
     * A seguir de propósito: a purga acabou de apagar pedidos, e cada um deles
     * pode ter deixado uma linha em `whatsappRecolhas` a apontar para um
     * pedido que já não existe — com o nome e a morada do cliente lá dentro.
     * Corrê-la antes deixava essas para a noite seguinte.
     *
     * Uma falha aqui não pode estragar o relatório da purga, que é a parte que
     * interessa: fica contada como zero e escrita nos registos.
     */
    const recolhas = await purgarRecolhasDoWhatsApp(DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP, {
      aSerio: armada,
    }).catch((e) => {
      console.error("[cron/purgar-pedidos] recolhas do WhatsApp:", e);
      return { abandonadas: 0, orfas: 0, aSerio: armada };
    });

    /*
     * Em modo seco regista-se SEMPRE que houvesse alguma coisa a apagar, e não
     * só quando se apagou: o número é justamente o que se quer ver antes de
     * armar. A seco, um "zero" também vale a pena — diz que não há nada
     * acumulado, que é uma resposta.
     */
    /*
     * As recolhas ditas por palavras, e só quando há alguma. Uma linha a dizer
     * "0 recolhas" todas as noites durante meses é ruído que ensina a não ler
     * o resumo — e é justamente este resumo que decide se a purga se arma.
     */
    const recolhasEmPalavras =
      recolhas.abandonadas > 0 || recolhas.orfas > 0
        ? (r.aSerio ? ". Do assistente saíram " : ". E do assistente sairiam ") +
          [
            recolhas.abandonadas > 0 ? `${recolhas.abandonadas} recolha(s) abandonada(s)` : null,
            recolhas.orfas > 0 ? `${recolhas.orfas} sem pedido nenhum por trás` : null,
          ]
            .filter(Boolean)
            .join(" e ")
        : "";

    if (
      r.expurgados > 0 ||
      r.falhados.length > 0 ||
      !r.aSerio ||
      recolhas.abandonadas > 0 ||
      recolhas.orfas > 0
    ) {
      await registarSemFalhar({
        acontecimento: "pedido_expurgado",
        autorTipo: "sistema",
        autorNome: "retenção",
        resumo: r.aSerio
          ? `Purga (${DIAS_DE_RETENCAO_DOS_PEDIDOS} dias os terminados, ${DIAS_PARA_OS_ABANDONADOS} os abandonados): ${r.expurgados} pedido(s) expurgado(s), ` +
            `${r.fotosApagadas} fotografia(s) apagada(s)` +
            (r.eventosApagados > 0 ? `, ${r.eventosApagados} evento(s) tirado(s) da agenda` : "") +
            (r.eventosQueFicaram > 0
              ? `, ${r.eventosQueFicaram} evento(s) ficaram na agenda e têm de sair à mão`
              : "") +
            /*
             * O 404 à parte, e com o que ele quer dizer escrito ao lado.
             *
             * A Google responde 404 tanto a «este evento já não existe» como a
             * «esta agenda não está partilhada contigo». Um é normal; muitos
             * de seguida são a partilha da agenda a ter caído — e é preciso
             * que isso se leia como avaria, e não como trabalho feito.
             */
            (r.eventosNaoEncontrados > 0
              ? `, ${r.eventosNaoEncontrados} com 404 (evento já apagado, ou a agenda deixou de estar partilhada com a service account)`
              : "") +
            (r.falhados.length > 0 ? `, ${r.falhados.length} falhado(s)` : "") +
            (r.restantes > 0 ? `, ${r.restantes} ainda por fazer` : "") +
            recolhasEmPalavras
          : `MODO SECO — nada foi apagado. Apagaria ${r.expurgados} pedido(s), ` +
            `${r.fotosApagadas} fotografia(s) e ${r.eventosApagados} evento(s) da agenda do Google` +
            (r.restantes > 0 ? `, e ficariam ${r.restantes} para a passagem seguinte` : "") +
            recolhasEmPalavras +
            `. Para armar, ponha PURGA_ARMADA=sim na Vercel.`,
        detalhe: {
          falhados: r.falhados,
          restantes: r.restantes,
          aSerio: r.aSerio,
          naMira: r.naMira,
          eventosApagados: r.eventosApagados,
          eventosQueFicaram: r.eventosQueFicaram,
          eventosNaoEncontrados: r.eventosNaoEncontrados,
          recolhasAbandonadas: recolhas.abandonadas,
          recolhasOrfas: recolhas.orfas,
        },
      });
    }

    if (!r.aSerio) {
      console.warn(
        `[cron/purgar-pedidos] MODO SECO: apagaria ${r.expurgados} pedido(s) e ${r.fotosApagadas} fotografia(s). ` +
          `PURGA_ARMADA=sim para valer a sério.`,
      );
    }

    // Nunca em silêncio: um tecto que não se anuncia lê-se como "estava tudo feito".
    if (r.restantes > 0) {
      console.warn(`[cron/purgar-pedidos] ${r.restantes} pedido(s) elegível(eis) ficaram para a próxima passagem`);
    }
    for (const f of r.falhados) {
      console.error(`[cron/purgar-pedidos] pedido #${f.pedidoId} não foi expurgado: ${f.erro}`);
    }

    return NextResponse.json({ ok: true, ...r, recolhas });
  } catch (error) {
    console.error("[cron/purgar-pedidos]", error);
    return NextResponse.json({ error: "Erro ao purgar" }, { status: 500 });
  }
}
