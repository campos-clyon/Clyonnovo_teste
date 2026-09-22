import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { configuracaoDoEupago, NOME_DO_METODO } from "@/lib/eupago";
import {
  assinaturaValida,
  confereComOPedido,
  lerAvisoDoEupago,
  type AvisoDoEupago,
} from "@/lib/webhook-do-eupago";
import {
  anotarAviso,
  anotarRecusa,
  darPorPago,
  darPorReembolsado,
  fecharSemPagar,
  guardarAviso,
  pagamentoPorId,
  type Pagamento,
} from "@/lib/pagamentos-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POR ONDE O DINHEIRO ENTRA.
 *
 * É o euPago a dizer-nos que uma transacção mudou de estado, e é a ÚNICA forma
 * de sabermos que um cliente pagou. Configura-se uma vez no backoffice deles:
 * Gestão → Canais → Listagem de Canais → Editar → Webhooks 2.0.
 *
 * O CÓDIGO QUE SE DEVOLVE É UMA INSTRUÇÃO, e não um detalhe de cortesia:
 *
 *   200 → «recebido, não voltes». O euPago risca a comunicação da lista.
 *   500 → «não consegui, volta». Ele insiste de 2 em 2 minutos, três vezes, e
 *         depois de hora a hora durante 24 horas — e manda o aviso de «Erro de
 *         Webhook 2.0» para o email da conta, que é um canal que não depende
 *         do nosso servidor estar de pé.
 *
 * Por isso a regra é: 500 quando o problema é NOSSO e tem conserto; 200 quando
 * percebemos o aviso e não há nada a fazer com ele. Responder 200 a um erro
 * nosso perde o pagamento em silêncio e para sempre.
 *
 * ⚠️ E NADA AQUI ACREDITA NO QUE LHE DIZEM. A assinatura prova que veio do
 * euPago; não prova que o valor é o nosso. Ver `confereComOPedido`.
 */

/** Uma resposta curta: o euPago não lê o corpo, só o código. */
const OK = () => NextResponse.json({ ok: true });
const VOLTA = (porque: string) => NextResponse.json({ ok: false, porque }, { status: 500 });

function euros(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`;
}

export async function POST(req: NextRequest) {
  /*
   * ⚠️ QUEM BATEU E NÃO ENTROU FICA REGISTADO — e é o que separa duas
   * histórias que apareciam como o mesmo silêncio: «o euPago não está a
   * chamar» (endereço errado, ou no canal errado) e «está a chamar e nós é que
   * recusamos» (segredo em falta, ou um segredo que já não é o dele). A
   * primeira resolve-se no backoffice deles; a segunda no nosso.
   *
   * O CORPO NÃO SE GUARDA: quem chega aqui ainda não provou ser o euPago.
   */
  const tinhaAssinatura = Boolean(req.headers.get("x-signature"));

  const conf = configuracaoDoEupago(process.env);
  if (!conf.ok || !conf.config.segredoDoWebhook) {
    /*
     * SEM SEGREDO NÃO SE VERIFICA NADA, E O QUE NÃO SE VERIFICA NÃO SE ACEITA.
     *
     * Responde-se 500 e não 200 de propósito: o euPago guarda o aviso e volta
     * durante 24 horas. Se a variável faltar num deploy, há um dia inteiro
     * para a pôr sem perder um único pagamento.
     */
    console.error(
      "[eupago webhook] sem segredo configurado:",
      conf.ok ? "falta EUPAGO_WEBHOOK_SEGREDO" : conf.falta,
    );
    await anotarRecusa(conf.ok ? "sem segredo configurado" : "euPago por configurar", {
      tinhaAssinatura,
      tamanho: Number(req.headers.get("content-length") ?? 0),
    });
    return VOLTA("A plataforma não está configurada para receber avisos.");
  }

  const corpoCru = await req.text();
  if (!assinaturaValida(corpoCru, req.headers.get("x-signature"), conf.config.segredoDoWebhook)) {
    /*
     * 401, e não 500: quem chegou aqui sem assinatura válida não é o euPago —
     * ou é, com outro segredo. Nos dois casos, aceitar era deixar qualquer
     * pessoa dar trabalhos por pagos. O euPago repete na mesma, e a repetição
     * é a janela para trocar o segredo se tiver sido isso.
     */
    console.warn("[eupago webhook] assinatura inválida");
    await anotarRecusa(tinhaAssinatura ? "assinatura não confere" : "veio sem assinatura", {
      tinhaAssinatura,
      tamanho: corpoCru.length,
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(corpoCru);
  } catch {
    return VOLTA("Corpo que não é JSON.");
  }

  const leitura = lerAvisoDoEupago(json);
  if (!leitura.ok) {
    console.error("[eupago webhook]", leitura.porque);
    return leitura.retentar ? VOLTA(leitura.porque) : OK();
  }
  const aviso = leitura.aviso;

  try {
    /*
     * A IDEMPOTÊNCIA, e é o índice único que a garante — não este `if`.
     *
     * Se o aviso já cá estava, já foi tratado: responde-se 200 para o euPago
     * parar de insistir e não se toca em mais nada. É isto que faz um aviso
     * repetido não creditar a dobrar.
     */
    const { novo } = await guardarAviso(aviso, corpoCru);
    if (!novo) return OK();

    if (aviso.pagamentoId == null) {
      // Do euPago, mas de outro produto na mesma conta. Fica guardado — a
      // conciliação precisa de o ver — e não se faz nada com ele.
      await anotarAviso(aviso.trid, aviso.estado, {
        aplicado: false,
        nota: `Identificador alheio: ${aviso.identificador ?? "(nenhum)"}.`,
      });
      return OK();
    }

    const pagamento = await pagamentoPorId(aviso.pagamentoId);
    if (!pagamento) {
      await anotarAviso(aviso.trid, aviso.estado, {
        aplicado: false,
        nota: `Não existe o pagamento ${aviso.pagamentoId}.`,
      });
      console.error("[eupago webhook] pagamento inexistente:", aviso.pagamentoId);
      return OK();
    }

    return await aplicar(aviso, pagamento);
  } catch (e) {
    /*
     * Uma falha nossa — a base em baixo, um timeout — é exactamente o caso do
     * 500: o euPago volta, e o pagamento não se perde.
     */
    console.error("[eupago webhook] falhou a aplicar", aviso.trid, e);
    return VOLTA("Erro ao aplicar o aviso.");
  }
}

async function aplicar(aviso: AvisoDoEupago, p: Pagamento) {
  const comum = {
    pedidoId: p.pedidoId,
    negociacaoId: p.negociacaoId,
    providerId: p.providerId,
    autorTipo: "sistema" as const,
    autorNome: "euPago",
  };

  if (aviso.estado === "pago") {
    /*
     * ⚠️ O VALOR CONFERE-SE ANTES DE SE CREDITAR SEJA O QUE FOR.
     *
     * A assinatura prova que o aviso veio do euPago. Não prova que é do nosso
     * valor: uma referência antiga de um valor que entretanto mudou chega
     * assinada na mesma. Dar por pago um trabalho de 105 € com um aviso de
     * 5 € é perder 100 € e ainda mandar o profissional trabalhar.
     */
    const diferenca = confereComOPedido(aviso, { pagamentoId: p.id, valor: p.valor });
    if (diferenca) {
      await anotarAviso(aviso.trid, aviso.estado, { aplicado: false, nota: diferenca });
      console.error("[eupago webhook] valor não confere:", diferenca);
      await registarSemFalhar({
        ...comum,
        acontecimento: "pagamento_falhado",
        resumo: `Aviso de pagamento recusado — ${diferenca}`,
        detalhe: { pagamentoId: p.id, trid: aviso.trid, valorDoAviso: aviso.valor },
      });
      // 200: percebemos, e repetir dava o mesmo. Fica por aplicar, à vista.
      return OK();
    }

    const r = await darPorPago(p.id, p.negociacaoId, {
      trid: aviso.trid,
      valorPago: aviso.valor,
      comissao: aviso.comissao,
      quando: aviso.quando,
    });

    if (r.feito) {
      await anotarAviso(aviso.trid, aviso.estado, { aplicado: true });
      await registarSemFalhar({
        ...comum,
        acontecimento: "pagamento_recebido",
        resumo:
          `${NOME_DO_METODO[p.metodo]}: recebidos ${euros(aviso.valor)}` +
          `${aviso.comissao ? ` (euPago: ${euros(aviso.comissao)})` : ""}.`,
        detalhe: {
          pagamentoId: p.id,
          trid: aviso.trid,
          valor: aviso.valor,
          comissao: aviso.comissao,
        },
      });
      return OK();
    }

    if (r.duplicado) {
      /*
       * O CLIENTE PAGOU DUAS VEZES. Acontece, e da forma mais banal: pagou o
       * MB WAY e pagou TAMBÉM a referência Multibanco que tinha ficado aberta.
       *
       * Não é um erro a esconder num `catch` — é dinheiro na nossa conta que é
       * dele. Sai identificado, com acontecimento próprio, para alguém o
       * devolver. Responder 200 porque repetir o aviso não muda nada.
       */
      await anotarAviso(aviso.trid, aviso.estado, { aplicado: false, nota: r.porque });
      await registarSemFalhar({
        ...comum,
        acontecimento: "pagamento_em_duplicado",
        resumo: `Pagamento a mais de ${euros(aviso.valor)} — há valor a devolver ao cliente.`,
        detalhe: { pagamentoId: p.id, trid: aviso.trid, valor: aviso.valor },
      });
      console.error("[eupago webhook] PAGAMENTO EM DUPLICADO no pagamento", p.id);
      return OK();
    }

    await anotarAviso(aviso.trid, aviso.estado, { aplicado: false, nota: r.porque });
    return OK();
  }

  if (aviso.estado === "reembolsado") {
    /*
     * Não se confere o valor: um reembolso pode ser PARCIAL, e por isso o
     * valor do aviso não tem de bater com o do pagamento. O que o estado diz é
     * que já não se pode contar com ele.
     */
    const r = await darPorReembolsado(p.id, { trid: aviso.trid, valor: aviso.valor });
    await anotarAviso(aviso.trid, aviso.estado, {
      aplicado: r.feito,
      nota: r.feito ? null : r.porque,
    });
    return OK();
  }

  const fecho =
    aviso.estado === "expirado" ? "expirado" : aviso.estado === "cancelado" ? "cancelado" : "falhado";
  const r = await fecharSemPagar(p.id, fecho, {
    trid: aviso.trid,
    motivo: `O euPago disse: ${aviso.estado}.`,
  });
  await anotarAviso(aviso.trid, aviso.estado, {
    aplicado: r.feito,
    // Um «expirado» que chegue depois do «pago» não desfaz nada, e não é um
    // erro: é a ordem de chegada. Fica dito, sem alarme.
    nota: r.feito ? null : r.porque,
  });
  return OK();
}
