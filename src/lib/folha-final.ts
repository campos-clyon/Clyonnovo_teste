import {
  REGRAS_DAS_MUDANCAS,
  contaDaFolhaFinal,
  type ContaDaFolhaFinal,
  type EntradaDaFolhaFinal,
  type RegrasDaConta,
  type TarifaCongelada,
} from "./conta-da-mudanca";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";
import { contaDoValorAcordado, type RegimeDoProfissional } from "./pagamento-directo";

/**
 * A FOLHA FINAL DE UMA MUDANÇA, PELA EQUIPA — d38 v2, commit b (15-11-2026).
 *
 * No lugar do «Corrigir o valor» nas mudanças: a equipa escreve as horas, a
 * equipa (2 ou 3), o preço da hora, a deslocação (em km ou em euros) e o
 * material por linhas, e o valor final sai da conta de sempre
 * (`contaDaFolhaFinal`, em conta-da-mudanca.ts). Serve antes e depois de o
 * trabalho estar dado por feito; cada gravação fica no histórico.
 *
 * A TAXA é a gravada no trabalho (dono, 15-11-2026): num Trabalho CLYON a
 * `taxaClyon` (o #524 tem 15 %); numa mudança pela lista a das regras
 * congeladas; nas outras a da negociação. Conta só sobre horas + deslocação —
 * o material não leva taxa e leva IVA.
 *
 * COMO FICA GRAVADO: como a folha da mudança confirmada pelo cliente
 * (`dinheiroDaFolha`), o valor sem IVA passa a ser o valor acordado e a taxa
 * do profissional fica a EFECTIVA (a da conta a dividir pelo total), para que
 * o «acordado × (1 − taxa)» de todos os ecrãs e da carteira dê, ao cêntimo, o
 * que a folha diz que ele recebe.
 *
 * Pura: a rota, os testes e a pré-visualização usam isto.
 */

/* ── LER O QUE A EQUIPA ESCREVEU ──────────────────────────────────────────── */

/** «12,5», «12.50», «12,50 €», 12.5 → 1250 cêntimos. Vazio → null. Lixo → NaN. */
export function centimosDe(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : Number.NaN;
  if (typeof v !== "string") return Number.NaN;
  const t = v.replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return Math.round(Number(t) * 100);
}

/** «6,5», «6.5», «6:30», «6h30», 6.5 → 6,5 horas. Vazio → null. Lixo → NaN. */
export function horasDe(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.NaN;
  if (typeof v !== "string") return Number.NaN;
  const t = v.trim().toLowerCase().replace(/\s/g, "");
  if (!t) return null;
  const hm = /^(\d{1,2})(?::|h)(\d{1,2})?(?:m|min)?$/.exec(t);
  if (hm) {
    const m = Number(hm[2] ?? 0);
    if (m >= 60) return Number.NaN;
    return Number(hm[1]) + m / 60;
  }
  const d = t.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(d)) return Number.NaN;
  return Number(d);
}

/** O corpo do pedido (o formulário do backoffice). */
export type CorpoDaFolhaFinal = {
  pessoas?: unknown;
  horas?: unknown;
  precoHora?: unknown;
  /** «km» ou «euros». */
  deslocacaoTipo?: unknown;
  km?: unknown;
  precoKm?: unknown;
  deslocacaoEuros?: unknown;
  materiais?: unknown;
};

export const MAXIMO_DE_HORAS = 48;
export const MAXIMO_DE_LINHAS_DE_MATERIAL = 12;

export type EntradaLida = Omit<EntradaDaFolhaFinal, "tarifa" | "regras">;

export function lerCorpoDaFolhaFinal(c: CorpoDaFolhaFinal): { ok: true; entrada: EntradaLida } | { ok: false; erro: string } {
  const pessoas = Number(c.pessoas);
  if (pessoas !== 2 && pessoas !== 3) return { ok: false, erro: "A equipa é de 2 ou de 3 pessoas." };

  const horas = horasDe(c.horas);
  if (horas == null) return { ok: false, erro: "Indique as horas do trabalho." };
  if (!Number.isFinite(horas) || horas <= 0) return { ok: false, erro: "As horas não são válidas (ex.: 6,5 ou 6:30)." };
  if (horas > MAXIMO_DE_HORAS) return { ok: false, erro: `Mais de ${MAXIMO_DE_HORAS} horas? Confirme as horas.` };

  const precoHora = centimosDe(c.precoHora);
  if (precoHora != null && !Number.isFinite(precoHora)) return { ok: false, erro: "O preço da hora não é válido." };

  let deslocacao: EntradaLida["deslocacao"];
  if (c.deslocacaoTipo === "euros") {
    const cent = centimosDe(c.deslocacaoEuros);
    if (cent == null || !Number.isFinite(cent)) return { ok: false, erro: "Indique a deslocação em euros (0 se não houver)." };
    deslocacao = { tipo: "euros", cent };
  } else if (c.deslocacaoTipo === "km") {
    const km = horasDe(c.km);
    if (km == null || !Number.isFinite(km) || km < 0) return { ok: false, erro: "Indique os km (0 se não houver)." };
    if (km > 2000) return { ok: false, erro: "Mais de 2000 km? Confirme os km." };
    const precoKm = centimosDe(c.precoKm);
    if (precoKm != null && !Number.isFinite(precoKm)) return { ok: false, erro: "O preço do km não é válido." };
    deslocacao = { tipo: "km", km, precoKmCent: precoKm };
  } else {
    return { ok: false, erro: "Escolha a deslocação: em km ou em euros." };
  }

  const linhas = Array.isArray(c.materiais) ? c.materiais : [];
  if (linhas.length > MAXIMO_DE_LINHAS_DE_MATERIAL) return { ok: false, erro: `No máximo ${MAXIMO_DE_LINHAS_DE_MATERIAL} linhas de material.` };
  const materiais: NonNullable<EntradaLida["materiais"]> = [];
  for (const [n, l] of linhas.entries()) {
    const o = (l && typeof l === "object" ? l : {}) as { descricao?: unknown; valor?: unknown };
    const cent = centimosDe(o.valor);
    const descricao = typeof o.descricao === "string" ? o.descricao : "";
    if (cent == null && !descricao.trim()) continue;
    if (cent == null || !Number.isFinite(cent)) return { ok: false, erro: `O valor do material ${n + 1} não é válido.` };
    materiais.push({ descricao, cent });
  }

  return { ok: true, entrada: { pessoas: pessoas as 2 | 3, horas, precoHoraCent: precoHora, deslocacao, materiais } };
}

/* ── A TAXA DO TRABALHO ───────────────────────────────────────────────────── */

export type DeOndeVemATaxa = "trabalho_clyon" | "tarifa" | "folha_anterior" | "negociacao";

/**
 * A taxa sobre horas + deslocação. A de uma folha final anterior manda (a
 * taxa da negociação passou a ser a efectiva, e recontá-la sobre ela era
 * descer a taxa a cada gravação); depois a do Trabalho CLYON, a da tarifa
 * congelada e, por fim, a da negociação — só com a taxa do cliente a zero,
 * porque a conta tira a taxa de dentro do valor.
 */
export function taxaDaFolhaFinal(t: {
  daFolhaAnterior: number | null;
  trabalhoClyon: boolean;
  taxaClyon: number | null;
  tarifa: TarifaCongelada | null;
  taxaCliente: number | null;
  taxaProfissional: number | null;
}): { ok: true; taxa: number; deOnde: DeOndeVemATaxa } | { ok: false; erro: string } {
  const valida = (x: number | null): x is number => x != null && Number.isFinite(x) && x >= 0 && x < 1;
  if (valida(t.daFolhaAnterior)) return { ok: true, taxa: t.daFolhaAnterior, deOnde: "folha_anterior" };
  if (t.trabalhoClyon) {
    if (valida(t.taxaClyon)) return { ok: true, taxa: t.taxaClyon, deOnde: "trabalho_clyon" };
    return { ok: false, erro: "Este Trabalho CLYON é antigo (sem taxa gravada): corrija o valor à mão." };
  }
  if (t.tarifa && valida(t.tarifa.regras.taxa)) return { ok: true, taxa: t.tarifa.regras.taxa, deOnde: "tarifa" };
  if ((t.taxaCliente ?? 0) > 0) {
    return { ok: false, erro: "Este trabalho tem taxa do cliente: a folha final só serve com a taxa tirada do valor. Corrija o valor à mão." };
  }
  if (valida(t.taxaProfissional)) return { ok: true, taxa: t.taxaProfissional, deOnde: "negociacao" };
  return { ok: false, erro: "Este trabalho não tem taxa gravada." };
}

/** As regras da conta: as congeladas (ou as de hoje), com a taxa do trabalho. */
export function regrasDaFolhaFinal(tarifa: TarifaCongelada | null, taxa: number): RegrasDaConta {
  return { ...(tarifa?.regras ?? REGRAS_DAS_MUDANCAS), taxa };
}

/* ── O QUE SE GRAVA ───────────────────────────────────────────────────────── */

/**
 * A taxa efectiva (8 casas: `taxaProfissional` é DECIMAL(10,8)) que faz o
 * «acordado × (1 − taxa)» dar, ao cêntimo, o que a folha diz. Procura-se à
 * volta da divisão, porque o arredondamento de oito casas pode cair do lado
 * errado de meio cêntimo.
 */
export function taxaEfectiva(semIvaCent: number, profissionalCent: number): number | null {
  if (semIvaCent <= 0) return null;
  const alvo = profissionalCent / 100;
  const valor = semIvaCent / 100;
  const base = Math.round(((semIvaCent - profissionalCent) / semIvaCent) * 1e8);
  for (let d = 0; d <= 200; d++) {
    for (const s of d === 0 ? [0] : [d, -d]) {
      const t = (base + s) / 1e8;
      if (t < 0 || t >= 1) continue;
      if (Math.abs(quantoOProfissionalRecebe(valor, { cliente: 0, profissional: t }) - alvo) < 0.0001) return t;
    }
  }
  return null;
}

export type OQueGravar = {
  /** O novo valor acordado (sem IVA), em euros. */
  valorAcordado: number;
  /** A taxa efectiva do profissional. */
  taxaProfissional: number;
  /** A taxa sobre horas + deslocação (a do trabalho). */
  taxaBase: number;
};

export function oQueGravarDaFolhaFinal(conta: ContaDaFolhaFinal): { ok: true; gravar: OQueGravar } | { ok: false; erro: string } {
  const t = taxaEfectiva(conta.semIvaCent, conta.profissionalCent);
  if (t == null) return { ok: false, erro: "A conta não fecha: confirme os valores." };
  return { ok: true, gravar: { valorAcordado: conta.semIvaCent / 100, taxaProfissional: t, taxaBase: conta.taxa.fracao } };
}

/* ── A PRÉ-VISUALIZAÇÃO ───────────────────────────────────────────────────── */

export type PreviaDaFolhaFinal = {
  /** Sem IVA, o que o cliente paga (horas + deslocação + material). */
  semIva: number;
  iva: number;
  /** Com IVA. */
  total: number;
  /** O que o profissional recebe (sem IVA). */
  profissional: number;
  /** O que fica para a CLYON (sem IVA). */
  clyon: number;
  /** A taxa sobre horas + deslocação. */
  taxa: number;
  /** Modelo de 15-11: a fatura do parceiro e a da CLYON (com IVA). */
  novoModelo: null | { faturaDoParceiro: number; faturaDaClyon: number; regime: RegimeDoProfissional };
};

/**
 * O que a equipa vê antes de gravar — os números que os ecrãs vão dizer a
 * seguir, pela mesma conta deles: no modelo antigo a da folha; no modelo de
 * 15-11 a do pagamento directo, sobre o valor e a taxa efectiva gravados.
 */
export function previaDaFolhaFinal(
  conta: ContaDaFolhaFinal,
  gravar: OQueGravar,
  modelo: { novoModelo: boolean; regime: RegimeDoProfissional },
): PreviaDaFolhaFinal {
  if (modelo.novoModelo) {
    const c = contaDoValorAcordado(gravar.valorAcordado, { cliente: 0, profissional: gravar.taxaProfissional }, modelo.regime);
    if (c) {
      return {
        semIva: gravar.valorAcordado,
        iva: (c.ivaDaTaxaCent + c.ivaDoProfissionalCent) / 100,
        total: c.totalAoClienteCent / 100,
        profissional: c.liquidoDoProfissionalCent / 100,
        clyon: c.taxaCent / 100,
        taxa: gravar.taxaBase,
        novoModelo: { faturaDoParceiro: c.faturaDoProfissionalCent / 100, faturaDaClyon: c.faturaDaClyonCent / 100, regime: modelo.regime },
      };
    }
  }
  return {
    semIva: conta.semIvaCent / 100,
    iva: conta.ivaCent / 100,
    total: conta.totalCent / 100,
    profissional: conta.profissionalCent / 100,
    clyon: conta.taxa.cent / 100,
    taxa: gravar.taxaBase,
    novoModelo: null,
  };
}

/* ── TUDO DE UMA VEZ ──────────────────────────────────────────────────────── */

export type FolhaFinalFeita = {
  entrada: EntradaLida;
  conta: ContaDaFolhaFinal;
  gravar: OQueGravar;
  previa: PreviaDaFolhaFinal;
  deOnde: DeOndeVemATaxa;
};

export function fazerAFolhaFinal(a: {
  corpo: CorpoDaFolhaFinal;
  tarifa: TarifaCongelada | null;
  taxa: Parameters<typeof taxaDaFolhaFinal>[0];
  modelo: { novoModelo: boolean; regime: RegimeDoProfissional };
}): { ok: true; folha: FolhaFinalFeita } | { ok: false; erro: string } {
  const lido = lerCorpoDaFolhaFinal(a.corpo);
  if (!lido.ok) return lido;
  const taxa = taxaDaFolhaFinal(a.taxa);
  if (!taxa.ok) return taxa;
  const conta = contaDaFolhaFinal({ ...lido.entrada, tarifa: a.tarifa, regras: regrasDaFolhaFinal(a.tarifa, taxa.taxa) });
  if (!conta.ok) return conta;
  if (conta.semIvaCent <= 0) return { ok: false, erro: "O valor final tem de ser maior do que zero." };
  if (conta.semIvaCent > 10_000_000) return { ok: false, erro: "Valor acima do razoável. Confirme antes de gravar." };
  const g = oQueGravarDaFolhaFinal(conta);
  if (!g.ok) return g;
  return { ok: true, folha: { entrada: lido.entrada, conta, gravar: g.gravar, previa: previaDaFolhaFinal(conta, g.gravar, a.modelo), deOnde: taxa.deOnde } };
}

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** A frase do histórico do pedido. */
export function fraseDaFolhaFinal(f: FolhaFinalFeita, a: { porQuem: string; antes: number | null; jaPago: boolean; motivo: string | null }): string {
  const c = f.conta;
  const horas = `${String(Math.round(c.horas.cobradas * 100) / 100).replace(".", ",")} h a ${eur(c.horas.precoHoraCent / 100)}`;
  const desl = c.deslocacao.tipo === "km" ? `${c.deslocacao.kmCobrados} km (${eur(c.deslocacao.cent / 100)})` : `deslocação ${eur(c.deslocacao.cent / 100)}`;
  const mat = c.materiais.cent > 0 ? `, material ${eur(c.materiais.cent / 100)} (sem taxa)` : "";
  return (
    `Folha final da mudança gravada por ${a.porQuem}: equipa de ${c.pessoas}, ${horas}, ${desl}${mat}. ` +
    `Valor final ${eur(f.previa.semIva)} sem IVA (${eur(f.previa.total)} com IVA)` +
    `${a.antes != null ? `, era ${eur(a.antes)}` : ""}. ` +
    `Taxa ${String(Math.round(f.gravar.taxaBase * 10000) / 100).replace(".", ",")} % sobre horas e deslocação: ${eur(f.previa.clyon)}; ` +
    `o profissional recebe ${eur(f.previa.profissional)}.` +
    (a.jaPago ? " ATENÇÃO: o profissional já estava pago." : "") +
    (a.motivo ? ` Motivo: ${a.motivo}` : "")
  );
}
