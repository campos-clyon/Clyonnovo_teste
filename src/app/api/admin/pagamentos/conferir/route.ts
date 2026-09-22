import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { registarSemFalhar } from "@/lib/db";
import { trabalhoVistoPeloBackoffice } from "@/lib/acesso-ao-pagamento";
import { configuracaoDoEupago, NOME_DO_METODO } from "@/lib/eupago";
import { estadoDaReferencia } from "@/lib/pedir-ao-eupago";
import { darPorPago, pagamentoPorId } from "@/lib/pagamentos-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «JÁ FOI PAGA?» — PERGUNTADO AO euPAGO, AGORA, POR QUEM ESTÁ A OLHAR.
 *
 * *«A euPago não mostra se realmente foi feito.»* — 22-09-2026, com o
 * comprovativo da Caixa na mão: a referência 104295830, 42,00 €, paga às
 * 09:49, e o nosso ecrã a continuar a dizer «cobrar o cliente».
 *
 * Um pagamento chega-nos por um aviso do euPago — e das três coisas que
 * acontecem sempre a um webhook, a pior é **não chegar**, porque é silenciosa.
 * Não há nenhum aviso a avisar que um aviso não chegou. O cliente pagou, o
 * dinheiro está lá, e o ecrã diz-lhe que não pagou.
 *
 * Havia já a sondagem automática — `/api/cron/conferir-pagamentos`, de hora a
 * hora. Isto é a mesma pergunta feita À MÃO, e existe por uma razão que não é
 * a mesma: esperar cinquenta minutos com um comprovativo à frente não é
 * aceitável quando há um cliente do outro lado. E porque a resposta em bruto
 * fica à vista de quem a pediu — que é como se percebe o que o euPago responde
 * quando ele não concorda connosco.
 *
 * ⚠️ SÓ APANHA PAGAMENTOS; NUNCA FECHA NENHUM. Se o euPago disser que está
 * paga, credita-se pelo mesmo caminho do webhook, com a mesma conferência de
 * valor. Se disser que não, não se faz nada: uma referência por pagar hoje
 * pode ser paga amanhã, e fechá-la com base numa consulta que talvez não
 * tenhamos percebido seria inventar um desfecho.
 */

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { pagamentoId?: unknown };
  try {
    corpo = (await req.json()) as { pagamentoId?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const pagamentoId = Number(corpo.pagamentoId);
  if (!Number.isInteger(pagamentoId) || pagamentoId <= 0) {
    return NextResponse.json({ error: "Pagamento não indicado." }, { status: 400 });
  }

  const conf = configuracaoDoEupago(process.env);
  if (!conf.ok) return NextResponse.json({ error: conf.falta }, { status: 503 });

  try {
    const p = await pagamentoPorId(pagamentoId);
    if (!p) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });

    // A mesma porta do resto do backoffice: quem não pode ver o trabalho não
    // pergunta nada sobre o dinheiro dele.
    const acesso = await trabalhoVistoPeloBackoffice(p.negociacaoId);
    if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });

    if (p.estado === "pago") {
      return NextResponse.json({ ok: true, pago: true, aplicado: false, jaEstava: true });
    }

    /*
     * Só Multibanco, e é limitação deles e não escolha nossa: o
     * `multibanco/info` pergunta por referência, e uma operação MB WAY não tem
     * referência que se consulte assim.
     */
    if (!p.referencia) {
      return NextResponse.json(
        {
          error:
            "Só se consegue perguntar por uma referência Multibanco. " +
            "Num MB WAY, o aviso do euPago é o único caminho.",
        },
        { status: 400 },
      );
    }

    const r = await estadoDaReferencia(conf.config, p.referencia, p.entidade);
    if (!r.ok) return NextResponse.json({ error: r.porque }, { status: 502 });

    /*
     * A RESPOSTA EM BRUTO VOLTA SEMPRE, e não é desarrumação.
     *
     * A página do `multibanco/info` tem mais de dois anos e não diz o nome do
     * campo que traz o estado. `estadoDaReferencia` aceita os três nomes
     * plausíveis e, na dúvida, diz que NÃO está pago — o lado seguro. Quando
     * essa leitura falhar sobre uma referência que sabemos paga, é aqui que se
     * vê porquê, sem ter de ir ao registo do servidor.
     */
    const bruto = r.bruto;

    if (!r.pago) {
      // `porque` diz QUE CAMPO respondeu — ou que nenhum se reconheceu, que é
      // a hipótese que interessa quando há um comprovativo a dizer o contrário.
      return NextResponse.json({ ok: true, pago: false, aplicado: false, lido: r.porque, bruto });
    }

    if (r.valor != null && Math.abs(r.valor - p.valor) > 0.011) {
      /*
       * ⚠️ O VALOR CONFERE-SE ANTES DE SE CREDITAR SEJA O QUE FOR — a mesma
       * regra do webhook. Uma referência antiga de um valor que entretanto
       * mudou continua a existir do lado deles.
       */
      return NextResponse.json({
        ok: true,
        pago: true,
        aplicado: false,
        porque:
          `O euPago diz ${r.valor.toFixed(2)} € e este pedido era de ${p.valor.toFixed(2)} €. ` +
          `Não se creditou nada — veja qual dos dois está certo.`,
        bruto,
      });
    }

    const feito = await darPorPago(p.id, p.negociacaoId, {
      // Sem `trid` desta consulta, a referência serve de chave: é única por
      // pagamento. Se o aviso vier depois, traz o `trid` verdadeiro e não
      // repete nada — a linha já não está por pagar.
      trid: `ref:${p.entidade ?? ""}:${p.referencia}`,
      valorPago: r.valor ?? p.valor,
      comissao: null,
      quando: new Date(),
    });

    if (!feito.feito) {
      return NextResponse.json({ ok: true, pago: true, aplicado: false, porque: feito.porque, bruto });
    }

    await registarSemFalhar({
      pedidoId: p.pedidoId,
      negociacaoId: p.negociacaoId,
      providerId: p.providerId,
      autorTipo: "clyon",
      autorNome: colab?.nome ?? "a CLYON",
      acontecimento: "pagamento_recebido",
      resumo:
        `${NOME_DO_METODO[p.metodo]}: o euPago confirmou que a referência foi paga. ` +
        `O aviso não tinha chegado — apanhado à mão.`,
      detalhe: { pagamentoId: p.id, referencia: p.referencia, valor: r.valor ?? p.valor },
    });

    return NextResponse.json({ ok: true, pago: true, aplicado: true, bruto });
  } catch (e) {
    console.error("[admin/pagamentos/conferir]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível perguntar ao euPago.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
