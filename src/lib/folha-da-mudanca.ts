/**
 * A FOLHA DA MUDANÇA — ordem do CEO com o sim do dono, 11-11-2026.
 *
 * «Quando o profissional terminar o trabalho, ele põe o que gastou — 3 rolos
 * de filme, 1 rolo de plástico, caixas, metros de cartão, 20 horas, 70 km — e
 * tudo usa os dados da conta dele (a tarifa congelada) para calcular o valor
 * final. O profissional marca quando começou (pode ser a hora escrita à mão,
 * não só um botão) e quando acabou, e o cliente tem de validar.» (dono, 10-11)
 *
 * Só numa mudança com a lista de parceiros (negociação com `tarifaCongeladaJson`).
 * Todas as outras ficam exactamente como estavam (`horas-do-trabalho.ts`).
 *
 * AS REGRAS (escolhas do CEO pelas recomendações do Produto):
 *   · a hora conta desde a chegada à origem; a viagem entre as casas conta
 *     (está entre o início e o fim); as pausas não se cobram;
 *   · ao quarto de hora, para cima, e nunca abaixo do mínimo do parceiro (o
 *     da tarifa congelada — quem o aplica é `valorDaMudanca`);
 *   · km: os do percurso já preenchidos; corrigir pede um motivo; cobra-se
 *     max(km, km mínimos) × preço do km;
 *   · pessoas: as escolhidas pelo cliente; descer pode; subir só com o OK do
 *     cliente — e o OK é a confirmação da folha, que o diz por extenso;
 *   · material: as quatro unidades da tarifa, só as que o parceiro fornece;
 *   · o valor final é `valorDaMudanca` (conta-da-mudanca.ts): a taxa da
 *     plataforma só nas horas e nos km, de dentro; o material sem taxa e com
 *     IVA.
 *
 * O CLIENTE NUNCA FICA CALADO POR CONFIRMADO: lembretes às 2 h e às 24 h, e às
 * 48 h vai à Mesa como «Folha por confirmar». A folha nunca se confirma
 * sozinha.
 *
 * PURA (sem base, sem rede, sem process.env): o servidor, o painel, a app Pro,
 * a app de cliente e os testes fazem a mesma conta. Quem lê os textos «para o
 * cliente» é o cliente — por isso dizem «parceiro».
 */

import {
  MATERIAIS,
  tarifaCongeladaDeJson,
  valorDaMudanca,
  type ContaDaMudanca,
  type QuantidadeDoMaterial,
  type TarifaCongelada,
} from "./conta-da-mudanca";
import {
  MINUTOS_DO_ARREDONDAMENTO,
  duracaoEmPalavras,
  intervaloDasHoras,
  lerHora,
  lerMotivoDaContestacao,
} from "./horas-do-trabalho";
import { dataEHoraEmLisboa, instanteDaBase, instanteEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";

/* ── Os títulos e os botões, iguais em todos os ecrãs ─────────────────────── */
export const TITULO_DA_FOLHA = "Folha da mudança";
export const ENVIAR_A_FOLHA = "Enviar ao cliente para confirmar";
export const CORRIGIR_A_FOLHA = "Corrigir e enviar outra vez";
export const CONFIRMO_A_FOLHA = "Confirmo a folha";
export const BOTAO_AGORA = "Agora";
export const BOTAO_MAIS_PAUSA = "+ Pausa";
export const FOLHA_POR_CONFIRMAR = "Folha por confirmar";
export const MAXIMO_DE_PAUSAS = 6;
export const KM_MAXIMOS_DA_FOLHA = 1000;
export const QUANTIDADE_MAXIMA_DE_MATERIAL = 999;
/** A partir de meio km de diferença do percurso, pede-se o motivo. */
export const FOLGA_DOS_KM = 0.5;

/** Os prazos do cliente, desde que a folha foi enviada. */
export const PRAZOS_DA_FOLHA = Object.freeze({
  primeiroLembreteMs: 2 * 60 * 60_000,
  segundoLembreteMs: 24 * 60 * 60_000,
  mesaMs: 48 * 60 * 60_000,
});

export function regraDaFolha(minimoHoras: number): string {
  return (
    "A hora conta desde a chegada à origem, com a viagem entre as casas; as pausas não se cobram. " +
    `Ao quarto de hora, para cima, com um mínimo de ${horasEmTexto(minimoHoras)} horas.`
  );
}

/* ── Números e palavras ───────────────────────────────────────────────────── */

const eurCent = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const dois = (n: number) => String(n).padStart(2, "0");
function horasEmTexto(h: number): string {
  return Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100).replace(".", ",");
}
function numeroEmTexto(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace(".", ",");
}

function numeroDe(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.NaN;
  if (typeof v !== "string") return Number.NaN;
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

/** «3 rolos de filme», «1 caixa», «12,5 metros de cartão». */
export function quantidadeEmPalavras(chave: QuantidadeDoMaterial, q: number): string {
  const n = numeroEmTexto(q);
  const um = q === 1;
  switch (chave) {
    case "caixas":
      return `${n} ${um ? "caixa" : "caixas"}`;
    case "cartaoMetros":
      return `${n} ${um ? "metro" : "metros"} de cartão`;
    case "filmeRolos":
      return `${n} ${um ? "rolo" : "rolos"} de filme`;
    case "plasticoBolhaRolos":
      return `${n} ${um ? "rolo" : "rolos"} de plástico bolha`;
  }
}

/* ── A FOLHA ──────────────────────────────────────────────────────────────── */

export type PausaDaFolha = { inicio: string; fim: string; minutos: number };

export type FolhaDaMudanca = {
  versao: 1;
  /** O dia do início (AAAA-MM-DD, Lisboa). */
  dia: string;
  inicio: string;
  fim: string;
  inicioEm: string;
  fimEm: string;
  pausas: PausaDaFolha[];
  minutosNoLocal: number;
  minutosDePausa: number;
  minutosTrabalhados: number;
  /** As horas trabalhadas ao quarto de hora, para cima (antes do mínimo). */
  horasAoQuarto: number;
  pessoas: 2 | 3;
  pessoasEscolhidas: 2 | 3;
  km: number;
  kmDoPercurso: number | null;
  motivoDosKm: string | null;
  materiais: Partial<Record<QuantidadeDoMaterial, number>>;
  /** A hora da equipa usada na conta (cêntimos, sem IVA). */
  horaCent: number;
  conta: ContaDaMudanca;
};

export type ContextoDaFolha = {
  tarifa: TarifaCongelada;
  pessoasEscolhidas: 2 | 3;
  /** Os km do percurso (Routes), já preenchidos. Null se não se mediu. */
  kmDoPercurso: number | null;
  /** O valor da hora acordado com o cliente (euros, sem IVA) — pode ser menor do que a tarifa. */
  valorPorHoraAcordado: number | null;
  /** O dia a usar quando o corpo não o traz (o da chegada). */
  diaPorOmissao: string;
};

export type CorpoDaFolha = {
  dia?: unknown;
  inicio?: unknown;
  fim?: unknown;
  pausas?: unknown;
  pessoas?: unknown;
  km?: unknown;
  motivoDosKm?: unknown;
  materiais?: unknown;
};

/** 2 ou 3; o resto é a equipa escolhida. */
export function lerPessoasDaFolha(v: unknown, escolhidas: 2 | 3): 2 | 3 {
  const n = Number(v);
  return n === 2 || n === 3 ? n : escolhidas;
}

/**
 * A HORA DA EQUIPA NA FOLHA (cêntimos, sem IVA): a da tarifa congelada para a
 * equipa que foi, e nunca acima do valor acordado quando a equipa não subiu —
 * o cliente aceitou aquele preço. Subir para 3 usa a hora de 3 da tarifa (e o
 * cliente tem de concordar). Null se ele não tem preço para essa equipa.
 */
export function horaDaFolhaCent(
  t: TarifaCongelada,
  pessoas: 2 | 3,
  pessoasEscolhidas: 2 | 3,
  valorPorHoraAcordado: number | null,
): number | null {
  const daTarifa = pessoas === 3 ? t.precoHora3Cent : t.precoHora2Cent;
  if (daTarifa == null) return null;
  const acordadoCent =
    valorPorHoraAcordado != null && Number.isFinite(valorPorHoraAcordado) && valorPorHoraAcordado > 0
      ? Math.round(valorPorHoraAcordado * 100)
      : null;
  if (acordadoCent != null && pessoas <= pessoasEscolhidas) return Math.min(daTarifa, acordadoCent);
  return daTarifa;
}

/** A tarifa congelada com a hora desta folha no lugar da equipa que foi. */
function tarifaComAHora(t: TarifaCongelada, pessoas: 2 | 3, horaCent: number): TarifaCongelada {
  return pessoas === 3 ? { ...t, precoHora3Cent: horaCent } : { ...t, precoHora2Cent: horaCent };
}

/** Ao quarto de hora, para cima — sem mínimo (o mínimo é da tarifa). */
export function horasAoQuarto(minutos: number): number {
  if (!Number.isFinite(minutos) || minutos <= 0) return 0;
  const quartos = Math.ceil(minutos / MINUTOS_DO_ARREDONDAMENTO - 1e-9);
  return (quartos * MINUTOS_DO_ARREDONDAMENTO) / 60;
}

type Erro = { ok: false; erro: string; campo: string };
const erro = (campo: string, texto: string): Erro => ({ ok: false, erro: texto, campo });

/** Um «HH:MM» de uma pausa → o instante, dentro do trabalho (pode passar a meia-noite). */
function instanteDaPausa(dia: string, inicioDoTrabalho: { h: number; m: number }, hm: { h: number; m: number }, passaDaMeiaNoite: boolean) {
  const antesDoInicio = hm.h * 60 + hm.m < inicioDoTrabalho.h * 60 + inicioDoTrabalho.m;
  const d = antesDoInicio && passaDaMeiaNoite ? somarDiasAoDia(dia, 1) : dia;
  return instanteEmLisboa(`${d}T${dois(hm.h)}:${dois(hm.m)}`);
}

/**
 * LÊ A FOLHA QUE O PARCEIRO ESCREVEU e faz a conta. É a mesma função na rota
 * (que grava) e nos ecrãs (que mostram o valor antes de enviar).
 */
export function lerFolha(
  corpo: CorpoDaFolha,
  ctx: ContextoDaFolha,
  agora: Date = new Date(),
): { ok: true; folha: FolhaDaMudanca } | Erro {
  const dia = typeof corpo.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.dia) ? corpo.dia : ctx.diaPorOmissao;
  const lido = intervaloDasHoras({ dia, inicio: corpo.inicio, fim: corpo.fim }, agora);
  if (!lido.ok) return erro(lerHora(corpo.inicio) ? "fim" : "inicio", lido.erro);
  const { intervalo } = lido;
  const i = lerHora(corpo.inicio)!;

  // As pausas.
  const brutas = Array.isArray(corpo.pausas) ? corpo.pausas : corpo.pausas == null ? [] : null;
  if (brutas == null) return erro("pausas", "As pausas não se perceberam.");
  const escritas = brutas.filter((p) => {
    const o = (p ?? {}) as { inicio?: unknown; fim?: unknown };
    return !(String(o.inicio ?? "").trim() === "" && String(o.fim ?? "").trim() === "");
  });
  if (escritas.length > MAXIMO_DE_PAUSAS) return erro("pausas", `No máximo ${MAXIMO_DE_PAUSAS} pausas.`);
  const pausas: Array<PausaDaFolha & { de: number; ate: number }> = [];
  for (const [n, p] of escritas.entries()) {
    const o = (p ?? {}) as { inicio?: unknown; fim?: unknown };
    const pi = lerHora(o.inicio);
    const pf = lerHora(o.fim);
    if (!pi || !pf) return erro("pausas", `Na pausa ${n + 1}, indique o início e o fim (HH:MM).`);
    const de = instanteDaPausa(dia, i, pi, intervalo.passaDaMeiaNoite);
    let ate = instanteDaPausa(dia, i, pf, intervalo.passaDaMeiaNoite);
    if (de && ate && ate.getTime() <= de.getTime()) ate = instanteEmLisboa(`${somarDiasAoDia(dia, 1)}T${dois(pf.h)}:${dois(pf.m)}`);
    if (!de || !ate || ate.getTime() <= de.getTime()) return erro("pausas", `Na pausa ${n + 1}, o fim tem de ser depois do início.`);
    if (de.getTime() < intervalo.inicioEm.getTime() || ate.getTime() > intervalo.fimEm.getTime()) {
      return erro("pausas", `A pausa ${n + 1} tem de ficar entre a hora de início e a de fim.`);
    }
    pausas.push({
      inicio: `${dois(pi.h)}:${dois(pi.m)}`,
      fim: `${dois(pf.h)}:${dois(pf.m)}`,
      minutos: Math.round((ate.getTime() - de.getTime()) / 60_000),
      de: de.getTime(),
      ate: ate.getTime(),
    });
  }
  pausas.sort((a, b) => a.de - b.de);
  for (let k = 1; k < pausas.length; k++) {
    if (pausas[k].de < pausas[k - 1].ate) return erro("pausas", "Há duas pausas ao mesmo tempo.");
  }
  const minutosDePausa = pausas.reduce((s, p) => s + p.minutos, 0);
  const minutosTrabalhados = intervalo.minutos - minutosDePausa;
  if (minutosTrabalhados <= 0) return erro("pausas", "As pausas não podem ocupar o trabalho todo.");

  // As pessoas.
  const pessoas = lerPessoasDaFolha(corpo.pessoas, ctx.pessoasEscolhidas);
  const horaCent = horaDaFolhaCent(ctx.tarifa, pessoas, ctx.pessoasEscolhidas, ctx.valorPorHoraAcordado);
  if (horaCent == null) return erro("pessoas", "Não tem preço para a equipa de 3 pessoas.");

  // Os km.
  const kmLido = numeroDe(corpo.km);
  const km = kmLido == null ? ctx.kmDoPercurso : kmLido;
  if (km == null) return erro("km", "Indique os km do trabalho.");
  if (!Number.isFinite(km) || km < 0 || km > KM_MAXIMOS_DA_FOLHA) return erro("km", `Os km têm de ser um número entre 0 e ${KM_MAXIMOS_DA_FOLHA}.`);
  const kmArredondados = Math.round(km * 10) / 10;
  let motivoDosKm: string | null = null;
  if (ctx.kmDoPercurso != null && Math.abs(kmArredondados - ctx.kmDoPercurso) >= FOLGA_DOS_KM) {
    const m = lerMotivoDaContestacao(corpo.motivoDosKm);
    if (!m.ok) return erro("motivoDosKm", `Diga porque os km são diferentes dos do percurso (${numeroEmTexto(ctx.kmDoPercurso)} km).`);
    motivoDosKm = m.motivo;
  }

  // O material — só as quatro unidades da tarifa.
  const materiais: Partial<Record<QuantidadeDoMaterial, number>> = {};
  const brutos = corpo.materiais && typeof corpo.materiais === "object" ? (corpo.materiais as Record<string, unknown>) : {};
  for (const m of MATERIAIS) {
    const q = numeroDe(brutos[m.quantidade]);
    if (q == null || q === 0) continue;
    const nome = m.nome.toLowerCase();
    if (!Number.isFinite(q) || q < 0 || q > QUANTIDADE_MAXIMA_DE_MATERIAL) return erro("materiais", `A quantidade de ${nome} não é válida.`);
    const decimal = m.quantidade === "cartaoMetros";
    if (!decimal && !Number.isInteger(q)) return erro("materiais", `A quantidade de ${nome} é um número inteiro.`);
    if (ctx.tarifa.materiaisCent[m.chave] == null) return erro("materiais", `Não fornece ${nome}: tire-o da folha.`);
    materiais[m.quantidade] = decimal ? Math.round(q * 10) / 10 : q;
  }

  const horas = horasAoQuarto(minutosTrabalhados);
  const conta = valorDaMudanca(tarifaComAHora(ctx.tarifa, pessoas, horaCent), { pessoas, horas, km: kmArredondados, materiais });
  if (!conta.ok) return erro("conta", conta.erro);

  return {
    ok: true,
    folha: {
      versao: 1,
      dia,
      inicio: `${dois(i.h)}:${dois(i.m)}`,
      fim: (() => {
        const f = lerHora(corpo.fim)!;
        return `${dois(f.h)}:${dois(f.m)}`;
      })(),
      inicioEm: intervalo.inicioEm.toISOString(),
      fimEm: intervalo.fimEm.toISOString(),
      pausas: pausas.map(({ inicio, fim, minutos }) => ({ inicio, fim, minutos })),
      minutosNoLocal: intervalo.minutos,
      minutosDePausa,
      minutosTrabalhados,
      horasAoQuarto: horas,
      pessoas,
      pessoasEscolhidas: ctx.pessoasEscolhidas,
      km: kmArredondados,
      kmDoPercurso: ctx.kmDoPercurso,
      motivoDosKm,
      materiais,
      horaCent,
      conta,
    },
  };
}

/** Lê de volta a folha gravada (`folhaJson`). Null se não houver, ou se não se ler. */
export function folhaDeJson(texto: string | null | undefined): FolhaDaMudanca | null {
  if (!texto) return null;
  try {
    const f = JSON.parse(texto) as FolhaDaMudanca;
    if (!f || f.versao !== 1 || !f.conta || f.conta.ok !== true || typeof f.horaCent !== "number") return null;
    return f;
  } catch {
    return null;
  }
}

/** A equipa subiu acima da que o cliente escolheu — o cliente tem de concordar. */
export const subiuAEquipa = (f: Pick<FolhaDaMudanca, "pessoas" | "pessoasEscolhidas">): boolean => f.pessoas > f.pessoasEscolhidas;

/* ── O DINHEIRO ───────────────────────────────────────────────────────────── */

/**
 * O QUE VAI PARA O PAGAMENTO: o total sem IVA (passa a ser o `valorAcordado`
 * quando o cliente confirma) e a taxa da plataforma que sai dele, como fração.
 *
 * Nestas negociações a taxa do cliente é 0 (nasceram assim, ver
 * mudanca-com-parceiros-escolhidos.ts) e o pagamento faz «acordado × (1 − taxa
 * do profissional)». Para o material não levar taxa, a taxa gravada é a
 * EFECTIVA: a taxa das horas e dos km a dividir pelo total — e o parceiro
 * recebe, ao cêntimo, o que a folha lhe disse. Oito casas: a coluna
 * `taxaProfissional` é DECIMAL(10,8) desde a v18.
 */
export function dinheiroDaFolha(f: Pick<FolhaDaMudanca, "conta">): { valorSemIva: number; taxaProfissional: number; recebe: number } {
  const c = f.conta;
  const taxa = c.semIvaCent > 0 ? Math.round((c.taxa.cent / c.semIvaCent) * 1e8) / 1e8 : 0;
  return { valorSemIva: c.semIvaCent / 100, taxaProfissional: taxa, recebe: c.profissionalCent / 100 };
}

/* ── O QUE SE DIZ ─────────────────────────────────────────────────────────── */

export type LinhaDaFolha = { rotulo: string; valor: string; nota?: string | null; forte?: boolean };

export type FolhaNoEcra = {
  titulo: string;
  linhas: LinhaDaFolha[];
  /** «485,85 € com IVA (395,00 € sem IVA)». */
  totalTexto: string;
  /** Só do lado do parceiro: o que fica para ele. */
  recebeTexto: string | null;
  avisoDaEquipa: string | null;
  resumo: string;
  regra: string;
};

function linhasDaFolha(f: FolhaDaMudanca, para: "cliente" | "parceiro"): LinhaDaFolha[] {
  const c = f.conta;
  const de = para === "cliente" ? "do parceiro" : "seu";
  const l: LinhaDaFolha[] = [];
  const fimDito = f.fimEm.slice(0, 10) !== f.inicioEm.slice(0, 10) && f.fim <= f.inicio ? `${f.fim} (do dia seguinte)` : f.fim;
  l.push({ rotulo: "No local", valor: `das ${f.inicio} às ${fimDito}`, nota: duracaoEmPalavras(f.minutosNoLocal) });
  if (f.pausas.length > 0) {
    l.push({
      rotulo: f.pausas.length === 1 ? "Pausa" : "Pausas",
      valor: f.pausas.map((p) => `${p.inicio}–${p.fim}`).join(", "),
      nota: `${duracaoEmPalavras(f.minutosDePausa)}, não se cobra${f.pausas.length === 1 ? "" : "m"}`,
    });
  }
  const minimo = c.horas.cobradas > f.horasAoQuarto;
  l.push({
    rotulo: `Horas (equipa de ${f.pessoas})`,
    valor: eurCent(c.horas.cent),
    nota:
      `${horasEmTexto(c.horas.cobradas)} h × ${eurCent(c.horas.precoHoraCent)}/h` +
      (minimo ? ` — trabalhou ${duracaoEmPalavras(f.minutosTrabalhados)}, conta o mínimo ${de}` : ` — trabalhou ${duracaoEmPalavras(f.minutosTrabalhados)}`),
  });
  const kmMinimo = c.km.cobrados > c.km.feitos;
  const corrigido = f.motivoDosKm ? ` (o percurso dá ${numeroEmTexto(f.kmDoPercurso ?? 0)} km: «${f.motivoDosKm}»)` : "";
  l.push({
    rotulo: "Deslocação",
    valor: eurCent(c.km.cent),
    nota: `${numeroEmTexto(c.km.cobrados)} km × ${eurCent(c.km.precoKmCent)}/km${kmMinimo ? ` — fez ${numeroEmTexto(c.km.feitos)} km, conta o mínimo ${de}` : ""}${corrigido}`,
  });
  for (const m of c.materiais.linhas) {
    const q = MATERIAIS.find((x) => x.chave === m.chave)!.quantidade;
    l.push({ rotulo: m.nome, valor: eurCent(m.cent), nota: `${quantidadeEmPalavras(q, m.quantidade)} × ${eurCent(m.precoCent)}` });
  }
  l.push({ rotulo: "Total sem IVA", valor: eurCent(c.semIvaCent), forte: true });
  l.push({ rotulo: `IVA (${Math.round(ivaDa(c) * 100)} %)`, valor: eurCent(c.ivaCent) });
  l.push({ rotulo: "Total com IVA", valor: eurCent(c.totalCent), forte: true });
  if (para === "parceiro") {
    l.push({ rotulo: "Taxa da plataforma", valor: `−${eurCent(c.taxa.cent)}`, nota: `${Math.round(c.taxa.fracao * 100)} % das horas e dos km; o material não leva taxa` });
    l.push({ rotulo: "Recebe", valor: eurCent(c.profissionalCent), nota: "sem IVA", forte: true });
  }
  return l;
}

/** O IVA da conta, como fração (o da tarifa congelada). */
function ivaDa(c: ContaDaMudanca): number {
  return c.baseDoIvaCent > 0 ? Math.round((c.ivaCent / c.baseDoIvaCent) * 100) / 100 : 0.23;
}

/** «Das 09:00 às 17:30, 8 h com 2 pessoas, 70 km e material → 485,85 € com IVA (395,00 € sem IVA).» */
export function resumoDaFolha(f: FolhaDaMudanca): string {
  const c = f.conta;
  const mat = c.materiais.linhas.length > 0 ? " e material" : "";
  return (
    `Das ${f.inicio} às ${f.fim}, ${horasEmTexto(c.horas.cobradas)} h com ${f.pessoas} pessoas, ` +
    `${numeroEmTexto(c.km.cobrados)} km${mat} → ${eurCent(c.totalCent)} com IVA (${eurCent(c.semIvaCent)} sem IVA).`
  );
}

export function folhaNoEcra(f: FolhaDaMudanca, para: "cliente" | "parceiro", minimoHoras: number): FolhaNoEcra {
  const c = f.conta;
  const linhas = linhasDaFolha(f, para);
  const subiu = subiuAEquipa(f);
  return {
    titulo: TITULO_DA_FOLHA,
    linhas,
    totalTexto: `${eurCent(c.totalCent)} com IVA (${eurCent(c.semIvaCent)} sem IVA)`,
    recebeTexto: para === "parceiro" ? `Recebe ${eurCent(c.profissionalCent)}, depois da taxa da plataforma.` : null,
    avisoDaEquipa: subiu
      ? para === "cliente"
        ? `A equipa subiu de ${f.pessoasEscolhidas} para ${f.pessoas} pessoas. Ao confirmar a folha, concorda com a equipa de ${f.pessoas}.`
        : `Subiu a equipa de ${f.pessoasEscolhidas} para ${f.pessoas} pessoas: o cliente tem de concordar ao confirmar a folha.`
      : null,
    resumo: resumoDaFolha(f),
    regra: regraDaFolha(minimoHoras),
  };
}

/* ── OS ESTADOS E OS PRAZOS ───────────────────────────────────────────────── */

export type FolhaNaBase = {
  folhaJson?: string | null;
  folhaHistoricoJson?: string | null;
  folhaLembrete2hEm?: Date | string | null;
  folhaLembrete24hEm?: Date | string | null;
  folhaNaMesaEm?: Date | string | null;
  horasMarcadasEm?: Date | string | null;
  horasConfirmadasEm?: Date | string | null;
  horasContestadasEm?: Date | string | null;
};

export type EstadoDaFolha = "enviada" | "por_confirmar" | "contestada" | "confirmada";

const tem = (v: Date | string | null | undefined) => instanteDaBase(v ?? null) != null;

/** O estado da folha — null quando não há folha. */
export function estadoDaFolha(t: FolhaNaBase, agora: Date = new Date()): EstadoDaFolha | null {
  if (!folhaDeJson(t.folhaJson ?? null) || !tem(t.horasMarcadasEm)) return null;
  if (tem(t.horasConfirmadasEm)) return "confirmada";
  if (tem(t.horasContestadasEm)) return "contestada";
  if (tem(t.folhaNaMesaEm)) return "por_confirmar";
  const enviada = instanteDaBase(t.horasMarcadasEm ?? null)!;
  if (agora.getTime() - enviada.getTime() >= PRAZOS_DA_FOLHA.mesaMs) return "por_confirmar";
  return "enviada";
}

/** A Mesa olha para ela: «Folha por confirmar» (48 h sem resposta) ou «Não concordo». */
export const folhaPrecisaDaMesa = (t: FolhaNaBase, agora: Date = new Date()): boolean => {
  const e = estadoDaFolha(t, agora);
  return e === "por_confirmar" || e === "contestada";
};

export type PassoDaFolha = "lembrete_2h" | "lembrete_24h" | "mesa";

/**
 * O QUE A ROTINA FAZ AGORA a uma folha enviada sem resposta — ou nada. Uma
 * passagem atrasada não manda os dois lembretes de seguida: faz o mais
 * adiantado que ainda não fez. E nunca confirma.
 */
export function passoDaFolha(t: FolhaNaBase, agora: Date = new Date()): PassoDaFolha | null {
  if (!folhaDeJson(t.folhaJson ?? null)) return null;
  if (!tem(t.horasMarcadasEm) || tem(t.horasConfirmadasEm) || tem(t.horasContestadasEm) || tem(t.folhaNaMesaEm)) return null;
  const passou = agora.getTime() - instanteDaBase(t.horasMarcadasEm ?? null)!.getTime();
  if (passou >= PRAZOS_DA_FOLHA.mesaMs) return "mesa";
  if (passou >= PRAZOS_DA_FOLHA.segundoLembreteMs) return tem(t.folhaLembrete24hEm) ? null : "lembrete_24h";
  if (passou >= PRAZOS_DA_FOLHA.primeiroLembreteMs) return tem(t.folhaLembrete2hEm) || tem(t.folhaLembrete24hEm) ? null : "lembrete_2h";
  return null;
}

export function estadoDaFolhaParaOCliente(e: EstadoDaFolha | null): string | null {
  switch (e) {
    case "enviada":
    case "por_confirmar":
      return "Confira a folha e confirme, ou diga que não concorda. A folha só fica confirmada consigo.";
    case "contestada":
      return "Disse que não concorda com a folha. A equipa da CLYON vai ver consigo e com o parceiro.";
    case "confirmada":
      return "Confirmou a folha.";
    default:
      return null;
  }
}

export function estadoDaFolhaParaOParceiro(e: EstadoDaFolha | null, motivo?: string | null): string | null {
  switch (e) {
    case "enviada":
      return "Enviada. À espera que o cliente confirme a folha.";
    case "por_confirmar":
      return "O cliente ainda não respondeu: a equipa da CLYON está a ver com ele.";
    case "contestada": {
      const m = (motivo ?? "").trim();
      return `O cliente não concorda com a folha${m ? `: «${m}»` : ""}. Corrija-a, ou espere pela CLYON.`;
    }
    case "confirmada":
      return "O cliente confirmou a folha.";
    default:
      return null;
  }
}

/* ── O HISTÓRICO ──────────────────────────────────────────────────────────── */

export type AcaoDaFolha = "enviada" | "corrigida" | "confirmada" | "contestada" | "lembrete_2h" | "lembrete_24h" | "mesa";
export type EdicaoDaFolha = { em: string; por: "parceiro" | "cliente" | "clyon" | "sistema"; acao: AcaoDaFolha; texto: string };

const ACCOES: ReadonlySet<string> = new Set(["enviada", "corrigida", "confirmada", "contestada", "lembrete_2h", "lembrete_24h", "mesa"]);

export function lerHistoricoDaFolha(texto: string | null | undefined): EdicaoDaFolha[] {
  if (!texto) return [];
  try {
    const l = JSON.parse(texto) as unknown;
    if (!Array.isArray(l)) return [];
    return l.filter(
      (e): e is EdicaoDaFolha =>
        !!e && typeof e === "object" && typeof (e as EdicaoDaFolha).em === "string" && ACCOES.has((e as EdicaoDaFolha).acao),
    );
  } catch {
    return [];
  }
}

export function edicaoDaFolha(
  acao: AcaoDaFolha,
  por: EdicaoDaFolha["por"],
  texto: string,
  agora: Date = new Date(),
): EdicaoDaFolha {
  return { em: agora.toISOString(), por, acao, texto: texto.slice(0, 500) };
}

const NO_HISTORICO: Record<AcaoDaFolha, string> = {
  enviada: "Folha enviada ao cliente",
  corrigida: "Folha corrigida e enviada outra vez",
  confirmada: "Folha confirmada",
  contestada: "O cliente não concorda",
  lembrete_2h: "Lembrete ao cliente (2 h)",
  lembrete_24h: "Lembrete ao cliente (24 h)",
  mesa: `${FOLHA_POR_CONFIRMAR} — foi à Mesa (48 h)`,
};

/** O histórico para se ler: «11/11/2026, 14:30 — Folha enviada ao cliente: …». */
export function historicoParaVer(h: EdicaoDaFolha[]): Array<{ quando: string; texto: string }> {
  return h.map((e) => {
    const d = instanteDaBase(e.em);
    return { quando: d ? dataEHoraEmLisboa(d) : "", texto: e.texto ? `${NO_HISTORICO[e.acao]}: ${e.texto}` : NO_HISTORICO[e.acao] };
  });
}

/* ── OS CAMPOS DO ECRÃ DO PARCEIRO ────────────────────────────────────────── */

export type MaterialDaFolha = { quantidade: QuantidadeDoMaterial; nome: string; unidade: string; precoTexto: string; decimal: boolean };

export type CamposDaFolha = {
  dia: string;
  inicio: string;
  fim: string;
  pausas: Array<{ inicio: string; fim: string }>;
  pessoas: 2 | 3;
  pessoasEscolhidas: 2 | 3;
  podeTres: boolean;
  km: string;
  kmDoPercurso: number | null;
  motivoDosKm: string;
  materiais: Partial<Record<QuantidadeDoMaterial, string>>;
  materiaisDisponiveis: MaterialDaFolha[];
  minimoHoras: number;
};

/** Os campos já preenchidos: com o que gravou, ou com o pedido (equipa escolhida, km do percurso). */
export function camposDaFolha(f: FolhaDaMudanca | null, ctx: ContextoDaFolha): CamposDaFolha {
  const unidades: Record<QuantidadeDoMaterial, string> = {
    caixas: "caixa",
    cartaoMetros: "metro",
    filmeRolos: "rolo",
    plasticoBolhaRolos: "rolo",
  };
  const disponiveis: MaterialDaFolha[] = MATERIAIS.filter((m) => ctx.tarifa.materiaisCent[m.chave] != null).map((m) => ({
    quantidade: m.quantidade,
    nome: m.nome,
    unidade: unidades[m.quantidade],
    precoTexto: `${eurCent(ctx.tarifa.materiaisCent[m.chave]!)}/${unidades[m.quantidade]}`,
    decimal: m.quantidade === "cartaoMetros",
  }));
  const materiais: Partial<Record<QuantidadeDoMaterial, string>> = {};
  for (const [k, v] of Object.entries(f?.materiais ?? {})) materiais[k as QuantidadeDoMaterial] = numeroEmTexto(Number(v));
  return {
    dia: f?.dia ?? ctx.diaPorOmissao,
    inicio: f?.inicio ?? "",
    fim: f?.fim ?? "",
    pausas: (f?.pausas ?? []).map((p) => ({ inicio: p.inicio, fim: p.fim })),
    pessoas: f?.pessoas ?? ctx.pessoasEscolhidas,
    pessoasEscolhidas: ctx.pessoasEscolhidas,
    podeTres: ctx.tarifa.precoHora3Cent != null,
    km: f ? numeroEmTexto(f.km) : ctx.kmDoPercurso != null ? numeroEmTexto(ctx.kmDoPercurso) : "",
    kmDoPercurso: ctx.kmDoPercurso,
    motivoDosKm: f?.motivoDosKm ?? "",
    materiais,
    materiaisDisponiveis: disponiveis,
    minimoHoras: ctx.tarifa.minimoHoras,
  };
}

/** O contexto a partir das colunas: a tarifa congelada, a equipa e os km do percurso. Null fora das mudanças com a lista. */
export function contextoDaFolha(d: {
  tarifaCongeladaJson: string | null | undefined;
  pessoasEscolhidas: unknown;
  kmDoPercurso: unknown;
  valorPorHoraAcordado: unknown;
  diaPorOmissao: string;
}): ContextoDaFolha | null {
  const tarifa = tarifaCongeladaDeJson(d.tarifaCongeladaJson ?? null);
  if (!tarifa) return null;
  const km = d.kmDoPercurso == null || d.kmDoPercurso === "" ? null : Number(d.kmDoPercurso);
  const hora = d.valorPorHoraAcordado == null || d.valorPorHoraAcordado === "" ? null : Number(d.valorPorHoraAcordado);
  return {
    tarifa,
    pessoasEscolhidas: Number(d.pessoasEscolhidas) === 3 ? 3 : 2,
    kmDoPercurso: km != null && Number.isFinite(km) && km >= 0 ? Math.round(km * 10) / 10 : null,
    valorPorHoraAcordado: hora != null && Number.isFinite(hora) && hora > 0 ? hora : null,
    diaPorOmissao: d.diaPorOmissao,
  };
}

/** O contexto como sai da rota (texto e números soltos): o ecrã refá-lo com `contextoDaFolha`. */
export type ContextoCruDaFolha = Parameters<typeof contextoDaFolha>[0];

/** O bloco da folha que `meus-pedidos` manda ao parceiro (painel e app Pro). */
export type FolhaParaOParceiro = {
  contexto: ContextoCruDaFolha;
  campos: CamposDaFolha;
  enviada: FolhaNoEcra | null;
  estado: EstadoDaFolha | null;
  estadoTexto: string | null;
  historico: Array<{ quando: string; texto: string }>;
  regra: string;
};
