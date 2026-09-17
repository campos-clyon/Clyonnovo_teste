import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { configuracaoDoEupago, NOME_DO_METODO } from "@/lib/eupago";
import { estadoDaReferencia } from "@/lib/pedir-ao-eupago";
import { darPorPago, pendentesParaSondar } from "@/lib/pagamentos-na-base";

export const runtime = "nodejs";
/** Uma chamada ao euPago por pagamento. Trinta referências não são instantâneas. */
export const maxDuration = 120;

/**
 * A SONDAGEM DE RECURSO — perguntar ao euPago o que o webhook não nos disse.
 *
 * Ponto 2.3 do `docs/plano-pagamentos-eupago.md`: das três coisas que
 * acontecem sempre a um webhook, a pior é a terceira — **não chegar**. E é a
 * pior porque é silenciosa: o cliente pagou, o dinheiro está na conta do
 * euPago, e o nosso ecrã diz-lhe que não pagou. Não há nenhum aviso a avisar
 * que um aviso não chegou.
 *
 * O euPago insiste 24 horas. Se o nosso servidor estiver em baixo mais do que
 * isso — ou se a assinatura estiver mal configurada e nós a recusarmos sem
 * saber — desiste. É para esse caso que isto existe.
 *
 * ⚠️ SÓ APANHA PAGAMENTOS; NUNCA FECHA NENHUM. Se o euPago disser que uma
 * referência está paga, credita-se. Se disser que não, não se faz nada: uma
 * referência por pagar hoje pode ser paga amanhã, e fechá-la com base numa
 * consulta que talvez não tenhamos percebido seria inventar um desfecho.
 *
 * ⚠️ E A LEITURA DE «PAGO» AINDA NÃO FOI VISTA CONTRA A SANDBOX. A página do
 * `multibanco/info` tem mais de dois anos e não diz o nome do campo de estado.
 * `estadoDaReferencia` aceita os três nomes plausíveis e, na dúvida, diz que
 * NÃO está pago — o lado seguro. Confirmar antes de isto ser a única defesa de
 * alguém.
 */

/** Uma referência criada agora ainda não teve tempo de ser paga. */
const MINUTOS_ANTES_DE_PERGUNTAR = 30;

/** Um tecto por passagem: o cron corre outra vez daqui a uma hora. */
const POR_PASSAGEM = 30;

export async function GET(req: NextRequest) {
  // Falha fechada: sem CRON_SECRET definido, a rota recusa. Aberta, seria um
  // endereço público que credita carteiras.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/conferir-pagamentos] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const conf = configuracaoDoEupago(process.env);
  if (!conf.ok) {
    // Sem euPago configurado não há nada a conferir, e não é um erro: é o
    // estado normal enquanto a cobrança não estiver ligada.
    return NextResponse.json({ ok: true, conferidos: 0, porConfigurar: conf.falta });
  }

  try {
    const pendentes = await pendentesParaSondar(MINUTOS_ANTES_DE_PERGUNTAR, POR_PASSAGEM);
    let apanhados = 0;
    const falhas: string[] = [];

    for (const p of pendentes) {
      if (!p.referencia) continue;
      const r = await estadoDaReferencia(conf.config, p.referencia, p.entidade);
      if (!r.ok) {
        falhas.push(`#${p.id}: ${r.porque}`);
        continue;
      }
      if (!r.pago) continue;

      /*
       * O VALOR CONFERE-SE AQUI TAMBÉM, e pela mesma razão do webhook: uma
       * referência antiga de um valor que entretanto mudou continua a existir
       * do lado deles. A diferença é que aqui fomos NÓS a perguntar — o que
       * torna a resposta mais fiável, e não dispensa a conferência.
       */
      if (r.valor != null && Math.abs(r.valor - p.valor) > 0.011) {
        falhas.push(
          `#${p.id}: o euPago diz ${r.valor.toFixed(2)} € e o pedido era de ${p.valor.toFixed(2)} €.`,
        );
        continue;
      }

      const feito = await darPorPago(p.id, p.negociacaoId, {
        // Sem `trid` desta consulta, a referência serve de chave: é única por
        // pagamento e é o que temos. O webhook, se vier depois, traz o `trid`
        // verdadeiro e não repete nada — a linha já não está por pagar.
        trid: `ref:${p.entidade ?? ""}:${p.referencia}`,
        valorPago: r.valor ?? p.valor,
        comissao: null,
        quando: new Date(),
      });

      if (feito.feito) {
        apanhados += 1;
        await registarSemFalhar({
          acontecimento: "pagamento_recebido",
          pedidoId: p.pedidoId,
          negociacaoId: p.negociacaoId,
          providerId: p.providerId,
          autorTipo: "sistema",
          autorNome: "conferência",
          resumo:
            `${NOME_DO_METODO[p.metodo]}: o euPago diz que a referência foi paga, ` +
            `e o aviso nunca chegou. Apanhado pela conferência.`,
          detalhe: { pagamentoId: p.id, referencia: p.referencia, valor: r.valor },
        });
        console.warn("[cron/conferir-pagamentos] apanhado sem webhook:", p.id);
      } else if (feito.duplicado) {
        falhas.push(`#${p.id}: ${feito.porque}`);
      }
    }

    if (falhas.length > 0) console.error("[cron/conferir-pagamentos]", falhas.join(" | "));
    return NextResponse.json({
      ok: true,
      perguntados: pendentes.length,
      apanhados,
      falhas: falhas.slice(0, 10),
    });
  } catch (e) {
    console.error("[cron/conferir-pagamentos]", e);
    return NextResponse.json({ error: "Falhou a conferência." }, { status: 500 });
  }
}
