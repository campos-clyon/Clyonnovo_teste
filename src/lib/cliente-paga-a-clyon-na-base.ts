import { ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "./db";
import { garantirTabelaDasCobrancas } from "./marcas-da-divida-na-base";
import { taxasDaNegociacao } from "./taxas-plataforma";
import { eSemFactura, taxasSemFactura } from "./sem-factura";
import { contaDaLinha, eTrabalhoClyon } from "./conta-do-pagamento";
import { taxaAPassarAClyon } from "./taxa-a-passar-a-clyon";
import { regimeDaNegociacao } from "./total-ao-cliente";
import { lerBase } from "./base-do-preco";
import { lerForma } from "./forma-de-pagamento";
import { eDoCliente } from "./parte-do-pagamento";
import {
  lerHistorico,
  porqueNaoDesfaz,
  porqueNaoPassa,
  ultimaPassagem,
  type EntradaDoHistorico,
  type OAntes,
  type ODepois,
  type PedidoDeDesfazer,
  type PedidoDePassagem,
  type PorqueNaoDesfaz,
  type PorqueNaoPassa,
  type ReferenciaCancelada,
} from "./cliente-paga-a-clyon";

/**
 * A ESCRITA DO «O CLIENTE PAGA À CLYON» — d82 (21-11-2026). A regra é
 * `cliente-paga-a-clyon.ts`; aqui lê-se, decide-se pela regra e grava-se numa só
 * transacção, com as linhas trancadas. Com `previsualizar`, faz a conta e volta
 * atrás sem gravar nada. NADA SE APAGA:
 *
 *   · as referências por pagar ficam `cancelado`, com o motivo (o valor e a data
 *     ficam) — ao passar, as da taxa do parceiro; ao desfazer, as do cliente;
 *   · a negociação guarda quando, por quem e porquê, e o histórico das
 *     passagens e dos desfazer com o antes de cada uma (o desfazer repõe-no).
 *
 * Não paga, não cobra, não envia nada a ninguém e não gera referências: o valor
 * final ao cliente envia-se depois, pelo botão de sempre.
 */

type Linha = Record<string, unknown>;
type Conexao = import("mysql2/promise").PoolConnection;

const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const aosCentimos = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export type ResultadoDaPassagem =
  | {
      ok: true;
      pedidoId: number;
      providerId: number;
      antes: OAntes;
      depois: ODepois;
      referenciasCanceladas: ReferenciaCancelada[];
      gravado: boolean;
    }
  | { ok: false; porque: PorqueNaoPassa | "nao_existe" };

export type ResultadoDoDesfazer =
  | { ok: true; pedidoId: number; providerId: number; referenciasCanceladas: ReferenciaCancelada[]; gravado: boolean }
  | { ok: false; porque: PorqueNaoDesfaz | "nao_existe" };

async function lerOTrabalho(conn: Conexao, negociacaoId: number) {
  const [linhas] = (await conn.execute(
    `SELECT n.id, n.pedidoId, n.providerId, n.estado, n.valorAcordado, n.taxaCliente, n.taxaProfissional,
            n.formaDePagamento, n.pagoEm, n.ofertaClyon, n.semFactura, n.motivoSemFactura, n.taxasComFacturaJson,
            n.regimeDoProfissional, n.createdAt AS negociacaoCriadaEm,
            n.clientePagaAClyonEm, n.clientePagaAClyonPor, n.clientePagaAClyonMotivo, n.clientePagaAClyonHistoricoJson,
            pr.regimeIva, pr.regimeIvaConfirmadoEm
       FROM negociacoes n JOIN providers pr ON pr.id = n.providerId
      WHERE n.id = ? LIMIT 1 FOR UPDATE`,
    [negociacaoId],
  )) as [Linha[], unknown];
  const negociacao = linhas[0];
  if (!negociacao) return null;
  const pedidoId = Number(negociacao.pedidoId);
  const [doPedido] = (await conn.execute(
    "SELECT valorFixoClyon, taxaClyon, precoClienteClyon, baseDoPreco FROM simulatorOrders WHERE id = ? LIMIT 1 FOR UPDATE",
    [pedidoId],
  )) as [Linha[], unknown];
  const [pagamentos] = (await conn.execute(
    "SELECT id, estado, metodo, valor, parte FROM pagamentos WHERE negociacaoId = ? FOR UPDATE",
    [negociacaoId],
  )) as [Linha[], unknown];
  const [marcas] = (await conn.execute(
    "SELECT COUNT(*) AS n FROM cobrancasAoProfissional WHERE negociacaoId = ? AND activa = 1",
    [negociacaoId],
  )) as [Linha[], unknown];
  return {
    pedidoId,
    n: { ...negociacao, ...(doPedido[0] ?? {}) } as Linha,
    temPedido: Boolean(doPedido[0]),
    pagamentos,
    partesPagas: Number(marcas[0]?.n ?? 0),
  };
}

/** Cancela as pendentes dadas, com o motivo; devolve as que mudaram. */
async function cancelarPendentes(
  conn: Conexao,
  pendentes: Linha[],
  motivo: string,
): Promise<ReferenciaCancelada[]> {
  const feitas: ReferenciaCancelada[] = [];
  for (const p of pendentes) {
    const [r] = (await conn.execute("UPDATE pagamentos SET estado = 'cancelado', erro = ? WHERE id = ? AND estado = 'pendente'", [
      motivo.slice(0, 255),
      Number(p.id),
    ])) as [{ affectedRows?: number }, unknown];
    if (Number(r?.affectedRows ?? 0) === 1) {
      feitas.push({ pagamentoId: Number(p.id), metodo: String(p.metodo ?? ""), valor: Number(p.valor ?? 0) });
    }
  }
  return feitas;
}

/** O que o cliente pagava ao parceiro e o que o parceiro passava à CLYON, no modelo de 15-11. */
function contaDoAntes(n: Linha): OAntes {
  const acordado = num(n.valorAcordado);
  const d = acordado != null ? taxaAPassarAClyon(acordado, taxasDaNegociacao(n), regimeDaNegociacao(n)) : null;
  return {
    clientePagavaAoParceiro: d?.recebidoDoCliente ?? null,
    parceiroPassavaAClyon: d?.total ?? null,
    semFactura: eSemFactura(n),
    base: lerBase(n.baseDoPreco),
    valor: num(n.valorFixoClyon) ?? acordado,
  };
}

export async function passarOClienteAPagarAClyon(
  pedido: PedidoDePassagem,
  contexto: { quem: string; novoModelo: boolean; agora?: Date },
): Promise<ResultadoDaPassagem> {
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  await garantirTabelaDasCobrancas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const agora = contexto.agora ?? new Date();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const recusar = async (porque: Extract<ResultadoDaPassagem, { ok: false }>["porque"]) => {
      await conn.rollback();
      return { ok: false as const, porque };
    };
    const lido = await lerOTrabalho(conn, pedido.negociacaoId);
    if (!lido) return recusar("nao_existe");
    const { n, pedidoId, pagamentos } = lido;

    const porque = porqueNaoPassa(
      {
        estado: String(n.estado ?? ""),
        trabalhoClyon: eTrabalhoClyon(n),
        novoModelo: contexto.novoModelo,
        passadoEm: n.clientePagaAClyonEm,
        formaDePagamento: lerForma(n.formaDePagamento),
        pagamentosPagos: pagamentos.filter((p) => p.estado === "pago").length,
        partesPagas: lido.partesPagas,
        pagoAoProfissionalEm: n.pagoEm,
        base: lerBase(n.baseDoPreco),
      },
      pedido,
    );
    if (porque) return recusar(porque);

    const antes = contaDoAntes(n);
    const entradaAntes: EntradaDoHistorico["antes"] = {
      semFactura: eSemFactura(n),
      motivoSemFactura: (n.motivoSemFactura as string) ?? null,
      taxaCliente: num(n.taxaCliente),
      taxaProfissional: num(n.taxaProfissional),
      taxasComFacturaJson: (n.taxasComFacturaJson as string) ?? null,
      base: lerBase(n.baseDoPreco),
      valorFixoClyon: num(n.valorFixoClyon),
      precoClienteClyon: num(n.precoClienteClyon),
      valorAcordado: num(n.valorAcordado),
    };

    // 1. A fatura escolhida — como `mudarAFacturaDaNegociacao`: sem fatura juntam-se as taxas (se ainda não estão).
    const taxasAntes = taxasDaNegociacao(n);
    const semFactura = !pedido.comFatura;
    const taxasDepois = semFactura && !eSemFactura(n) ? taxasSemFactura(taxasAntes) : taxasAntes;
    const juntou = taxasDepois.cliente !== taxasAntes.cliente || taxasDepois.profissional !== taxasAntes.profissional;
    await conn.execute(
      `UPDATE negociacoes
          SET semFactura = ?, motivoSemFactura = ?, taxaCliente = ?, taxaProfissional = ?,
              taxasComFacturaJson = ?
        WHERE id = ?`,
      [
        semFactura ? 1 : 0,
        semFactura ? `O cliente paga à CLYON, sem fatura (d82): ${pedido.motivo}`.slice(0, 300) : null,
        taxasDepois.cliente,
        taxasDepois.profissional,
        juntou ? JSON.stringify(taxasAntes) : ((n.taxasComFacturaJson as string) ?? null),
        pedido.negociacaoId,
      ],
    );

    // 2. Um valor «por carga» que passa a valor total (o de uma carga).
    const depoisDoPedido: Linha = {};
    if (pedido.valorTotal != null && lido.temPedido) {
      await conn.execute(
        `UPDATE simulatorOrders
            SET baseDoPreco = 'total', valorFixoClyon = ?, precoClienteClyon = CASE WHEN precoClienteClyon IS NULL THEN NULL ELSE ? END
          WHERE id = ?`,
        [pedido.valorTotal, pedido.valorTotal, pedidoId],
      );
      await conn.execute("UPDATE negociacoes SET valorAcordado = ? WHERE id = ?", [pedido.valorTotal, pedido.negociacaoId]);
      depoisDoPedido.baseDoPreco = "total";
      depoisDoPedido.valorFixoClyon = pedido.valorTotal;
      depoisDoPedido.valorAcordado = pedido.valorTotal;
      if (num(n.precoClienteClyon) != null) depoisDoPedido.precoClienteClyon = pedido.valorTotal;
    }

    // 3. As referências por pagar da taxa do parceiro: canceladas, com o motivo.
    const referenciasCanceladas = await cancelarPendentes(
      conn,
      pagamentos.filter((p) => p.estado === "pendente"),
      `Cancelada por ${contexto.quem} (d82): o cliente paga à CLYON — o parceiro já não passa a taxa por este pedido.`,
    );

    // 4. A conta do depois — a mesma da casa (`contaDaLinha`), já no caminho em que o cliente paga à CLYON.
    const depoisLinha: Linha = {
      ...n,
      ...depoisDoPedido,
      semFactura: semFactura ? 1 : 0,
      taxaCliente: taxasDepois.cliente,
      taxaProfissional: taxasDepois.profissional,
    };
    const conta = contaDaLinha(depoisLinha, false);
    const valorDepois = num(depoisLinha.valorFixoClyon) ?? num(depoisLinha.valorAcordado);
    const depois: ODepois = {
      clientePaga: conta?.total ?? valorDepois ?? 0,
      comFatura: !semFactura,
      profissionalRecebe: conta?.profissional ?? 0,
      clyon: conta ? aosCentimos(conta.taxas.reduce((s, t) => s + t.valor, 0)) : 0,
      base: lerBase(depoisLinha.baseDoPreco),
      valor: valorDepois,
    };

    // 5. A marca e o histórico, com o antes (o desfazer repõe-no).
    const historico = lerHistorico(n.clientePagaAClyonHistoricoJson);
    historico.push({
      accao: "passar",
      em: agora.toISOString(),
      por: contexto.quem,
      motivo: pedido.motivo,
      antes: entradaAntes,
      conta: { antes, depois },
      referenciasCanceladas,
    });
    await conn.execute(
      `UPDATE negociacoes
          SET clientePagaAClyonEm = ?, clientePagaAClyonPor = ?, clientePagaAClyonMotivo = ?, clientePagaAClyonHistoricoJson = ?
        WHERE id = ?`,
      [agora, contexto.quem.slice(0, 120), pedido.motivo.slice(0, 300), JSON.stringify(historico), pedido.negociacaoId],
    );

    if (pedido.previsualizar) await conn.rollback();
    else await conn.commit();
    return {
      ok: true,
      pedidoId,
      providerId: Number(n.providerId),
      antes,
      depois,
      referenciasCanceladas: pedido.previsualizar
        ? pagamentos
            .filter((p) => p.estado === "pendente")
            .map((p) => ({ pagamentoId: Number(p.id), metodo: String(p.metodo ?? ""), valor: Number(p.valor ?? 0) }))
        : referenciasCanceladas,
      gravado: !pedido.previsualizar,
    };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

export async function desfazerOClientePagaAClyon(
  pedido: PedidoDeDesfazer,
  contexto: { quem: string; agora?: Date },
): Promise<ResultadoDoDesfazer> {
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  await garantirTabelaDasCobrancas();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const agora = contexto.agora ?? new Date();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const recusar = async (porque: Extract<ResultadoDoDesfazer, { ok: false }>["porque"]) => {
      await conn.rollback();
      return { ok: false as const, porque };
    };
    const lido = await lerOTrabalho(conn, pedido.negociacaoId);
    if (!lido) return recusar("nao_existe");
    const { n, pedidoId, pagamentos } = lido;
    const porque = porqueNaoDesfaz({
      passadoEm: n.clientePagaAClyonEm,
      pagamentosDoClientePagos: pagamentos.filter((p) => p.estado === "pago" && eDoCliente(p)).length,
      pagoAoProfissionalEm: n.pagoEm,
    });
    if (porque) return recusar(porque);

    const historico = lerHistorico(n.clientePagaAClyonHistoricoJson);
    const ultima = ultimaPassagem(historico);

    // 1. As referências por pagar do cliente: canceladas (no modelo de 15-11 o cliente paga ao parceiro).
    const referenciasCanceladas = await cancelarPendentes(
      conn,
      pagamentos.filter((p) => p.estado === "pendente" && eDoCliente(p)),
      `Cancelada por ${contexto.quem} (d82, desfeito): o cliente volta a pagar ao parceiro.`,
    );

    // 2. A fatura, as taxas e o valor voltam ao que eram antes da passagem.
    if (ultima) {
      const a = ultima.antes;
      await conn.execute(
        `UPDATE negociacoes
            SET semFactura = ?, motivoSemFactura = ?, taxaCliente = ?, taxaProfissional = ?, taxasComFacturaJson = ?
          WHERE id = ?`,
        [a.semFactura ? 1 : 0, a.motivoSemFactura, a.taxaCliente, a.taxaProfissional, a.taxasComFacturaJson, pedido.negociacaoId],
      );
      const mudouABase = ultima.conta?.depois.base !== a.base || (ultima.conta?.depois.valor ?? null) !== (a.valorFixoClyon ?? a.valorAcordado);
      if (mudouABase && lido.temPedido) {
        await conn.execute(
          "UPDATE simulatorOrders SET baseDoPreco = ?, valorFixoClyon = ?, precoClienteClyon = ? WHERE id = ?",
          [a.base, a.valorFixoClyon, a.precoClienteClyon, pedidoId],
        );
        if (a.valorAcordado != null) {
          await conn.execute("UPDATE negociacoes SET valorAcordado = ? WHERE id = ?", [a.valorAcordado, pedido.negociacaoId]);
        }
      }
    }

    // 3. A marca sai; o histórico fica, com mais esta entrada.
    historico.push({
      accao: "desfazer",
      em: agora.toISOString(),
      por: contexto.quem,
      motivo: pedido.motivo,
      antes: ultima?.antes ?? {
        semFactura: eSemFactura(n),
        motivoSemFactura: (n.motivoSemFactura as string) ?? null,
        taxaCliente: num(n.taxaCliente),
        taxaProfissional: num(n.taxaProfissional),
        taxasComFacturaJson: (n.taxasComFacturaJson as string) ?? null,
        base: lerBase(n.baseDoPreco),
        valorFixoClyon: num(n.valorFixoClyon),
        precoClienteClyon: num(n.precoClienteClyon),
        valorAcordado: num(n.valorAcordado),
      },
      conta: null,
      referenciasCanceladas,
    });
    await conn.execute(
      `UPDATE negociacoes
          SET clientePagaAClyonEm = NULL, clientePagaAClyonPor = NULL, clientePagaAClyonMotivo = NULL,
              clientePagaAClyonHistoricoJson = ?
        WHERE id = ?`,
      [JSON.stringify(historico), pedido.negociacaoId],
    );

    if (pedido.previsualizar) await conn.rollback();
    else await conn.commit();
    return {
      ok: true,
      pedidoId,
      providerId: Number(n.providerId),
      referenciasCanceladas: pedido.previsualizar
        ? pagamentos
            .filter((p) => p.estado === "pendente" && eDoCliente(p))
            .map((p) => ({ pagamentoId: Number(p.id), metodo: String(p.metodo ?? ""), valor: Number(p.valor ?? 0) }))
        : referenciasCanceladas,
      gravado: !pedido.previsualizar,
    };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** O que o diálogo precisa antes de abrir: a base, o valor e se já passou. */
export async function oQueODialogoPrecisa(negociacaoId: number): Promise<{
  base: "total" | "carga" | "hora";
  valor: number | null;
  taxa: number | null;
  passadoEm: unknown;
} | null> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return null;
  const [linhas] = (await pool.execute(
    `SELECT n.valorAcordado, n.clientePagaAClyonEm, o.valorFixoClyon, o.taxaClyon, o.baseDoPreco
       FROM negociacoes n JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.id = ? LIMIT 1`,
    [negociacaoId],
  )) as [Linha[], unknown];
  const l = linhas[0];
  if (!l) return null;
  return {
    base: lerBase(l.baseDoPreco),
    valor: num(l.valorFixoClyon) ?? num(l.valorAcordado),
    taxa: num(l.taxaClyon),
    passadoEm: l.clientePagaAClyonEm ?? null,
  };
}
