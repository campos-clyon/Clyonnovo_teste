import { ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "./db";
import { garantirTabelaDasCobrancas } from "./marcas-da-divida-na-base";
import { tridDoAbatimentoAParte } from "./pago-em-mao";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import { eSemFactura } from "./sem-factura";
import { contaDaLinha } from "./conta-do-pagamento";
import {
  porqueNaoHaAcordo,
  type PedidoDeAcordoFinal,
  type PorqueNaoHaAcordo,
} from "./acordo-final";

/**
 * A ESCRITA DO ACORDO FINAL COM O CLIENTE — d78 (20-11-2026). A regra é
 * `acordo-final.ts`; aqui lê-se, decide-se pela regra e grava-se numa só
 * transacção, com as linhas trancadas. NADA SE APAGA:
 *
 *   · o registo «o cliente pagou ao profissional, em mão», quando a equipa
 *     confirma que é para o anular, fica `cancelado` com o motivo (o valor e a
 *     data ficam), e larga o índice `negociacaoPaga` — o cliente pode pagar;
 *   · as referências da dívida do profissional por pagar ficam `cancelado`,
 *     com o motivo;
 *   · a negociação fica com a taxa a zero, o valor do acordo e o motivo; num
 *     Trabalho CLYON, a taxa do pedido também (com o motivo, como a taxa
 *     abaixo do escalão).
 *
 * Não paga, não cobra, não envia nada a ninguém e não gera referências. O
 * antes e o depois vão para o histórico e para o registo permanente (a rota).
 */
export type ResultadoDoAcordo =
  | {
      ok: true;
      pedidoId: number;
      providerId: number;
      profissional: string;
      pagoAoProfissionalEm: Date | string | null;
      antes: {
        clientePaga: number;
        taxa: number | null;
        profissionalRecebia: number;
        taxaProfissional: number | null;
        taxaCliente: number | null;
        taxaClyon: number | null;
        acordoFinal: number | null;
      };
      depois: { clientePaga: number; profissionalRecebe: number; clyon: number };
      anulouEmMao: { pagamentoId: number; valor: number } | null;
      referenciasAnuladas: Array<{ pagamentoId: number; metodo: string; valor: number }>;
    }
  | { ok: false; porque: PorqueNaoHaAcordo | "nao_existe" };

const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export async function gravarAcordoFinal(
  pedido: PedidoDeAcordoFinal,
  contexto: { quem: string; novoModelo: boolean },
): Promise<ResultadoDoAcordo> {
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  await garantirTabelaDasCobrancas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const negociacaoId = pedido.negociacaoId;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const recusar = async (porque: Extract<ResultadoDoAcordo, { ok: false }>["porque"]) => {
      await conn.rollback();
      return { ok: false as const, porque };
    };

    const [linhas] = (await conn.execute(
      `SELECT n.pedidoId, n.providerId, n.estado, n.valorAcordado, n.taxaCliente, n.taxaProfissional,
              n.formaDePagamento, n.pagoEm, n.ofertaClyon, n.semFactura, n.pagamentoParaQue,
              n.createdAt AS negociacaoCriadaEm, n.acordoFinalCliente, n.acordoFinalMotivo,
              pr.name AS profissional
         FROM negociacoes n JOIN providers pr ON pr.id = n.providerId
        WHERE n.id = ? LIMIT 1 FOR UPDATE`,
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const negociacao = linhas[0];
    if (!negociacao) return recusar("nao_existe");
    const pedidoId = Number(negociacao.pedidoId);
    const [doPedido] = (await conn.execute(
      "SELECT valorFixoClyon, taxaClyon, precoClienteClyon, motivoTaxaClyon FROM simulatorOrders WHERE id = ? LIMIT 1 FOR UPDATE",
      [pedidoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const n: Record<string, unknown> = { ...negociacao, ...(doPedido[0] ?? {}) };

    const acordado = num(n.valorAcordado);
    if (acordado == null) return recusar("nao_fechado");
    const taxasAntes = taxasDaNegociacao(n);
    const semTaxa = { cliente: 0, profissional: 0 };
    const profissionalRecebeSemTaxa = quantoOProfissionalRecebe(acordado, semTaxa);

    const [pagos] = (await conn.execute(
      `SELECT id, metodo, valor, valorPago FROM pagamentos
        WHERE negociacaoPaga = ? AND estado = 'pago' LIMIT 1 FOR UPDATE`,
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];
    const pago = pagos[0] ? { id: Number(pagos[0].id), metodo: String(pagos[0].metodo ?? "") } : null;

    // A dívida do profissional já fechada (referência paga, abatimento, quitação) ou paga em partes.
    const [fechadas] = (await conn.execute(
      `SELECT id FROM pagamentos
        WHERE negociacaoId = ? AND estado = 'pago' AND negociacaoPaga IS NULL
          AND (parte = 'divida' OR trid = ?) LIMIT 1`,
      [negociacaoId, tridDoAbatimentoAParte(negociacaoId)],
    )) as [Array<Record<string, unknown>>, unknown];
    const [marcas] = (await conn.execute(
      "SELECT COUNT(*) AS n FROM cobrancasAoProfissional WHERE negociacaoId = ? AND activa = 1",
      [negociacaoId],
    )) as [Array<Record<string, unknown>>, unknown];

    const porque = porqueNaoHaAcordo(
      {
        estado: String(n.estado ?? ""),
        formaDePagamento: (n.formaDePagamento as string) ?? null,
        semFactura: eSemFactura(n),
        novoModelo: contexto.novoModelo,
        pagoAoProfissional: n.pagoEm != null,
        profissionalRecebeSemTaxa,
        pagoDoCliente: pago,
        partesPagas: Number(marcas[0]?.n ?? 0),
        dividaFechada: fechadas.length > 0,
      },
      pedido,
    );
    if (porque) return recusar(porque);

    const contaAntes = contaDaLinha(n, pago != null);
    const antes = {
      clientePaga: contaAntes?.total ?? acordado,
      taxa: num(n.taxaClyon) ?? taxasAntes.profissional,
      profissionalRecebia: contaAntes?.profissional ?? quantoOProfissionalRecebe(acordado, taxasAntes),
      taxaProfissional: num(n.taxaProfissional),
      taxaCliente: num(n.taxaCliente),
      taxaClyon: num(n.taxaClyon),
      acordoFinal: num(n.acordoFinalCliente),
    };

    // 1. O registo «pago ao profissional, em mão» que não aconteceu: cancelado, com o motivo.
    let anulouEmMao: { pagamentoId: number; valor: number } | null = null;
    if (pago && pago.metodo === "ao_profissional") {
      const [r] = (await conn.execute(
        `UPDATE pagamentos
            SET estado = 'cancelado', negociacaoPaga = NULL, erro = ?
          WHERE id = ? AND estado = 'pago' AND metodo = 'ao_profissional'`,
        [`Anulado por ${contexto.quem} (acordo final, d78): ${pedido.motivo}`.slice(0, 255), pago.id],
      )) as [{ affectedRows?: number }, unknown];
      if (Number(r?.affectedRows ?? 0) !== 1) return recusar("cliente_pagou");
      anulouEmMao = { pagamentoId: pago.id, valor: Number(pagos[0].valorPago ?? pagos[0].valor ?? 0) };
    }

    // 2. As referências da dívida do profissional ainda por pagar: canceladas.
    const [pendentes] = (await conn.execute(
      `SELECT id, metodo, valor FROM pagamentos
        WHERE negociacaoId = ? AND estado = 'pendente' AND negociacaoPaga IS NULL
          AND (parte = 'divida' OR trid = ?) FOR UPDATE`,
      [negociacaoId, tridDoAbatimentoAParte(negociacaoId)],
    )) as [Array<Record<string, unknown>>, unknown];
    const referenciasAnuladas: Array<{ pagamentoId: number; metodo: string; valor: number }> = [];
    for (const p of pendentes) {
      const [r] = (await conn.execute(
        "UPDATE pagamentos SET estado = 'cancelado', erro = ? WHERE id = ? AND estado = 'pendente'",
        [`Anulada por ${contexto.quem} (acordo final, d78): nada a dever por este pedido.`.slice(0, 255), Number(p.id)],
      )) as [{ affectedRows?: number }, unknown];
      if (Number(r?.affectedRows ?? 0) === 1) {
        referenciasAnuladas.push({ pagamentoId: Number(p.id), metodo: String(p.metodo ?? ""), valor: Number(p.valor ?? 0) });
      }
    }

    // 3. A negociação: taxa a zero, o valor do acordo e o motivo.
    await conn.execute(
      `UPDATE negociacoes
          SET taxaCliente = 0, taxaProfissional = 0, acordoFinalCliente = ?, acordoFinalMotivo = ?
        WHERE id = ?`,
      [pedido.valor, pedido.motivo.slice(0, 300), negociacaoId],
    );
    // 4. Num Trabalho CLYON, a taxa do pedido também — com o motivo (a taxa abaixo do escalão pede-o).
    const trabalhoClyon = typeof n.ofertaClyon === "string" && n.ofertaClyon !== "";
    if (trabalhoClyon && doPedido[0] && num(n.taxaClyon) != null) {
      await conn.execute("UPDATE simulatorOrders SET taxaClyon = 0, motivoTaxaClyon = ? WHERE id = ?", [
        `Acordo final com o cliente (d78): ${pedido.motivo}`.slice(0, 300),
        pedidoId,
      ]);
    }

    const depoisLinha: Record<string, unknown> = {
      ...n,
      taxaCliente: 0,
      taxaProfissional: 0,
      taxaClyon: trabalhoClyon && num(n.taxaClyon) != null ? 0 : n.taxaClyon,
      acordoFinalCliente: pedido.valor,
      acordoFinalMotivo: pedido.motivo,
    };
    const contaDepois = contaDaLinha(depoisLinha, false);
    await conn.commit();
    return {
      ok: true,
      pedidoId,
      providerId: Number(n.providerId),
      profissional: String(n.profissional ?? "o profissional"),
      pagoAoProfissionalEm: (n.pagoEm as Date | string | null) ?? null,
      antes,
      depois: {
        clientePaga: contaDepois?.total ?? pedido.valor,
        profissionalRecebe: contaDepois?.profissional ?? profissionalRecebeSemTaxa,
        clyon: contaDepois?.clyon ?? Math.round((pedido.valor - profissionalRecebeSemTaxa) * 100) / 100,
      },
      anulouEmMao,
      referenciasAnuladas,
    };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
