import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import { dividaDoRegistoEmMao } from "./pago-em-mao";

/**
 * QUEM FOI APANHADO PELO «PAGO EM MÃO» QUE A CARTEIRA NÃO LIA — 01-11-2026.
 *
 * Até esta data, um trabalho da plataforma registado nos Pagamentos como «o
 * cliente pagou ao profissional, em mão» aparecia na carteira dele em «Por
 * receber — pode pedir a transferência» (ver `pago-em-mao.ts`). A correcção
 * pô-los no sítio certo; esta lista é para o dono ver QUANTOS eram e se algum
 * já foi pago duas vezes — ou está prestes a ser:
 *
 *   · PEDIDO ABERTO — o profissional tem um pedido de transferência por
 *     tratar. Pode ter sido pedido com o valor destes trabalhos lá dentro:
 *     conferir ANTES de o pagar;
 *   · PAGO UM A UM — a CLYON marcou este trabalho como pago ao profissional
 *     (`pagoEm`): pagou-lhe o que ele já tinha recebido do cliente;
 *   · TRANSFERÊNCIA DEPOIS — houve uma transferência paga depois do registo:
 *     pode ter levado este valor. Conferir.
 *
 * Só lê. Pura: a rota (`/api/admin/pagamentos/pagos-em-mao`) traz as linhas.
 */

export type LinhaPagoEmMao = {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  profissional: string | null;
  valorAcordado: unknown;
  taxaCliente?: unknown;
  taxaProfissional?: unknown;
  /** O que ficou registado que o cliente pagou ao profissional. */
  valorQueEntrou: unknown;
  /** Quando foi registado. */
  registadoEm: Date | string | null;
  /** A CLYON marcou este trabalho como pago ao profissional (um a um). */
  pagoEm: Date | string | null;
};

export type LevantamentoParaConferir = {
  id: number;
  providerId: number;
  valor: unknown;
  estado: string;
  createdAt: Date | string | null;
  processadoEm: Date | string | null;
};

export type TrabalhoAfectado = {
  negociacaoId: number;
  pedidoId: number;
  /** O líquido dele — o que a carteira mostrava em «Por receber». */
  recebe: number;
  /** O que deve à CLYON por este trabalho (a taxa, e o IVA se o recebeu). */
  deve: number;
  registadoEm: string | null;
  pagoUmAUm: boolean;
};

export type ProfissionalAfectado = {
  providerId: number;
  profissional: string | null;
  trabalhos: TrabalhoAfectado[];
  /** A soma do que a carteira mostrava a mais em «Por receber». */
  mostradoAMais: number;
  deve: number;
  pedidosAbertos: Array<{ id: number; valor: number; em: string | null }>;
  transferenciasDepois: Array<{ id: number; valor: number; em: string | null }>;
  /** O pior dos alertas, para ordenar e pintar. */
  alerta: "pedido_aberto" | "pago_um_a_um" | "transferencia_depois" | null;
};

const c = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const iso = (v: Date | string | null | undefined): string | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const ORDEM = { pedido_aberto: 0, pago_um_a_um: 1, transferencia_depois: 2 } as const;

export function afectadosPeloPagoEmMao(
  linhas: LinhaPagoEmMao[],
  levantamentos: LevantamentoParaConferir[],
): ProfissionalAfectado[] {
  const porPro = new Map<number, ProfissionalAfectado>();
  for (const l of linhas) {
    const acordado = Number(l.valorAcordado);
    if (!Number.isFinite(acordado)) continue;
    const taxas = taxasDaNegociacao(l);
    const recebe = quantoOProfissionalRecebe(acordado, taxas);
    const deve = dividaDoRegistoEmMao(acordado, taxas, Number(l.valorQueEntrou)).total;
    if (!porPro.has(l.providerId)) {
      porPro.set(l.providerId, {
        providerId: l.providerId,
        profissional: l.profissional,
        trabalhos: [],
        mostradoAMais: 0,
        deve: 0,
        pedidosAbertos: [],
        transferenciasDepois: [],
        alerta: null,
      });
    }
    const p = porPro.get(l.providerId)!;
    p.trabalhos.push({
      negociacaoId: l.negociacaoId,
      pedidoId: l.pedidoId,
      recebe,
      deve,
      registadoEm: iso(l.registadoEm),
      pagoUmAUm: l.pagoEm != null && l.pagoEm !== "",
    });
    p.mostradoAMais = c(p.mostradoAMais + recebe);
    p.deve = c(p.deve + deve);
  }

  for (const p of porPro.values()) {
    const primeiro = p.trabalhos
      .map((t) => t.registadoEm)
      .filter((x): x is string => x != null)
      .sort()[0];
    for (const v of levantamentos) {
      if (v.providerId !== p.providerId) continue;
      const valor = c(Number(v.valor));
      if (v.estado === "pedido") {
        p.pedidosAbertos.push({ id: v.id, valor, em: iso(v.createdAt) });
      } else if (v.estado === "pago") {
        const em = iso(v.processadoEm) ?? iso(v.createdAt);
        if (primeiro && em && em >= primeiro) p.transferenciasDepois.push({ id: v.id, valor, em });
      }
    }
    p.trabalhos.sort((a, b) => b.pedidoId - a.pedidoId);
    p.alerta =
      p.pedidosAbertos.length > 0
        ? "pedido_aberto"
        : p.trabalhos.some((t) => t.pagoUmAUm)
          ? "pago_um_a_um"
          : p.transferenciasDepois.length > 0
            ? "transferencia_depois"
            : null;
  }

  return [...porPro.values()].sort(
    (a, b) =>
      (a.alerta ? ORDEM[a.alerta] : 9) - (b.alerta ? ORDEM[b.alerta] : 9) || b.mostradoAMais - a.mostradoAMais,
  );
}
