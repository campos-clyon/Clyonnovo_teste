import { contaDoValorAcordado, MAXIMO_DO_PAGAMENTO_DIRECTO_CENT, type RegimeDoProfissional } from "./pagamento-directo";
import { perfilFiscalDoParceiro, type ProfissionalParaOPerfil } from "./perfil-fiscal";
import { taxasDaNegociacao, type Taxas } from "./taxas-plataforma";
import { baseDoPrecoDoCliente, precoParaOCliente, type PrecoDoCliente } from "./preco-do-cliente";
import type { ModeloDoPreco } from "./iva-incluido";

/**
 * O TOTAL QUE O CLIENTE PAGA NO MODELO DE 15-11-2026 — uma conta só (d17, CEO e
 * dono, 13-11-2026).
 *
 * O cliente via números diferentes para o mesmo trabalho: o cartão da proposta
 * fazia a conta antiga (valor × 1,23), o bloco «Pagar a …» a do modelo novo, e
 * com um parceiro isento de IVA os dois afastavam-se (430,50 € contra 358,05 €
 * em 350 € a 10 %). Agora o cartão, a página do pedido, o email da proposta, a
 * adjudicação da Mesa e a app de cliente (R5) dizem o número que sai DAQUI:
 *
 *   · `totalAoCliente(valor, taxas, regime)` — a conta em degraus de
 *     `pagamento-directo.ts` (duas faturas, o IVA por fatura), em euros;
 *   · `regimeDaNegociacao(linha)` — o regime congelado ao contratar manda;
 *     antes disso, o confirmado no perfil; sem confirmação, como com IVA
 *     (`perfil-fiscal.ts`);
 *   · `totalAoClienteDaNegociacao(linha, valor)` — as duas juntas, com as
 *     taxas gravadas na negociação. É ESTA que a Vitória (I&D) deve ler.
 *
 * Quem decide SE a negociação segue o modelo novo é o servidor
 * (`segueONovoModelo`, com os pagamentos lidos); isto só faz a conta.
 *
 * Pura e sem base: o servidor, os ecrãs e a app importam isto.
 */

export type TotalAoCliente = {
  /** O que o cliente paga ao parceiro, com IVA (as duas faturas). */
  total: number;
  /** O mesmo sem IVA: a base do parceiro e a taxa da plataforma. */
  semIva: number;
  /** O IVA dentro do total (o do parceiro, se tiver, e o da taxa). */
  iva: number;
  /** A fatura do trabalho, emitida pelo parceiro. */
  faturaDoParceiro: number;
  ivaDoParceiro: number;
  /** A fatura da taxa da plataforma (a taxa e o IVA dela). */
  faturaDaTaxa: number;
  ivaDaTaxa: number;
  regime: RegimeDoProfissional;
};

export function totalAoCliente(
  valor: number | null | undefined,
  taxas: Taxas,
  regime: RegimeDoProfissional,
): TotalAoCliente | null {
  const c = contaDoValorAcordado(valor, taxas, regime);
  if (!c) return null;
  const semIvaCent = c.baseDoProfissionalCent + c.taxaCent;
  return {
    total: c.totalAoClienteCent / 100,
    semIva: semIvaCent / 100,
    iva: (c.totalAoClienteCent - semIvaCent) / 100,
    faturaDoParceiro: c.faturaDoProfissionalCent / 100,
    ivaDoParceiro: c.ivaDoProfissionalCent / 100,
    faturaDaTaxa: c.faturaDaClyonCent / 100,
    ivaDaTaxa: c.ivaDaTaxaCent / 100,
    regime: c.regime,
  };
}

/** O que a conta lê de uma negociação (com o perfil do parceiro junto, como vem da base). */
export type LinhaParaOTotal = ProfissionalParaOPerfil & {
  taxaCliente?: unknown;
  taxaProfissional?: unknown;
  /** O regime congelado quando foi contratada (`negociacoes.regimeDoProfissional`). */
  regimeDoProfissional?: unknown;
};

/** O regime com que se faz a conta desta negociação: o congelado, ou o do perfil. */
export function regimeDaNegociacao(linha: LinhaParaOTotal): RegimeDoProfissional {
  const c = linha.regimeDoProfissional;
  if (c === "normal" || c === "isento") return c;
  return perfilFiscalDoParceiro(linha).regimeParaAConta;
}

/** O total do modelo novo de uma negociação, pelo valor dado (o acordado, ou uma proposta). */
export function totalAoClienteDaNegociacao(
  linha: LinhaParaOTotal,
  valor: number | null | undefined,
): TotalAoCliente | null {
  return totalAoCliente(valor, taxasDaNegociacao(linha), regimeDaNegociacao(linha));
}

/**
 * OS TOTAIS DE CADA VALOR DE UMA NEGOCIAÇÃO — o acordado, cada proposta, cada
 * ajuste. Calculam-se no servidor, onde estão as taxas, e viajam só como
 * preços do cliente (a taxa do parceiro nunca sai).
 */
export type TotaisDoNovoModelo = Record<string, TotalAoCliente>;

export function chaveDoValor(v: number): string {
  return v.toFixed(2);
}

export function totaisDoNovoModelo(linha: LinhaParaOTotal, valores: ReadonlyArray<unknown>): TotaisDoNovoModelo {
  const totais: TotaisDoNovoModelo = {};
  for (const v of valores) {
    const n = typeof v === "number" ? v : v == null || v === "" ? NaN : Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    const chave = chaveDoValor(n);
    if (totais[chave]) continue;
    const t = totalAoClienteDaNegociacao(linha, n);
    if (t) totais[chave] = t;
  }
  return totais;
}

/** O total de um valor, dos totais já feitos — ou `null`. */
export function totalDoValor(totais: TotaisDoNovoModelo | null | undefined, valor: number | null | undefined): TotalAoCliente | null {
  if (!totais || valor == null || !Number.isFinite(valor)) return null;
  return totais[chaveDoValor(valor)] ?? null;
}

/**
 * O total na forma do preço do cliente (`preco-do-cliente.ts`), para os textos
 * de sempre («X com IVA», «Y + Z de IVA») mostrarem o número do modelo novo.
 */
export function precoDoNovoModelo(t: TotalAoCliente): PrecoDoCliente {
  return {
    servico: t.faturaDoParceiro - t.ivaDoParceiro,
    taxa: t.faturaDaTaxa - t.ivaDaTaxa,
    acrescimo: 0,
    iva: t.iva,
    ivaDaTaxa: t.ivaDaTaxa,
    semIva: t.semIva,
    total: t.total,
    temIva: t.iva > 0,
    ivaIncluido: true,
    aPagar: t.total,
  };
}

/*
 * ── A CONTA INVERSA — o preço que o cliente ESCREVE (d17, 13-11-2026) ───────
 *
 * «Posso pagar 358» é um total: o que lhe sai do bolso, com as duas faturas.
 * No modelo de 15-11 esse total depende do regime do parceiro, por isso a volta
 * para o valor do parceiro (sem IVA, o que se grava nas propostas) faz-se pela
 * MESMA conta de `totalAoCliente`, e não pela antiga (`baseDoPrecoDoCliente`,
 * valor × taxa × 1,23), que com um parceiro isento dava um valor ~18 % abaixo.
 *
 * A REGRA DO ARREDONDAMENTO É A DE SEMPRE: fica o de baixo. O total sobe aos
 * saltos de 1 ou 2 cêntimos por cêntimo do parceiro (o IVA arredonda por
 * fatura; até 4 com taxa do cliente), e há totais a que nenhum valor chega. Escolhe-se o maior valor cujo
 * total não passa do escrito: `total(valorDoTotalAoCliente(x)) = x` quando x é
 * alcançável, e até 3 cêntimos abaixo quando não é (como na conta antiga) — o cliente nunca
 * passa a pagar mais do que escreveu, e quem chama mostra-lhe o que ficou.
 *
 * `null` para um preço que não é preço nenhum (zero, negativo, lixo, acima
 * do total de `MAXIMO_DO_PAGAMENTO_DIRECTO_CENT`) ou abaixo do total de 1 cêntimo.
 */
export function valorDoTotalAoCliente(
  total: number | null | undefined,
  taxas: Taxas,
  regime: RegimeDoProfissional,
): number | null {
  if (total == null || !Number.isFinite(total) || total <= 0) return null;
  const alvo = Math.round((total + Number.EPSILON) * 100);
  const totalDe = (cent: number): number | null => {
    const c = contaDoValorAcordado(cent / 100, taxas, regime);
    return c ? c.totalAoClienteCent : null;
  };
  const primeiro = totalDe(1);
  if (primeiro == null || primeiro > alvo) return null;
  // Acima do total do máximo aceite é um erro de escrita, como no valor.
  const doMaximo = totalDe(MAXIMO_DO_PAGAMENTO_DIRECTO_CENT);
  if (doMaximo == null || alvo > doMaximo) return null;
  // O total cresce com o valor (nunca desce): procura-se o último que cabe.
  let baixo = 1;
  let alto = Math.min(alvo, MAXIMO_DO_PAGAMENTO_DIRECTO_CENT);
  while (baixo < alto) {
    const meio = Math.floor((baixo + alto + 1) / 2);
    const t = totalDe(meio);
    if (t != null && t <= alvo) baixo = meio;
    else alto = meio - 1;
  }
  return baixo / 100;
}

/** A conta inversa de uma negociação, com as taxas gravadas nela e o regime dela. */
export function valorDoTotalDaNegociacao(linha: LinhaParaOTotal, total: number | null | undefined): number | null {
  return valorDoTotalAoCliente(total, taxasDaNegociacao(linha), regimeDaNegociacao(linha));
}

/**
 * O PREÇO ESCRITO PELO CLIENTE, numa negociação — a porta única do WhatsApp e
 * do ecrã do pedido. No modelo novo, a conta inversa desta negociação; fora
 * dele, a de sempre (`baseDoPrecoDoCliente`, no modelo do preço). Devolve o
 * valor do parceiro e o total que ficou (o escrito, ou um pouco abaixo).
 */
export function valorDoPrecoEscrito(
  linha: LinhaParaOTotal,
  preco: number,
  modelo: ModeloDoPreco,
  noNovoModelo: boolean,
): { valor: number; ficou: number } | null {
  if (noNovoModelo) {
    const valor = valorDoTotalDaNegociacao(linha, preco);
    const t = valor == null ? null : totalAoClienteDaNegociacao(linha, valor);
    return valor == null || !t ? null : { valor, ficou: t.total };
  }
  const taxas = taxasDaNegociacao(linha);
  const valor = baseDoPrecoDoCliente(preco, taxas, modelo);
  return valor == null ? null : { valor, ficou: precoParaOCliente(valor, taxas, modelo) };
}
