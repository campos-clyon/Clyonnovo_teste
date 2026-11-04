import { lerForma } from "./forma-de-pagamento";
import { contaDaLinha, emEuros, type ContaDoPagamento, type LinhaDaNegociacao } from "./conta-do-pagamento";
import { taxasDaNegociacao, type Taxas } from "./taxas-plataforma";
import { eSemFactura, taxasSemFactura } from "./sem-factura";
import { lerParaQue, type ParaQue } from "./pagamento-declarado";
import { RECEBIMENTOS_A_MAO, nomeDoRecebimento, type ComoEntrou } from "./dinheiro-do-trabalho";
import { dividaDoRegistoEmMao, pagoAoProfissionalRegistado, type DividaDoRegistoEmMao } from "./pago-em-mao";

/**
 * CORRIGIR UM PAGAMENTO JÁ REGISTADO — 04-11-2026 (d9, dono).
 *
 * *«Hoje o botão da factura fica bloqueado depois de registado o pagamento.
 * Só o administrador pode corrigir, com um motivo obrigatório (como no "sem
 * factura"): a factura (com ou sem); o valor que o cliente pagou ao
 * profissional. Fica no histórico quem corrigiu, quando, o antes, o depois e
 * o motivo. A conta em degraus volta a fazer-se com os valores novos.»*
 *
 * Um registo à mão (transferência, numerário, ou «pago ao profissional» em
 * mão) é uma pessoa a dizer o que aconteceu, e às vezes disse mal: um
 * trabalho registado «sem fatura» a um valor sem IVA quando o cliente pagou
 * com IVA, ou declarado com fatura e marcado sem. Aqui corrige-se, de uma vez:
 *
 *   · A FATURA — a marca (`semFactura`) e a declaração (`pagamentoParaQue`)
 *     passam a dizer o mesmo, que era o que estava contraditório. As regras
 *     são as de `sem-factura.ts`: sem fatura as taxas juntam-se (se ainda não
 *     estão); com fatura só muda o IVA;
 *   · O VALOR que ficou registado na linha do pagamento.
 *
 * O que o euPago confirmou não se corrige aqui: é o que o banco diz. Em
 * dinheiro (combinado assim) a linha é a dívida do profissional, que tem a sua
 * conta. Puro: a escrita é `corrigir-pagamento-na-base.ts`.
 */

/** Os métodos que se corrigem: os registados à mão pelo cliente. */
export const CORRIGEM_SE: ReadonlyArray<ComoEntrou> = RECEBIMENTOS_A_MAO;

export const MOTIVO_DA_CORRECCAO_MINIMO = 5;
export const MOTIVO_DA_CORRECCAO_MAXIMO = 300;
export const PEDE_O_MOTIVO_DA_CORRECCAO = "Escreva o motivo da correção — sem ele, não se grava.";
/** O tecto do valor, contra um zero a mais. */
export const VALOR_MAXIMO_DA_CORRECCAO = 50_000;

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type PedidoDeCorreccao = { semFactura: boolean; valor: number; motivo: string };

/** O que o ecrã mandou, lido e validado. */
export function lerCorreccaoDoPagamento(
  corpo: unknown,
): { ok: true; pedido: PedidoDeCorreccao } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  if (typeof c.semFactura !== "boolean") return { ok: false, erro: "Diga se foi com ou sem fatura." };
  const cru = typeof c.valor === "string" ? c.valor.replace(/\s|€/g, "").replace(",", ".") : c.valor;
  const valor = typeof cru === "number" ? cru : typeof cru === "string" && cru !== "" ? Number(cru) : NaN;
  if (!Number.isFinite(valor) || valor <= 0 || valor > VALOR_MAXIMO_DA_CORRECCAO) {
    return { ok: false, erro: "Escreva o valor que o cliente pagou, em euros." };
  }
  const motivo = typeof c.motivo === "string" ? c.motivo.replace(/\s+/g, " ").trim() : "";
  if (motivo.length < MOTIVO_DA_CORRECCAO_MINIMO) return { ok: false, erro: PEDE_O_MOTIVO_DA_CORRECCAO };
  return {
    ok: true,
    pedido: { semFactura: c.semFactura, valor: aosCentimos(valor), motivo: motivo.slice(0, MOTIVO_DA_CORRECCAO_MAXIMO) },
  };
}

/** A negociação e o pagamento que a fecha, como estão na base. */
export type PagamentoRegistado = {
  linha: LinhaDaNegociacao & { motivoSemFactura?: unknown };
  /** O método da linha que fecha a negociação (`negociacaoPaga`). */
  metodo: string;
  /** O que ficou registado (`valorPago`, ou `valor`). */
  valor: number;
  /** A CLYON já transferiu ao profissional (`negociacoes.pagoEm`). */
  pagoAoProfissionalEm: unknown;
  /** A linha à parte que fechou a dívida de um pago em mão, se existe (o seu valor). */
  dividaFechadaCom?: number | null;
};

/** Um retrato do dinheiro do trabalho — antes ou depois da correcção. */
export type RetratoDoPagamento = {
  semFactura: boolean;
  /** O que a declaração diz (`pagamentoParaQue`); nulo quando não houve. */
  declarado: ParaQue | null;
  valor: number;
  taxas: Taxas;
  conta: ContaDoPagamento | null;
  /** Num pago em mão: o que o profissional deve à CLYON (`dividaDoRegistoEmMao`). */
  dividaEmMao: DividaDoRegistoEmMao | null;
};

export type PorqueNaoSeCorrige = "nao_registado_a_mao" | "em_dinheiro" | "nada_muda" | "pro_ja_pago";

export const PORQUE_NAO_SE_CORRIGE: Record<PorqueNaoSeCorrige, string> = {
  nao_registado_a_mao:
    "Só se corrige um pagamento registado à mão (transferência, numerário ou pago ao profissional) — o que o euPago confirmou é o que o banco diz.",
  em_dinheiro: "Combinado em dinheiro, a linha é a dívida do profissional — tem a sua conta e não se corrige aqui.",
  nada_muda: "Já está assim — nada a corrigir.",
  pro_ja_pago:
    "Já se pagou ao profissional, e sem fatura as taxas juntam-se — ele receberia outro valor. Corrija primeiro o valor do trabalho.",
};

export type PlanoDaCorreccao =
  | {
      ok: true;
      antes: RetratoDoPagamento;
      depois: RetratoDoPagamento;
      muda: { factura: boolean; valor: boolean };
      /** As taxas juntaram-se agora (passou a sem fatura com a taxa do cliente acima de zero). */
      juntaAsTaxas: boolean;
      /** Num pago em mão com a dívida já fechada: com quanto se fechou (a diferença não se acerta sozinha). */
      dividaFechadaCom: number | null;
    }
  | { ok: false; porque: PorqueNaoSeCorrige };

/** A linha como fica com esta fatura e estas taxas. */
function linhaCom(
  linha: PagamentoRegistado["linha"],
  semFactura: boolean,
  declarado: ParaQue | null,
  taxas: Taxas,
): PagamentoRegistado["linha"] {
  return {
    ...linha,
    semFactura: semFactura ? 1 : 0,
    pagamentoParaQue: declarado,
    taxaCliente: taxas.cliente,
    taxaProfissional: taxas.profissional,
  };
}

function retrato(
  linha: PagamentoRegistado["linha"],
  metodo: string,
  valor: number,
): RetratoDoPagamento {
  const taxas = taxasDaNegociacao(linha);
  const acordado = Number(linha.valorAcordado);
  return {
    semFactura: eSemFactura(linha),
    declarado: lerParaQue(linha.pagamentoParaQue),
    valor: aosCentimos(valor),
    taxas,
    // O pagamento está registado: a conta diz «recebido».
    conta: contaDaLinha(linha, true),
    dividaEmMao:
      pagoAoProfissionalRegistado(linha.formaDePagamento, metodo) && Number.isFinite(acordado)
        ? dividaDoRegistoEmMao(acordado, taxas, valor)
        : null,
  };
}

/**
 * O PLANO: o antes, o depois e o que muda — sem tocar na base.
 *
 * O depois faz a conta em degraus com os valores novos (`contaDaLinha`) e, num
 * pago em mão, o que o profissional fica a dever (`dividaDoRegistoEmMao`).
 */
export function planoDaCorreccao(actual: PagamentoRegistado, pedido: PedidoDeCorreccao): PlanoDaCorreccao {
  if (lerForma(actual.linha.formaDePagamento as string | null) === "dinheiro") return { ok: false, porque: "em_dinheiro" };
  if (!CORRIGEM_SE.includes(String(actual.metodo ?? "").trim() as ComoEntrou)) {
    return { ok: false, porque: "nao_registado_a_mao" };
  }

  const antes = retrato(actual.linha, actual.metodo, actual.valor);
  const declaradoDepois: ParaQue = pedido.semFactura ? "sem_factura" : "com_factura";
  // Sem fatura as taxas juntam-se (se ainda não estão); com fatura ficam como estão (22-10-2026).
  const taxasDepois = pedido.semFactura ? taxasSemFactura(antes.taxas) : antes.taxas;
  const juntaAsTaxas =
    taxasDepois.cliente !== antes.taxas.cliente || taxasDepois.profissional !== antes.taxas.profissional;
  const muda = {
    factura: antes.semFactura !== pedido.semFactura || (antes.declarado != null && antes.declarado !== declaradoDepois),
    valor: Math.abs(antes.valor - pedido.valor) > 0.005,
  };
  if (!muda.factura && !muda.valor) return { ok: false, porque: "nada_muda" };

  const emMao = pagoAoProfissionalRegistado(actual.linha.formaDePagamento, actual.metodo);
  // A CLYON já lhe transferiu, e ele passava a receber outro valor: não aqui.
  if (!emMao && juntaAsTaxas && actual.pagoAoProfissionalEm != null) return { ok: false, porque: "pro_ja_pago" };

  const depois = retrato(
    linhaCom(actual.linha, pedido.semFactura, declaradoDepois, taxasDepois),
    actual.metodo,
    pedido.valor,
  );
  return {
    ok: true,
    antes,
    depois,
    muda,
    juntaAsTaxas,
    dividaFechadaCom:
      emMao && actual.dividaFechadaCom != null && Number.isFinite(actual.dividaFechadaCom)
        ? aosCentimos(actual.dividaFechadaCom)
        : null,
  };
}

/**
 * OS DOIS VALORES DE REFERÊNCIA para o ecrã — o que a conta dá com fatura e
 * sem fatura, para quem corrige escrever o que o cliente pagou de facto.
 */
export function valoresDeReferencia(linha: PagamentoRegistado["linha"]): { comFactura: number | null; semFactura: number | null } {
  const taxas = taxasDaNegociacao(linha);
  const com = contaDaLinha(linhaCom(linha, false, "com_factura", taxas), true);
  const sem = contaDaLinha(linhaCom(linha, true, "sem_factura", taxasSemFactura(taxas)), true);
  return { comFactura: com ? com.total : null, semFactura: sem ? sem.total : null };
}

const factura = (semFactura: boolean) => (semFactura ? "sem fatura" : "com fatura");

/** O que a conta diz, numa frase — para o histórico e para o ecrã. */
function fraseDaConta(r: RetratoDoPagamento): string {
  if (!r.conta) return "";
  const taxa = r.conta.clyon;
  if (r.dividaEmMao) {
    return (
      `IVA ${emEuros(r.dividaEmMao.iva)}, taxa da plataforma ${emEuros(r.dividaEmMao.comissao)}; ` +
      `o profissional fica com ${emEuros(r.dividaEmMao.liquido)} e deve à CLYON ${emEuros(r.dividaEmMao.total)}`
    );
  }
  return `IVA ${emEuros(r.conta.iva)}, taxa da plataforma ${emEuros(taxa)}; o profissional recebe ${emEuros(r.conta.profissional)}`;
}

/**
 * A FRASE DO HISTÓRICO — quem, o antes, o depois e o motivo, e a conta nova.
 * (O quando é a hora da entrada no histórico.)
 */
export function fraseDaCorreccao(
  plano: Extract<PlanoDaCorreccao, { ok: true }>,
  d: { quem: string; motivo: string; metodo: string },
): string {
  const { antes, depois } = plano;
  const partes: string[] = [];
  if (plano.muda.factura) {
    const deAntes =
      antes.declarado != null && (antes.declarado === "sem_factura") !== antes.semFactura
        ? `${factura(antes.semFactura)} (declarado ${antes.declarado === "sem_factura" ? "sem" : "com"} fatura)`
        : factura(antes.semFactura);
    partes.push(`fatura: ${deAntes} → ${factura(depois.semFactura)}`);
  }
  if (plano.muda.valor) {
    const quemPagou = d.metodo === "ao_profissional" ? "o cliente pagou ao profissional" : "o cliente pagou";
    partes.push(`${quemPagou} ${emEuros(antes.valor)} → ${emEuros(depois.valor)}`);
  }
  let frase =
    `Pagamento registado corrigido por ${d.quem} (${nomeDoRecebimento(d.metodo)}): ${partes.join("; ")}. ` +
    `Motivo: «${d.motivo}». A conta passa a: ${fraseDaConta(depois)} (antes: ${fraseDaConta(antes)}).`;
  if (plano.juntaAsTaxas) frase += " Sem fatura, as taxas da CLYON juntaram-se e saem do valor.";
  if (plano.dividaFechadaCom != null && depois.dividaEmMao) {
    const dif = aosCentimos(depois.dividaEmMao.total - plano.dividaFechadaCom);
    if (Math.abs(dif) > 0.005) {
      frase +=
        ` A parte da CLYON já estava fechada com ${emEuros(plano.dividaFechadaCom)}: ` +
        `${dif > 0 ? "faltam" : "sobram"} ${emEuros(Math.abs(dif))}, que não se acertam sozinhos.`;
    }
  }
  return frase;
}
