import { ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "./db";
import {
  planoDaCorreccao,
  type PedidoDeCorreccao,
  type PlanoDaCorreccao,
  type PorqueNaoSeCorrige,
} from "./corrigir-pagamento-registado";
import { tridDoAbatimentoAParte } from "./pago-em-mao";

/**
 * A ESCRITA DA CORRECÇÃO DE UM PAGAMENTO REGISTADO — 04-11-2026 (d9). A regra
 * é `corrigir-pagamento-registado.ts`; aqui só se lê, se decide pela regra e se
 * grava, numa transacção, com as linhas trancadas: a negociação (a fatura, a
 * declaração e as taxas) e a linha do pagamento (o valor). Não paga, não
 * cobra e não mexe em mais nada.
 */
export type ResultadoDaCorreccao =
  | { ok: true; pedidoId: number; providerId: number; pagamentoId: number; metodo: string; plano: Extract<PlanoDaCorreccao, { ok: true }> }
  | { ok: false; porque: PorqueNaoSeCorrige | "nao_existe" | "nao_fechado" | "sem_pagamento" };

export async function corrigirPagamentoRegistado(
  negociacaoId: number,
  pedido: PedidoDeCorreccao,
): Promise<ResultadoDaCorreccao> {
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const recusar = async (porque: Extract<ResultadoDaCorreccao, { ok: false }>["porque"]) => {
      await conn.rollback();
      return { ok: false as const, porque };
    };

    const [linhas] = (await conn.execute(
      `SELECT pedidoId, providerId, estado, valorAcordado, taxaCliente, taxaProfissional,
              formaDePagamento, pagoEm, ofertaClyon, semFactura, motivoSemFactura,
              pagamentoParaQue, createdAt AS negociacaoCriadaEm
         FROM negociacoes
        WHERE id = ? LIMIT 1 FOR UPDATE`,
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const negociacao = linhas[0];
    if (!negociacao) return recusar("nao_existe");
    if (negociacao.estado !== "acordada" || negociacao.valorAcordado == null) return recusar("nao_fechado");
    // Num Trabalho CLYON, a conta faz-se pelo preço do pedido (só se lê).
    const [doPedido] = (await conn.execute(
      "SELECT valorFixoClyon, taxaClyon, precoClienteClyon FROM simulatorOrders WHERE id = ? LIMIT 1",
      [Number(negociacao.pedidoId)],
    )) as [Array<Record<string, unknown>>, unknown];
    const n: Record<string, unknown> = { ...negociacao, ...(doPedido[0] ?? {}) };

    // A linha que fecha a negociação (o índice único `negociacaoPaga`).
    const [pagos] = (await conn.execute(
      `SELECT id, metodo, valor, valorPago FROM pagamentos
        WHERE negociacaoPaga = ? AND estado = 'pago' LIMIT 1 FOR UPDATE`,
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const pg = pagos[0];
    if (!pg) return recusar("sem_pagamento");
    const metodo = String(pg.metodo ?? "");
    const registado = Number(pg.valorPago ?? pg.valor ?? 0);

    // Num pago em mão, a dívida já fechada numa linha à parte (abatida, paga, quitada).
    const [aParte] = (await conn.execute(
      `SELECT valorPago, valor FROM pagamentos
        WHERE trid = ? AND estado = 'pago' AND negociacaoPaga IS NULL LIMIT 1`,
      [tridDoAbatimentoAParte(negociacaoId)],
    )) as [Array<Record<string, unknown>>, unknown];
    const fechada = aParte[0] ? Number(aParte[0].valorPago ?? aParte[0].valor ?? 0) : null;

    const plano = planoDaCorreccao(
      { linha: n, metodo, valor: registado, pagoAoProfissionalEm: n.pagoEm ?? null, dividaFechadaCom: fechada },
      pedido,
    );
    if (!plano.ok) return recusar(plano.porque);

    const { depois } = plano;
    /*
     * A FATURA: a marca e a declaração juntas, e as taxas se se juntaram. O
     * motivo do «sem fatura» é o desta correcção quando passa a sem; mantém-se
     * o que havia quando já era sem; com fatura limpa-se (o histórico guarda-o).
     */
    await conn.execute(
      `UPDATE negociacoes
          SET semFactura = ?, pagamentoParaQue = ?,
              motivoSemFactura = ?,
              taxaCliente = ?, taxaProfissional = ?,
              taxasComFacturaJson = IF(?, ?, taxasComFacturaJson)
        WHERE id = ?`,
      [
        depois.semFactura ? 1 : 0,
        depois.declarado,
        depois.semFactura
          ? plano.antes.semFactura
            ? (String(n.motivoSemFactura ?? "").trim() || pedido.motivo)
            : pedido.motivo
          : null,
        depois.taxas.cliente,
        depois.taxas.profissional,
        plano.juntaAsTaxas ? 1 : 0,
        JSON.stringify(plano.antes.taxas),
        negociacaoId,
      ],
    );
    if (plano.muda.valor) {
      await conn.execute("UPDATE pagamentos SET valor = ?, valorPago = ? WHERE id = ?", [
        depois.valor,
        depois.valor,
        Number(pg.id),
      ]);
    }
    await conn.commit();
    return {
      ok: true,
      pedidoId: Number(n.pedidoId),
      providerId: Number(n.providerId),
      pagamentoId: Number(pg.id),
      metodo,
      plano,
    };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
