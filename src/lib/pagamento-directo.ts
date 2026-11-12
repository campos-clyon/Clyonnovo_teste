import { TAXA_IVA, taxasDaNegociacao, type Taxas } from "./taxas-plataforma";

/**
 * A CONTA EM DEGRAUS DO PAGAMENTO AO PARCEIRO — d10, desde 15-11-2026
 * (`novo-modelo.ts`). Especificação das Finanças (12-11-2026).
 *
 * O cliente paga ao parceiro duas faturas: a do trabalho (do parceiro, com IVA se
 * ele estiver no regime normal, sem IVA se estiver isento) e a da taxa da
 * plataforma (da empresa parceira da CLYON, sempre com IVA). O parceiro passa à
 * CLYON a fatura da taxa — a taxa e o IVA dela — por referência do euPago.
 *
 * Tudo em CÊNTIMOS INTEIROS; arredonda-se só nos degraus da taxa, do IVA da taxa
 * e do IVA do parceiro (meio cêntimo para cima). O IVA calcula-se por fatura,
 * nunca sobre o total — por isso o total ao cliente pode diferir 1 cêntimo de
 * «valor × 1,23», e os testes exigem é que a conta feche.
 *
 * A taxa NUNCA é uma constante daqui: vem da negociação (`taxasDaNegociacao`, que
 * nasce das Configs) ou, nas mudanças pela lista, das regras congeladas.
 *
 * Pura e sem base: o simulador, o painel e o backoffice importam isto.
 */

export type RegimeDoProfissional = "normal" | "isento";

export type EntradaDoPagamentoDirecto = {
  /** A parte que leva taxa, sem IVA, em cêntimos (o trabalho; nas mudanças, horas + km). */
  servicoCent: number;
  /** Sem taxa (só nas mudanças: o material), sem IVA, em cêntimos. 0 por omissão. */
  materialCent?: number;
  /** As taxas da negociação. */
  taxas: Taxas;
  /** O regime do parceiro, congelado na negociação. */
  regime: RegimeDoProfissional;
  /** O IVA; `TAXA_IVA` por omissão. */
  iva?: number;
};

export type ContaDoPagamentoDirecto = {
  servicoCent: number;
  materialCent: number;
  /** T — a taxa da plataforma, sem IVA. */
  taxaCent: number;
  /** IT — o IVA da taxa. */
  ivaDaTaxaCent: number;
  /** FC = T + IT — a fatura da taxa, emitida pela empresa parceira da CLYON. */
  faturaDaClyonCent: number;
  /** B — a base do parceiro, sem IVA. */
  baseDoProfissionalCent: number;
  /** IP — o IVA do parceiro (0 se isento). */
  ivaDoProfissionalCent: number;
  /** FP = B + IP — a fatura do parceiro. */
  faturaDoProfissionalCent: number;
  /** FP + FC — o que o cliente paga ao parceiro, com IVA. */
  totalAoClienteCent: number;
  /** = FC — o que o parceiro passa à CLYON (o valor em atraso, quando o trabalho fecha). */
  aPassarAClyonCent: number;
  /** = FP — o que fica ao parceiro (o IVA dele, se tiver, é do Estado). */
  ficaAoProfissionalCent: number;
  /** = B — o líquido do parceiro, sem IVA. */
  liquidoDoProfissionalCent: number;
  /** = T — o que fica à CLYON, sem IVA (o IVA da taxa vai para o Estado). */
  ficaAClyonCent: number;
  regime: RegimeDoProfissional;
};

/** Valores acima disto (em cêntimos) recusam-se: 100 000 € é um erro de escrita. */
export const MAXIMO_DO_PAGAMENTO_DIRECTO_CENT = 10_000_000;

/** Uma percentagem em pontos-base inteiros (10 % = 1000), para o meio cêntimo não cair do lado errado. */
function emPontos(p: number): number {
  return Math.round(p * 10000);
}

/** `cent × pontos / 10000`, com o meio cêntimo para cima, só com inteiros. */
function partePorPontos(cent: number, pontos: number): number {
  return Math.floor((cent * pontos + 5000) / 10000);
}

export function contaDoPagamentoDirecto(
  e: EntradaDoPagamentoDirecto,
): { ok: true; conta: ContaDoPagamentoDirecto } | { ok: false; erro: string } {
  const servico = e.servicoCent;
  const material = e.materialCent ?? 0;
  if (!Number.isInteger(servico) || !Number.isInteger(material)) {
    return { ok: false, erro: "Os valores têm de vir em cêntimos inteiros." };
  }
  if (servico <= 0) return { ok: false, erro: "O valor do trabalho tem de ser maior do que zero." };
  if (material < 0) return { ok: false, erro: "O material não pode ser negativo." };
  if (servico + material > MAXIMO_DO_PAGAMENTO_DIRECTO_CENT) {
    return { ok: false, erro: "O valor passa do máximo aceite." };
  }
  if (e.regime !== "normal" && e.regime !== "isento") {
    return { ok: false, erro: "Falta o regime de IVA do parceiro." };
  }
  const pbCliente = emPontos(e.taxas.cliente);
  const pbProfissional = emPontos(e.taxas.profissional);
  const pbIva = emPontos(e.iva ?? TAXA_IVA);
  if (pbCliente < 0 || pbProfissional < 0 || pbIva < 0) return { ok: false, erro: "Taxa inválida." };

  const doProfissional = partePorPontos(servico, pbProfissional);
  const doCliente = partePorPontos(servico, pbCliente);
  const taxa = doProfissional + doCliente;
  const ivaDaTaxa = partePorPontos(taxa, pbIva);
  const faturaDaClyon = taxa + ivaDaTaxa;
  const base = servico - doProfissional + material;
  const ivaDoProfissional = e.regime === "normal" ? partePorPontos(base, pbIva) : 0;
  const faturaDoProfissional = base + ivaDoProfissional;

  return {
    ok: true,
    conta: {
      servicoCent: servico,
      materialCent: material,
      taxaCent: taxa,
      ivaDaTaxaCent: ivaDaTaxa,
      faturaDaClyonCent: faturaDaClyon,
      baseDoProfissionalCent: base,
      ivaDoProfissionalCent: ivaDoProfissional,
      faturaDoProfissionalCent: faturaDoProfissional,
      totalAoClienteCent: faturaDoProfissional + faturaDaClyon,
      aPassarAClyonCent: faturaDaClyon,
      ficaAoProfissionalCent: faturaDoProfissional,
      liquidoDoProfissionalCent: base,
      ficaAClyonCent: taxa,
      regime: e.regime,
    },
  };
}

/** Euros (com cêntimos) → cêntimos inteiros. */
export function emCentimos(euros: number): number {
  return Math.round((euros + (euros >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100);
}

/** A conta em euros, para ecrãs e mensagens. */
export type ContaDoPagamentoDirectoEmEuros = {
  [K in keyof Omit<ContaDoPagamentoDirecto, "regime"> as K extends `${infer N}Cent` ? N : never]: number;
} & { regime: RegimeDoProfissional };

export function emEurosDaConta(c: ContaDoPagamentoDirecto): ContaDoPagamentoDirectoEmEuros {
  const e = (v: number) => v / 100;
  return {
    servico: e(c.servicoCent),
    material: e(c.materialCent),
    taxa: e(c.taxaCent),
    ivaDaTaxa: e(c.ivaDaTaxaCent),
    faturaDaClyon: e(c.faturaDaClyonCent),
    baseDoProfissional: e(c.baseDoProfissionalCent),
    ivaDoProfissional: e(c.ivaDoProfissionalCent),
    faturaDoProfissional: e(c.faturaDoProfissionalCent),
    totalAoCliente: e(c.totalAoClienteCent),
    aPassarAClyon: e(c.aPassarAClyonCent),
    ficaAoProfissional: e(c.ficaAoProfissionalCent),
    liquidoDoProfissional: e(c.liquidoDoProfissionalCent),
    ficaAClyon: e(c.ficaAClyonCent),
    regime: c.regime,
  };
}

/**
 * A conta de uma negociação pelo valor acordado em euros (sem IVA) — o atalho
 * que a carteira, o simulador e as rotas usam. `null` quando o valor não serve.
 */
export function contaDoValorAcordado(
  acordado: number | null | undefined,
  taxas: Taxas,
  regime: RegimeDoProfissional,
): ContaDoPagamentoDirecto | null {
  if (acordado == null || !Number.isFinite(acordado)) return null;
  const r = contaDoPagamentoDirecto({ servicoCent: emCentimos(acordado), taxas, regime });
  return r.ok ? r.conta : null;
}

/**
 * O TOTAL QUE O CLIENTE PAGA AO PARCEIRO, de uma linha de `negociacoes` (as taxas
 * gravadas nela), em euros — para o ecrã do cliente, que recebe só o total.
 */
export function totalNoNovoModelo(
  linha: { taxaCliente?: unknown; taxaProfissional?: unknown },
  valor: number | null | undefined,
  regime: RegimeDoProfissional,
): number | null {
  const c = contaDoValorAcordado(valor, taxasDaNegociacao(linha), regime);
  return c ? c.totalAoClienteCent / 100 : null;
}
