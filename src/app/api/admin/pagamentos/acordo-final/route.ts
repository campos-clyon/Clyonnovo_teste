import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { appendOrderHistory, ensureNegociacoesTable, getPool, registarSemFalhar } from "@/lib/db";
import { PORQUE_NAO_HA_ACORDO, fraseDoAcordoFinal, lerPedidoDeAcordoFinal } from "@/lib/acordo-final";
import { gravarAcordoFinal } from "@/lib/acordo-final-na-base";
import { segueONovoModelo } from "@/lib/novo-modelo-no-servidor";
import { diaEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pagamentos/acordo-final — d78 (CEO e dono, 20-11-2026).
 *
 * `{ negociacaoId, valor, motivo, anularPagoEmMao? }`. Só o administrador, com
 * motivo obrigatório. Um trabalho já pago ao profissional em que se combinou
 * com o cliente um valor final abaixo do que o profissional recebeu: a taxa
 * passa a zero, o cliente paga o acordo (sem fatura), o profissional fica com
 * o que se lhe transferiu e não deve nada, e a CLYON suporta a diferença. A
 * regra é `acordo-final.ts`; a escrita `acordo-final-na-base.ts`.
 *
 * NÃO ENVIA NADA A NINGUÉM, não gera referências e não paga: o valor final ao
 * cliente envia-se depois, pelo botão de sempre, que já pede o acordo.
 */
const NAO_ENCONTRADO: Record<string, [string, number]> = {
  nao_existe: ["Trabalho não encontrado.", 404],
};

/** 2026-11-19T12:02:17Z → «19/11/2026» (hora de Lisboa). */
function dataEmLisboa(v: Date | string | null): string | null {
  const d = instanteDaBase(v);
  if (!d) return null;
  const [a, m, dia] = diaEmLisboa(d).split("-");
  return `${dia}/${m}/${a}`;
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const lido = lerPedidoDeAcordoFinal(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
  const pedido = lido.pedido;
  const quem = colab?.nome ?? "a CLYON";

  try {
    // O modelo de 15-11 decide-se fora da transacção (lê os pagamentos), como no «Já recebemos».
    await ensureNegociacoesTable();
    const pool = await getPool();
    if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
    const [linhas] = (await pool.execute(
      `SELECT id, ofertaClyon, estado, execucaoEnviadaEm, provaJson, confirmadoEm, pagoEm, formaDePagamento
         FROM negociacoes WHERE id = ? LIMIT 1`,
      [pedido.negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];
    if (!linhas[0]) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    const novoModelo = await segueONovoModelo({ ...linhas[0], id: pedido.negociacaoId });

    const r = await gravarAcordoFinal(pedido, { quem, novoModelo });
    if (!r.ok) {
      const [texto, estado] = NAO_ENCONTRADO[r.porque] ?? [PORQUE_NAO_HA_ACORDO[r.porque as keyof typeof PORQUE_NAO_HA_ACORDO], 409];
      return NextResponse.json({ error: texto }, { status: estado });
    }

    const frase = fraseDoAcordoFinal({
      quem,
      motivo: pedido.motivo,
      valor: pedido.valor,
      profissional: r.profissional,
      pagoAoProfissional: r.depois.profissionalRecebe,
      pagoAoProfissionalEm: dataEmLisboa(r.pagoAoProfissionalEm),
      antes: r.antes,
      anulouEmMao: r.anulouEmMao?.valor ?? null,
      referenciasAnuladas: r.referenciasAnuladas.length,
    });
    await appendOrderHistory(r.pedidoId, {
      type: "note",
      by: colab ? { id: colab.id, nome: colab.nome, role: colab.papel } : null,
      message: frase,
    });
    await registarSemFalhar({
      acontecimento: "pagamento_corrigido",
      pedidoId: r.pedidoId,
      negociacaoId: pedido.negociacaoId,
      providerId: r.providerId,
      autorTipo: "clyon",
      autorNome: quem,
      resumo: frase,
      valor: pedido.valor,
      detalhe: {
        tipo: "acordo_final",
        motivo: pedido.motivo,
        antes: r.antes,
        depois: { ...r.depois, taxaProfissional: 0, taxaCliente: 0, acordoFinal: pedido.valor },
        anulouEmMao: r.anulouEmMao,
        referenciasAnuladas: r.referenciasAnuladas,
      },
    });
    if (r.anulouEmMao) {
      await registarSemFalhar({
        acontecimento: "pagamento_corrigido",
        pedidoId: r.pedidoId,
        negociacaoId: pedido.negociacaoId,
        providerId: r.providerId,
        autorTipo: "clyon",
        autorNome: quem,
        resumo: `Registo «o cliente pagou ao profissional, em mão» anulado por ${quem} (acordo final): o cliente ainda não pagou.`,
        valor: r.anulouEmMao.valor,
        detalhe: { tipo: "pago_em_mao_anulado", pagamentoId: r.anulouEmMao.pagamentoId, antes: "pago", depois: "cancelado", motivo: pedido.motivo },
      });
    }
    for (const ref of r.referenciasAnuladas) {
      await registarSemFalhar({
        acontecimento: "referencia_anulada",
        pedidoId: r.pedidoId,
        negociacaoId: pedido.negociacaoId,
        providerId: r.providerId,
        autorTipo: "clyon",
        autorNome: quem,
        resumo: `Referência da dívida do profissional anulada por ${quem} (acordo final): ele não deve nada por este pedido.`,
        valor: ref.valor,
        detalhe: { pagamentoId: ref.pagamentoId, metodo: ref.metodo, motivo: pedido.motivo, euPagoAvisado: false },
      });
    }

    return NextResponse.json({ ok: true, feito: frase, antes: r.antes, depois: r.depois });
  } catch (e) {
    console.error("[admin/pagamentos/acordo-final]", e);
    return NextResponse.json({ error: "Não foi possível gravar o acordo final." }, { status: 500 });
  }
}
