import { TAXA_IVA } from "@/lib/taxas-plataforma";

/**
 * A CONTA DE UMA MUDANÇA PELO PREÇO DO PROFISSIONAL — 10-11-2026 (fase 1).
 *
 * Cada profissional de mudanças põe na conta dele o preço da hora da equipa
 * (com 2 e com 3 pessoas), o mínimo de horas, o preço do quilómetro, os km
 * mínimos cobrados, a distância máxima que aceita e o preço do material
 * (caixas, cartão, filme, plástico bolha). Quando o cliente o escolhe, a
 * tarifa CONGELA-SE no pedido: o profissional pode mudar a conta dele depois,
 * mas aquele trabalho fica com os valores do dia em que foi escolhido.
 *
 * No fim do trabalho ele diz o que gastou (horas, km, material) e o valor
 * final sai daqui, com a tarifa congelada.
 *
 * A taxa da plataforma conta só sobre as horas e os quilómetros. O material
 * não leva taxa: o que o profissional cobra pelo material é o que o cliente
 * paga por ele.
 *
 * Tudo em cêntimos, inteiros: somar euros em vírgula flutuante dá 0,1 + 0,2.
 *
 * Esta lib é PURA (sem base, sem rede): o painel, o backoffice e a rota usam
 * a mesma conta.
 */

/* ── AS DUAS ESCOLHAS — decididas a 10-11-2026; mudam AQUI e só aqui ─────────
 * A taxa sai do preço do profissional («de_dentro») e o material leva IVA.
 * O outro modo fica para os testes e para o caso de a regra mudar. */

/**
 * «de_dentro»: a taxa sai do preço do profissional (o cliente paga o preço
 * dele, o profissional recebe o preço menos a taxa).
 * «por_cima»: a taxa soma-se ao preço do profissional (o cliente paga mais,
 * o profissional recebe o preço todo).
 */
export type ModoDaTaxa = "por_cima" | "de_dentro";
export const MODO_DA_TAXA_DAS_MUDANCAS: ModoDaTaxa = "de_dentro";

/** Se o material leva IVA na conta do cliente. */
export const MATERIAL_COM_IVA = true;

/** A taxa da plataforma nas mudanças pelo preço do profissional (fração). */
export const TAXA_DAS_MUDANCAS = 0.1;

export type RegrasDaConta = {
  /** Fração (0,1 = 10 %). */
  taxa: number;
  modo: ModoDaTaxa;
  materialComIva: boolean;
  /** Fração (0,23). */
  iva: number;
};

/** As regras de hoje. Congelam-se com a tarifa: um pedido fica com as do dia em que se escolheu. */
export const REGRAS_DAS_MUDANCAS: RegrasDaConta = Object.freeze({
  taxa: TAXA_DAS_MUDANCAS,
  modo: MODO_DA_TAXA_DAS_MUDANCAS,
  materialComIva: MATERIAL_COM_IVA,
  iva: TAXA_IVA,
});

/* ── A TARIFA ─────────────────────────────────────────────────────────────── */

/** Os materiais, pela ordem em que se mostram. */
export const MATERIAIS = [
  { chave: "caixa", quantidade: "caixas", nome: "Caixas", unidade: "caixa" },
  { chave: "cartaoMetro", quantidade: "cartaoMetros", nome: "Cartão", unidade: "metro" },
  { chave: "filmeRolo", quantidade: "filmeRolos", nome: "Filme", unidade: "rolo" },
  { chave: "plasticoBolhaRolo", quantidade: "plasticoBolhaRolos", nome: "Plástico bolha", unidade: "rolo" },
] as const;

export type ChaveDoMaterial = (typeof MATERIAIS)[number]["chave"];
export type QuantidadeDoMaterial = (typeof MATERIAIS)[number]["quantidade"];

/**
 * A tarifa como o profissional a escreve: euros, sem IVA.
 * Um material a null = «não forneço»; precoHora3 a null = «não faço com 3».
 */
export type TarifaDasMudancas = {
  precoHora2: number;
  precoHora3: number | null;
  minimoHoras: number;
  precoKm: number;
  /** Km mínimos cobrados por trabalho. */
  kmMinimo: number;
  /** A distância máxima que aceita. */
  kmMaximo: number;
  caixa: number | null;
  cartaoMetro: number | null;
  filmeRolo: number | null;
  plasticoBolhaRolo: number | null;
  aparecerNaLista: boolean;
};

/** Os limites de segurança (euros sem IVA, horas, km). */
export const LIMITES_DA_TARIFA = Object.freeze({
  hora: { min: 15, max: 150 },
  km: { min: 0, max: 5 },
  material: { min: 0, max: 100 },
  minimoHoras: { min: 1, max: 8 },
  kmMinimo: { min: 0, max: 500 },
  kmMaximo: { min: 1, max: 500 },
});

type Campo = keyof Omit<TarifaDasMudancas, "aparecerNaLista">;

const NOMES_DOS_CAMPOS: Record<Campo, string> = {
  precoHora2: "O preço da hora com 2 pessoas",
  precoHora3: "O preço da hora com 3 pessoas",
  minimoHoras: "O mínimo de horas",
  precoKm: "O preço do quilómetro",
  kmMinimo: "Os km mínimos",
  kmMaximo: "A distância máxima",
  caixa: "O preço da caixa",
  cartaoMetro: "O preço do metro de cartão",
  filmeRolo: "O preço do rolo de filme",
  plasticoBolhaRolo: "O preço do rolo de plástico bolha",
};

const LIMITE_DO_CAMPO: Record<Campo, { min: number; max: number }> = {
  precoHora2: LIMITES_DA_TARIFA.hora,
  precoHora3: LIMITES_DA_TARIFA.hora,
  minimoHoras: LIMITES_DA_TARIFA.minimoHoras,
  precoKm: LIMITES_DA_TARIFA.km,
  kmMinimo: LIMITES_DA_TARIFA.kmMinimo,
  kmMaximo: LIMITES_DA_TARIFA.kmMaximo,
  caixa: LIMITES_DA_TARIFA.material,
  cartaoMetro: LIMITES_DA_TARIFA.material,
  filmeRolo: LIMITES_DA_TARIFA.material,
  plasticoBolhaRolo: LIMITES_DA_TARIFA.material,
};

const OBRIGATORIOS: Campo[] = ["precoHora2", "minimoHoras", "precoKm", "kmMinimo", "kmMaximo"];
const OPCIONAIS: Campo[] = ["precoHora3", "caixa", "cartaoMetro", "filmeRolo", "plasticoBolhaRolo"];

/** «12,5», «12.50», 12.5 → 12.5. Vazio/null → null. Lixo → NaN. */
function numeroDe(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = v.trim().replace(/\s/g, "").replace(",", ".");
    if (!t) return null;
    if (!/^\d+(\.\d+)?$/.test(t)) return Number.NaN;
    return Number(t);
  }
  return Number.NaN;
}

const comDuasCasas = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

export type ResultadoDaValidacao =
  | { ok: true; tarifa: TarifaDasMudancas }
  | { ok: false; erros: Partial<Record<Campo | "aparecerNaLista", string>> };

/**
 * Lê e valida a tarifa que chega do painel ou da app. Não decide se ele pode
 * aparecer na lista (isso é da categoria, na rota): só lê o interruptor.
 */
export function validarTarifa(corpo: unknown): ResultadoDaValidacao {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const erros: Partial<Record<Campo | "aparecerNaLista", string>> = {};
  const valores: Partial<Record<Campo, number | null>> = {};

  for (const campo of [...OBRIGATORIOS, ...OPCIONAIS]) {
    const n = numeroDe(c[campo]);
    const nome = NOMES_DOS_CAMPOS[campo];
    if (n === null) {
      if (OBRIGATORIOS.includes(campo)) erros[campo] = `${nome} é obrigatório.`;
      valores[campo] = null;
      continue;
    }
    const { min, max } = LIMITE_DO_CAMPO[campo];
    if (!Number.isFinite(n)) {
      erros[campo] = `${nome} tem de ser um número.`;
    } else if (n < min || n > max) {
      erros[campo] = `${nome} tem de estar entre ${min} e ${max}.`;
    } else if (!comDuasCasas(n)) {
      erros[campo] = `${nome} leva no máximo duas casas decimais.`;
    } else if (campo === "minimoHoras" && !Number.isInteger(n * 2)) {
      erros[campo] = "O mínimo de horas vai de meia em meia hora.";
    } else if ((campo === "kmMinimo" || campo === "kmMaximo") && !Number.isInteger(n)) {
      erros[campo] = `${nome} é um número inteiro de km.`;
    }
    valores[campo] = n;
  }

  const a = c.aparecerNaLista;
  if (a !== undefined && typeof a !== "boolean") erros.aparecerNaLista = "Escolha sim ou não.";

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true,
    tarifa: {
      precoHora2: valores.precoHora2 as number,
      precoHora3: valores.precoHora3 ?? null,
      minimoHoras: valores.minimoHoras as number,
      precoKm: valores.precoKm as number,
      kmMinimo: valores.kmMinimo as number,
      kmMaximo: valores.kmMaximo as number,
      caixa: valores.caixa ?? null,
      cartaoMetro: valores.cartaoMetro ?? null,
      filmeRolo: valores.filmeRolo ?? null,
      plasticoBolhaRolo: valores.plasticoBolhaRolo ?? null,
      aparecerNaLista: a === true,
    },
  };
}

/* ── CONGELAR ─────────────────────────────────────────────────────────────── */

const cent = (euros: number) => Math.round(euros * 100);
const centOuNull = (euros: number | null) => (euros == null ? null : cent(euros));

/**
 * A tarifa tal como fica no pedido quando o cliente escolhe: cêntimos, as
 * regras do dia e a hora. Imutável e só com tipos de JSON — guarda-se com
 * `JSON.stringify` e lê-se com `tarifaCongeladaDeJson`.
 */
export type TarifaCongelada = Readonly<{
  versao: 1;
  congeladaEm: string;
  precoHora2Cent: number;
  precoHora3Cent: number | null;
  minimoHoras: number;
  precoKmCent: number;
  kmMinimo: number;
  kmMaximo: number;
  materiaisCent: Readonly<Record<ChaveDoMaterial, number | null>>;
  regras: Readonly<RegrasDaConta>;
}>;

export function congelarTarifa(
  tarifa: TarifaDasMudancas,
  regras: RegrasDaConta = REGRAS_DAS_MUDANCAS,
  agora: Date = new Date(),
): TarifaCongelada {
  return Object.freeze({
    versao: 1 as const,
    congeladaEm: agora.toISOString(),
    precoHora2Cent: cent(tarifa.precoHora2),
    precoHora3Cent: centOuNull(tarifa.precoHora3),
    minimoHoras: tarifa.minimoHoras,
    precoKmCent: cent(tarifa.precoKm),
    kmMinimo: tarifa.kmMinimo,
    kmMaximo: tarifa.kmMaximo,
    materiaisCent: Object.freeze({
      caixa: centOuNull(tarifa.caixa),
      cartaoMetro: centOuNull(tarifa.cartaoMetro),
      filmeRolo: centOuNull(tarifa.filmeRolo),
      plasticoBolhaRolo: centOuNull(tarifa.plasticoBolhaRolo),
    }),
    regras: Object.freeze({ ...regras }),
  });
}

/** Lê de volta o que se gravou no pedido. Null se não for uma tarifa congelada. */
export function tarifaCongeladaDeJson(texto: string | null | undefined): TarifaCongelada | null {
  if (!texto) return null;
  try {
    const t = JSON.parse(texto) as TarifaCongelada;
    if (!t || t.versao !== 1 || typeof t.precoHora2Cent !== "number" || !t.regras || !t.materiaisCent) return null;
    return Object.freeze({ ...t, materiaisCent: Object.freeze({ ...t.materiaisCent }), regras: Object.freeze({ ...t.regras }) });
  } catch {
    return null;
  }
}

/* ── A CONTA ──────────────────────────────────────────────────────────────── */

export type UsoDaMudanca = {
  pessoas: 2 | 3;
  horas: number;
  km: number;
  materiais?: Partial<Record<QuantidadeDoMaterial, number>>;
};

export type LinhaDoMaterial = {
  chave: ChaveDoMaterial;
  nome: string;
  unidade: string;
  quantidade: number;
  precoCent: number;
  cent: number;
};

export type ContaDaMudanca = {
  ok: true;
  pessoas: 2 | 3;
  horas: { pedidas: number; cobradas: number; precoHoraCent: number; cent: number };
  km: { feitos: number; cobrados: number; precoKmCent: number; cent: number; acimaDoMaximo: boolean };
  materiais: { linhas: LinhaDoMaterial[]; cent: number };
  /** Horas + km: o que leva a taxa. */
  servicoCent: number;
  taxa: { fracao: number; modo: ModoDaTaxa; cent: number };
  /** O que o cliente paga sem IVA. */
  semIvaCent: number;
  /** A base do IVA (sem o material, se ele não levar IVA). */
  baseDoIvaCent: number;
  ivaCent: number;
  totalCent: number;
  /** O que fica para o profissional (sem IVA). */
  profissionalCent: number;
};

export type ErroDaConta = { ok: false; erro: string };

const naoNegativo = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/**
 * O valor de uma mudança, em degraus, com a tarifa congelada.
 *
 * horas = max(horas, mínimo) × preço da equipa (2 ou 3 pessoas)
 * km = max(km, km mínimos) × preço do km
 * materiais = quantidade × preço, sem taxa
 * taxa = fração × (horas + km), por cima ou de dentro, conforme as regras
 * IVA sobre o que o cliente paga (sem o material, se ele não levar IVA)
 */
export function valorDaMudanca(t: TarifaCongelada, uso: UsoDaMudanca): ContaDaMudanca | ErroDaConta {
  if (uso.pessoas !== 2 && uso.pessoas !== 3) return { ok: false, erro: "A equipa é de 2 ou de 3 pessoas." };
  if (!naoNegativo(uso.horas)) return { ok: false, erro: "As horas têm de ser um número positivo." };
  if (!naoNegativo(uso.km)) return { ok: false, erro: "Os km têm de ser um número positivo." };

  const precoHoraCent = uso.pessoas === 3 ? t.precoHora3Cent : t.precoHora2Cent;
  if (precoHoraCent == null) return { ok: false, erro: "Sem preço para a equipa de 3 pessoas." };

  const horasCobradas = Math.max(uso.horas, t.minimoHoras);
  const horasCent = Math.round(horasCobradas * precoHoraCent);

  const kmCobrados = Math.max(uso.km, t.kmMinimo);
  const kmCent = Math.round(kmCobrados * t.precoKmCent);

  const linhas: LinhaDoMaterial[] = [];
  for (const m of MATERIAIS) {
    const q = uso.materiais?.[m.quantidade] ?? 0;
    if (!naoNegativo(q)) return { ok: false, erro: `A quantidade de ${m.nome.toLowerCase()} tem de ser positiva.` };
    if (q === 0) continue;
    const preco = t.materiaisCent[m.chave];
    if (preco == null) return { ok: false, erro: `Sem preço para ${m.nome.toLowerCase()}.` };
    linhas.push({ chave: m.chave, nome: m.nome, unidade: m.unidade, quantidade: q, precoCent: preco, cent: Math.round(q * preco) });
  }
  const materiaisCent = linhas.reduce((s, l) => s + l.cent, 0);

  const servicoCent = horasCent + kmCent;
  const taxaCent = Math.round(servicoCent * t.regras.taxa);
  const porCima = t.regras.modo === "por_cima";

  const semIvaCent = (porCima ? servicoCent + taxaCent : servicoCent) + materiaisCent;
  const profissionalCent = (porCima ? servicoCent : servicoCent - taxaCent) + materiaisCent;
  const baseDoIvaCent = t.regras.materialComIva ? semIvaCent : semIvaCent - materiaisCent;
  const ivaCent = Math.round(baseDoIvaCent * t.regras.iva);

  return {
    ok: true,
    pessoas: uso.pessoas,
    horas: { pedidas: uso.horas, cobradas: horasCobradas, precoHoraCent, cent: horasCent },
    km: { feitos: uso.km, cobrados: kmCobrados, precoKmCent: t.precoKmCent, cent: kmCent, acimaDoMaximo: uso.km > t.kmMaximo },
    materiais: { linhas, cent: materiaisCent },
    servicoCent,
    taxa: { fracao: t.regras.taxa, modo: t.regras.modo, cent: taxaCent },
    semIvaCent,
    baseDoIvaCent,
    ivaCent,
    totalCent: semIvaCent + ivaCent,
    profissionalCent,
  };
}

/** O exemplo da pré-visualização no painel e na app. */
export const EXEMPLO_DA_MUDANCA: UsoDaMudanca = Object.freeze({
  pessoas: 2,
  horas: 5,
  km: 30,
  materiais: Object.freeze({ caixas: 10 }),
});
