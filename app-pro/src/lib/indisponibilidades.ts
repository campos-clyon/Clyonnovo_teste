/**
 * OS DIAS EM QUE NÃO PODE TRABALHAR, NA APP — d35, 15-11-2026.
 *
 * A mesma secção da Agenda do painel: a lista do que marcou, «Marcar
 * indisponível» (dias inteiros, com «Até» opcional, ou umas horas de um dia),
 * «Desmarcar», e a pergunta quando cai em cima de um trabalho marcado. As
 * frases e o corpo do pedido vêm de `src/lib/textos-da-indisponibilidade.ts`
 * (os do painel); as regras e as frases de erro, do servidor
 * (`src/lib/indisponibilidade.ts`) — a app não inventa nenhuma.
 *
 * Tudo em dias «AAAA-MM-DD» e horas «HH:MM» de LISBOA, como texto: o
 * calendário daqui não usa a hora do telemóvel para nada, só o dia de hoje em
 * Lisboa (`diaEmLisboa`). Sem seletor nativo de datas (não há dependência
 * nova): um mês em grelha e as horas de meia em meia hora.
 */
import { diaEmLisboa, pecasEmLisboa, somarDiasAoDia } from "../../../src/lib/hora-de-lisboa";
import {
  DIAS_PARA_A_FRENTE,
  indisponibilidadePorExtenso,
  lerIndisponibilidade,
  MAXIMO_DE_DIAS_SEGUIDOS,
} from "../../../src/lib/indisponibilidade";
import {
  corpoDaMarcacao,
  perguntaDoTrabalhoMarcado,
  ROTA_DAS_INDISPONIBILIDADES,
  type EscolhaDaIndisponibilidade,
  type TrabalhoEmCima,
} from "../../../src/lib/textos-da-indisponibilidade";

export { corpoDaMarcacao, perguntaDoTrabalhoMarcado, ROTA_DAS_INDISPONIBILIDADES, MAXIMO_DE_DIAS_SEGUIDOS };
export type { EscolhaDaIndisponibilidade, TrabalhoEmCima };

/** Uma linha da lista, como a rota a devolve (`indisponibilidadeParaAApi`). */
export type Indisponibilidade = {
  id: number;
  inicioEm: string;
  fimEm: string;
  diaInteiro: boolean;
  dia: string;
  ate: string;
  inicio: string | null;
  fim: string | null;
  nota: string | null;
  /** «14/11 (dia inteiro)», «14/11 a 18/11», «14/11, das 14:00 às 18:00». */
  texto: string;
};

export type RespostaDasIndisponibilidades = { ok?: boolean; id?: number; indisponibilidades?: Indisponibilidade[] };

/** A lista de uma resposta da rota; sem lista, vazia (nunca rebenta o ecrã). */
export function listaDe(r: RespostaDasIndisponibilidades | null | undefined): Indisponibilidade[] {
  return Array.isArray(r?.indisponibilidades) ? r!.indisponibilidades! : [];
}

/** Onde o formulário começa: hoje, dias inteiros, das 09:00 às 13:00 — como no painel. */
export function escolhaInicial(agora: Date = new Date()): EscolhaDaIndisponibilidade {
  return { soHoras: false, dia: diaEmLisboa(agora), ate: "", inicio: "09:00", fim: "13:00", nota: "" };
}

// ── O calendário (um mês em grelha, segunda a domingo) ───────────────────────

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const DIAS_DA_SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];

/** «2026-11» de um dia. */
export const mesDe = (dia: string) => dia.slice(0, 7);

/** O mês `n` meses depois (ou antes) de «AAAA-MM». */
export function outroMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** «Novembro de 2026». */
export function tituloDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** 0 = segunda … 6 = domingo, de um dia de calendário (sem fuso: é só o calendário). */
function colunaDe(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number);
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
}

/** As semanas do mês, de segunda a domingo; os dias de fora do mês são null. */
export function semanasDoMes(mes: string): Array<Array<string | null>> {
  const primeiro = `${mes}-01`;
  const dias: Array<string | null> = Array.from({ length: colunaDe(primeiro) }, () => null);
  for (let d = primeiro; mesDe(d) === mes; d = somarDiasAoDia(d, 1)) dias.push(d);
  while (dias.length % 7 !== 0) dias.push(null);
  return Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7));
}

/** Pode-se tocar nesse dia? De hoje até um ano para a frente (o que o servidor aceita). */
export function podeEscolher(dia: string, hoje: string): boolean {
  return dia >= hoje && dia <= somarDiasAoDia(hoje, DIAS_PARA_A_FRENTE);
}

/** Os meses por onde se pode andar: do de hoje ao do último dia que se pode marcar. */
export function mesesPermitidos(hoje: string): { primeiro: string; ultimo: string } {
  return { primeiro: mesDe(hoje), ultimo: mesDe(somarDiasAoDia(hoje, DIAS_PARA_A_FRENTE)) };
}

/**
 * Um toque no calendário. Umas horas: é o dia. Dias inteiros: o primeiro toque
 * é «De»; um toque num dia depois é «Até»; com os dois escolhidos (ou num dia
 * antes do «De»), começa de novo. Tocar no próprio «De» tira o «Até».
 */
export function tocarNoDia(e: EscolhaDaIndisponibilidade, tocado: string): EscolhaDaIndisponibilidade {
  if (e.soHoras) return { ...e, dia: tocado, ate: "" };
  if (!e.dia || e.ate || tocado < e.dia) return { ...e, dia: tocado, ate: "" };
  if (tocado === e.dia) return { ...e, ate: "" };
  return { ...e, ate: tocado };
}

/** Como se pinta um dia: o «De», o «Até», os do meio, ou nada. */
export function marcaDoDia(e: EscolhaDaIndisponibilidade, dia: string): "ponta" | "meio" | null {
  if (dia === e.dia || (!e.soHoras && dia === e.ate)) return "ponta";
  if (!e.soHoras && e.ate && dia > e.dia && dia < e.ate) return "meio";
  return null;
}

// ── As horas ─────────────────────────────────────────────────────────────────

/** As horas de meia em meia hora, das 00:00 às 23:30. */
export const HORAS_DO_DIA: string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

/** Meia hora para a frente (+1) ou para trás (-1), sem passar das pontas do dia. */
export function passarAHora(hora: string, sentido: 1 | -1): string {
  const i = HORAS_DO_DIA.indexOf(hora);
  const j = Math.min(HORAS_DO_DIA.length - 1, Math.max(0, (i < 0 ? 18 : i) + sentido));
  return HORAS_DO_DIA[j];
}

// ── Antes de marcar ──────────────────────────────────────────────────────────

/**
 * O que vai ser marcado, pela regra do servidor: { texto } pronto a mostrar
 * («16/11 a 18/11»), ou { erro } com a frase do servidor (o botão fica
 * parado). O servidor volta a validar: isto só poupa uma ida e volta.
 */
export function previsaoDaMarcacao(
  e: EscolhaDaIndisponibilidade,
  agora: Date = new Date(),
): { texto: string; erro?: undefined } | { erro: string; texto?: undefined } {
  const lido = lerIndisponibilidade(corpoDaMarcacao(e), agora);
  return lido.ok ? { texto: indisponibilidadePorExtenso(lido.valor) } : { erro: lido.erro };
}

/** «#512 · 21/11, às 09:00» (ou só o dia, num trabalho sem hora), em Lisboa. */
export function trabalhoEmCimaPorExtenso(t: TrabalhoEmCima): string {
  const d = new Date(t.quando);
  if (!Number.isFinite(d.getTime())) return `#${t.pedidoId}`;
  const p = pecasEmLisboa(d);
  const dois = (n: number) => String(n).padStart(2, "0");
  const dia = `${dois(p.dia)}/${dois(p.mes)}`;
  return p.hora === 0 && p.minuto === 0 ? `#${t.pedidoId} · ${dia}` : `#${t.pedidoId} · ${dia}, às ${dois(p.hora)}:${dois(p.minuto)}`;
}
