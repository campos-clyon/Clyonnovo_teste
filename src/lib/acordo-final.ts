import type { ContaDoPagamento, Degrau } from "./conta-do-pagamento";

// Os mesmos de `conta-do-pagamento.ts`, aqui para não haver import circular (ela lê este ficheiro).
const aosCentimos = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const emEuros = (v: number): string => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2).replace(".", ",")} €`;

/**
 * O ACORDO FINAL COM O CLIENTE — d78 (CEO e dono, 20-11-2026).
 *
 * Um trabalho já pago ao profissional em que, depois de uma disputa, se
 * combinou com o cliente um valor final ABAIXO do que o profissional recebeu.
 * A CLYON não cobra taxa e suporta a diferença: o profissional fica com o que
 * já lhe foi transferido (nada a dever, nada a cobrar-lhe) e o cliente paga o
 * valor do acordo, sem fatura.
 *
 * Gravado na negociação (`acordoFinalCliente`, `acordoFinalMotivo`) por uma só
 * rota do administrador, com motivo obrigatório
 * (`/api/admin/pagamentos/acordo-final`). Lido em quatro sítios, e só neles:
 *
 *   · a conta em degraus (`contaDaLinha`) — Pagamentos e Finanças: o cliente
 *     paga o acordo, o profissional o mesmo de antes, e a parte da CLYON é
 *     negativa (o resultado do pedido);
 *   · o «Enviar o valor final ao cliente» e o «Gerar referência» pedem o valor
 *     do acordo, sem IVA;
 *   · o cliente não gera referência pelo link: paga a que a CLYON lhe envia.
 *
 * A carteira do profissional não o lê: o que ele recebe continua a ser o valor
 * acordado menos a taxa (zero), que é o que se lhe transferiu.
 *
 * Puro; a escrita está em `acordo-final-na-base.ts`.
 */

/** O motivo que a rota pede — curto, mas dito. */
export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 300;

/** O valor do acordo gravado na linha, ou nulo (sem acordo, ou um valor que não serve). */
export function lerAcordoFinal(l: { acordoFinalCliente?: unknown } | null | undefined): number | null {
  const v = l?.acordoFinalCliente;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? aosCentimos(n) : null;
}

/**
 * A CONTA COM O ACORDO. O cliente paga `acordo` (sem fatura, sem IVA); o
 * profissional fica com o que a conta já lhe dava; as taxas mantêm-se e a
 * diferença é a CLYON que a suporta — um degrau «mais» que faz a conta fechar
 * ao cêntimo. A parte da CLYON (`clyon`) fica negativa: é o resultado do pedido.
 *
 * Um acordo igual ou acima do que a conta já pedia não muda nada (a rota recusa-o).
 */
export function comAcordoFinal(conta: ContaDoPagamento, acordo: number, motivo?: string | null): ContaDoPagamento {
  const total = aosCentimos(acordo);
  const taxas = aosCentimos(conta.taxas.reduce((s, t) => s + t.valor, 0));
  const suporta = aosCentimos(conta.profissional + taxas - total);
  if (!(total > 0) || !(suporta > 0)) return conta;
  const inicio = conta.degraus[0];
  const final = conta.degraus[conta.degraus.length - 1];
  const nota = String(motivo ?? "").trim();
  const degraus: Degrau[] = [
    {
      tipo: "inicio",
      rotulo: inicio?.rotulo ?? "O cliente paga",
      valor: total,
      nota: "acordo final com o cliente — sem fatura, sem IVA",
    },
    { tipo: "menos", rotulo: "IVA", valor: 0, nota: "sem fatura — o cliente paga o valor sem IVA" },
    { tipo: "igual", rotulo: "Valor sem IVA", valor: total },
    ...conta.taxas.map((t): Degrau => ({ tipo: "menos", rotulo: t.rotulo, percentagem: t.percentagem, valor: t.valor })),
    {
      tipo: "mais",
      rotulo: "A CLYON suporta",
      valor: suporta,
      nota: `acordo final abaixo do que já se transferiu${nota ? `: ${nota}` : ""}`,
    },
    {
      tipo: "igual",
      rotulo: final?.rotulo ?? "A pagar",
      valor: conta.profissional,
      final: true,
    },
  ];
  return {
    total,
    iva: 0,
    semIva: total,
    taxas: [...conta.taxas, { rotulo: "A CLYON suporta (acordo final)", percentagem: null, valor: -suporta }],
    clyon: aosCentimos(taxas - suporta),
    profissional: conta.profissional,
    degraus,
    notas: [
      ...conta.notas,
      `Acordo final com o cliente: paga ${emEuros(total)} sem fatura; o profissional fica com ${emEuros(conta.profissional)}, e a CLYON fica com ${emEuros(aosCentimos(taxas - suporta))}.`,
    ],
  };
}

/** O que a rota recebe, já conferido. */
export type PedidoDeAcordoFinal = { negociacaoId: number; valor: number; motivo: string; anularPagoEmMao: boolean };

export function lerPedidoDeAcordoFinal(
  corpo: Record<string, unknown>,
): { ok: true; pedido: PedidoDeAcordoFinal } | { ok: false; erro: string } {
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) return { ok: false, erro: "Trabalho não indicado." };
  const valor = typeof corpo.valor === "number" ? corpo.valor : Number(String(corpo.valor ?? "").replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: "Diga o valor do acordo final (sem IVA)." };
  const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim().slice(0, MOTIVO_MAXIMO) : "";
  if (motivo.length < MOTIVO_MINIMO) return { ok: false, erro: "Diga o motivo do acordo final — é obrigatório." };
  return { ok: true, pedido: { negociacaoId, valor: aosCentimos(valor), motivo, anularPagoEmMao: corpo.anularPagoEmMao === true } };
}

/** O estado do trabalho que a regra precisa — lido da base. */
export type TrabalhoParaOAcordo = {
  estado: string;
  formaDePagamento: string | null;
  semFactura: boolean;
  novoModelo: boolean;
  /** A CLYON já pagou ao profissional (`negociacoes.pagoEm`). */
  pagoAoProfissional: boolean;
  /** O que o profissional recebe com a taxa a zero — o que se lhe transferiu. */
  profissionalRecebeSemTaxa: number;
  /** O pagamento do cliente dado por pago, se há (método). */
  pagoDoCliente: { id: number; metodo: string } | null;
  /** Partes da dívida do profissional já pagas à parte (cobrancasAoProfissional). */
  partesPagas: number;
  /** A dívida dele já fechada por uma linha (referência paga, abatimento, quitação). */
  dividaFechada: boolean;
};

export const PORQUE_NAO_HA_ACORDO = {
  nao_fechado: "Este trabalho ainda não está fechado.",
  dinheiro: "Em dinheiro o cliente paga ao profissional no local — aqui não há acordo final da CLYON.",
  novo_modelo: "No modelo de 15-11 o cliente paga ao parceiro diretamente — o acordo não passa pela CLYON.",
  com_fatura: "O acordo final é sem fatura: marque primeiro o trabalho «Sem fatura».",
  nao_pago_ao_profissional: "A CLYON ainda não pagou ao profissional — o valor corrige-se pelo caminho de sempre.",
  nao_abaixo: "O acordo final tem de ficar abaixo do que se pagou ao profissional — senão corrige-se o valor.",
  cliente_pagou: "O cliente já tem um pagamento dado por pago — corrija-o primeiro nos Pagamentos.",
  em_mao_sem_anular: "Há um registo «o cliente pagou ao profissional, em mão»: confirme que é para o anular.",
  divida_paga: "Parte da dívida do profissional já foi paga ou fechada — isso corrige-se à parte primeiro.",
} as const;

export type PorqueNaoHaAcordo = keyof typeof PORQUE_NAO_HA_ACORDO;

/** Pode gravar-se este acordo? A regra inteira, sem base. */
export function porqueNaoHaAcordo(t: TrabalhoParaOAcordo, p: PedidoDeAcordoFinal): PorqueNaoHaAcordo | null {
  if (t.estado !== "acordada") return "nao_fechado";
  if (String(t.formaDePagamento ?? "") === "dinheiro") return "dinheiro";
  if (t.novoModelo) return "novo_modelo";
  if (!t.semFactura) return "com_fatura";
  if (!t.pagoAoProfissional) return "nao_pago_ao_profissional";
  if (!(p.valor < t.profissionalRecebeSemTaxa - 0.005)) return "nao_abaixo";
  if (t.pagoDoCliente) {
    if (t.pagoDoCliente.metodo !== "ao_profissional") return "cliente_pagou";
    if (!p.anularPagoEmMao) return "em_mao_sem_anular";
  }
  if (t.partesPagas > 0 || t.dividaFechada) return "divida_paga";
  return null;
}

/** A frase do histórico do pedido — o antes e o depois, e o motivo. */
export function fraseDoAcordoFinal(d: {
  quem: string;
  motivo: string;
  valor: number;
  profissional: string;
  pagoAoProfissional: number;
  pagoAoProfissionalEm: string | null;
  antes: { clientePaga: number; taxa: number | null; profissionalRecebia: number };
  anulouEmMao: number | null;
  referenciasAnuladas: number;
}): string {
  const partes = [
    `Acordo final com o cliente, por ${d.quem}: o cliente paga ${emEuros(d.valor)} (sem fatura) — era ${emEuros(d.antes.clientePaga)}.`,
    `A CLYON pagou a ${d.profissional} ${emEuros(d.pagoAoProfissional)} (transferência)${d.pagoAoProfissionalEm ? `, a ${d.pagoAoProfissionalEm}` : ""} — o registo dizia ${emEuros(d.antes.profissionalRecebia)}.`,
    `Taxa da plataforma: ${d.antes.taxa != null ? `${Math.round(d.antes.taxa * 1000) / 10} %` : "a de antes"} → 0 %.`,
    `A CLYON fica com ${emEuros(aosCentimos(d.valor - d.pagoAoProfissional))} neste pedido.`,
  ];
  if (d.anulouEmMao != null) {
    partes.push(`Anulado o registo «o cliente pagou ao profissional, em mão» de ${emEuros(d.anulouEmMao)}: o cliente ainda não pagou.`);
  }
  if (d.referenciasAnuladas > 0) {
    partes.push(
      `${d.referenciasAnuladas === 1 ? "Anulada a referência" : `Anuladas ${d.referenciasAnuladas} referências`} da dívida do profissional: ele não deve nada à CLYON por este pedido.`,
    );
  }
  partes.push(`Motivo: «${d.motivo}».`);
  return partes.join(" ");
}
