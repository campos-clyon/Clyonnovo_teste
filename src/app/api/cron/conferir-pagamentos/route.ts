import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { configuracaoDoEupago, NOME_DO_METODO } from "@/lib/eupago";
import { estadoDaReferencia } from "@/lib/pedir-ao-eupago";
import {
  darPorPago,
  fecharSemPagar,
  pagamentosDaNegociacao,
  pendentesParaSondar,
  type Pagamento,
} from "@/lib/pagamentos-na-base";
import { consultaDaPago, fechaPorCaducar, pagamentoForaDeVigor } from "@/lib/conferir-o-pagamento";
import { bearerConfere } from "@/lib/segredo-igual";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";

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
 * 27-10-2026 (d16) — o que mudou:
 *
 *   · MB WAY TAMBÉM. Os MB WAY pendentes das últimas 48 horas perguntam-se
 *     pela referência que a criação devolveu. Se o euPago não souber
 *     responder por ela, fica dito no carimbo e nada muda.
 *   · AS MAIS RECENTES PRIMEIRO (ver `pendentesParaSondar`), e uma Multibanco
 *     que passou o prazo com folga e que o euPago diz não estar paga fecha-se
 *     como `expirado` — já não tapa as novas.
 *   · SÓ PAGA COM O VALOR DITO E A BATER. Sem valor, fica por confirmar, no
 *     carimbo da rotina (painel das rotinas no backoffice).
 *   · UMA REFERÊNCIA FORA DE VIGOR não fecha o pedido (`pagamentoForaDeVigor`).
 *
 * ⚠️ A LEITURA DE «PAGO» AINDA NÃO FOI VISTA CONTRA UMA RESPOSTA REAL. A página
 * do `multibanco/info` não diz o nome do campo de estado. `estadoDaReferencia`
 * aceita os nomes plausíveis e, na dúvida, diz que NÃO está pago.
 */

/** Uma referência criada agora ainda não teve tempo de ser paga. */
const MINUTOS_ANTES_DE_PERGUNTAR = 30;

/** Um tecto por passagem: o cron corre outra vez daqui a uma hora. */
const POR_PASSAGEM = 30;

/** Até quantos dias atrás se pergunta por uma Multibanco (prazo de 3 + folga). */
const DIAS_DA_MULTIBANCO = 10;

/** O MB WAY: cinco minutos para pagar; pergunta-se depois de dez, até dois dias. */
const MINUTOS_ANTES_DO_MBWAY = 10;
const DIAS_DO_MBWAY = 2;
const MBWAY_POR_PASSAGEM = 10;

type Saida = {
  perguntados: number;
  apanhados: number;
  caducados: number;
  falhas: string[];
  porConfirmar: string[];
};

async function conferirUm(
  conf: { config: Parameters<typeof estadoDaReferencia>[0] },
  p: Pagamento,
  s: Saida,
): Promise<void> {
  if (!p.referencia) return;
  const r = await estadoDaReferencia(conf.config, p.referencia, p.metodo === "multibanco" ? p.entidade : null);
  if (!r.ok) {
    // Um MB WAY que o euPago não sabe consultar por referência fica por
    // confirmar; uma Multibanco que não responde é uma falha da rotina.
    (p.metodo === "mbway" ? s.porConfirmar : s.falhas).push(`#${p.id}: ${r.porque}`);
    return;
  }

  const decisao = consultaDaPago(r, p.valor);
  if (!decisao.aplicar) {
    if (decisao.porConfirmar) {
      s.porConfirmar.push(`#${p.id}: ${decisao.porque}`);
      return;
    }
    // Não está paga. Passado o prazo com folga, fecha-se como caducada.
    if (fechaPorCaducar(p)) {
      const f = await fecharSemPagar(p.id, "expirado", {
        motivo: "Passou o prazo da referência e o euPago diz que não foi paga.",
      });
      if (f.feito) s.caducados += 1;
    }
    return;
  }

  const foraDeVigor = pagamentoForaDeVigor(p, await pagamentosDaNegociacao(p.negociacaoId));
  if (foraDeVigor) {
    s.porConfirmar.push(`#${p.id}: ${foraDeVigor}`);
    return;
  }

  const feito = await darPorPago(p.id, p.negociacaoId, {
    // Sem `trid` desta consulta, a referência serve de chave: é única por
    // pagamento e é o que temos. O webhook, se vier depois, traz o `trid`
    // verdadeiro e não repete nada — a linha já não está por pagar.
    trid: `ref:${p.entidade ?? ""}:${p.referencia}`,
    valorPago: decisao.valor,
    comissao: null,
    quando: new Date(),
  });

  if (feito.feito) {
    s.apanhados += 1;
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
      detalhe: { pagamentoId: p.id, referencia: p.referencia, valor: decisao.valor },
    });
    console.warn("[cron/conferir-pagamentos] apanhado sem webhook:", p.id);
  } else if (feito.duplicado) {
    s.falhas.push(`#${p.id}: ${feito.porque}`);
  }
}

export async function GET(req: NextRequest) {
  // Falha fechada: sem CRON_SECRET definido, a rota recusa. Aberta, seria um
  // endereço público que credita carteiras.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/conferir-pagamentos] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  // Em tempo constante — ver segredo-igual.ts.
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const conf = configuracaoDoEupago(process.env);
  if (!conf.ok) {
    // Sem euPago configurado não há nada a conferir, e não é um erro: é o
    // estado normal enquanto a cobrança não estiver ligada. Carimba-se na
    // mesma (27-10-2026, d7): a rotina passou.
    await carimbarPassagem("conferir-pagamentos", async () => null, () => ({
      ok: true,
      motivo: "euPago por configurar — nada a conferir",
    }));
    return NextResponse.json({ ok: true, conferidos: 0, porConfigurar: conf.falta });
  }

  try {
    // Cada passagem carimbada, com nada a fazer ou a rebentar (27-10-2026, d7).
    const saida = await carimbarPassagem(
      "conferir-pagamentos",
      async () => {
        const multibanco = await pendentesParaSondar(
          MINUTOS_ANTES_DE_PERGUNTAR,
          POR_PASSAGEM,
          "multibanco",
          DIAS_DA_MULTIBANCO,
        );
        const mbway = await pendentesParaSondar(
          MINUTOS_ANTES_DO_MBWAY,
          MBWAY_POR_PASSAGEM,
          "mbway",
          DIAS_DO_MBWAY,
        );
        const s: Saida = { perguntados: 0, apanhados: 0, caducados: 0, falhas: [], porConfirmar: [] };
        for (const p of [...multibanco, ...mbway]) {
          s.perguntados += 1;
          await conferirUm(conf, p, s);
        }
        if (s.falhas.length > 0) console.error("[cron/conferir-pagamentos]", s.falhas.join(" | "));
        if (s.porConfirmar.length > 0) {
          console.warn("[cron/conferir-pagamentos] por confirmar:", s.porConfirmar.join(" | "));
        }
        return s;
      },
      (s) => ({
        // O que fica por confirmar também acende a rotina: é para alguém ver.
        ok: s.falhas.length === 0 && s.porConfirmar.length === 0,
        motivo:
          s.falhas.length > 0
            ? `${s.falhas.length} referência(s) com problema: ${s.falhas[0]}`
            : s.porConfirmar.length > 0
              ? `${s.porConfirmar.length} por confirmar: ${s.porConfirmar[0]}`
              : s.apanhados > 0
                ? `${s.apanhados} pagamento(s) apanhado(s) sem aviso`
                : null,
        detalhe: {
          perguntados: s.perguntados,
          apanhados: s.apanhados,
          caducados: s.caducados,
          falhas: s.falhas.slice(0, 10),
          porConfirmar: s.porConfirmar.slice(0, 10),
        },
      }),
    );
    return NextResponse.json({
      ok: true,
      perguntados: saida.perguntados,
      apanhados: saida.apanhados,
      caducados: saida.caducados,
      falhas: saida.falhas.slice(0, 10),
      porConfirmar: saida.porConfirmar.slice(0, 10),
    });
  } catch (e) {
    console.error("[cron/conferir-pagamentos]", e);
    return NextResponse.json({ error: "Falhou a conferência." }, { status: 500 });
  }
}
