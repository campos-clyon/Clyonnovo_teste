/**
 * A AGENDA EM GRELHA, NA APP — 29-10-2026 (A15 da especificação v3).
 *
 * A agenda do painel (`Agenda.tsx` + `GrelhaDeAgenda`) tem dia, semana, mês e
 * lista; os trabalhos feitos aparecem no sítio onde foram feitos, mais
 * apagados; os sem dia ficam numa faixa à parte, com o dia a marcar ali
 * mesmo; e um trabalho arrasta-se para outro dia ou outra hora. A app só tinha
 * a lista — B2, linhas 85 a 89.
 *
 * As contas são as do painel: vêm de `src/lib/agenda-em-grelha.ts` (as
 * semanas à segunda, as horas que se vêem, dois trabalhos lado a lado, o
 * arrasto ao quarto de hora). Tudo no relógio de Lisboa: as datas entram por
 * `noRelogioDeLisboa`, e o que se grava sai em «AAAA-MM-DDTHH:MM» de Lisboa,
 * que é o que a rota da agenda lê (`instanteEmLisboa`).
 *
 * Puro de propósito: os testes do site importam-no.
 */
import {
  ALTURA_DA_HORA,
  chaveDoDia,
  corDoServico,
  DURACAO_PADRAO_MIN,
  horaCurta,
  instanteDaChave,
  JANELA_PADRAO,
  minutosDoDia,
  PASSO_DO_ARRASTO,
  proximoDepois,
  somarDias,
} from "../../../src/lib/agenda-em-grelha";
import { diaEmLisboa, noRelogioDeLisboa, pecasEmLisboa, somarDiasAoDia } from "../../../src/lib/hora-de-lisboa";
import { servicoDe, type Fase, type Trabalho } from "./trabalhos";

/** O estado de um trabalho feito, no bloco — o `ESTADO_DO_FEITO` do painel. */
export const ESTADO_DO_FEITO: Partial<Record<Fase, string>> = {
  a_confirmar: "Feito",
  confirmado: "Confirmado",
  pago: "Pago",
};

export type EventoDaApp = {
  id: number;
  /** No relógio de Lisboa (`noRelogioDeLisboa`): as contas da grelha lêem-no como hora de Lisboa. */
  inicio: Date;
  duracaoMin: number;
  titulo: string;
  /** O cliente; num feito, «Feito · Ana». */
  linha2: string | null;
  /** A morada, ou a localidade. */
  linha3: string | null;
  valor: number | null;
  /** A cor da barra: a do serviço; cinzenta num trabalho feito. */
  cor: string;
  /** Um trabalho feito: não se arrasta, e tocar-lhe abre o trabalho. */
  fixo: boolean;
};

/** Os por fazer da agenda: contratados, ainda por fazer, não arquivados. */
export function porFazerNaAgenda(lista: Trabalho[]): Trabalho[] {
  return lista.filter((t) => t.estado === "acordada" && t.fase === "a_executar" && !t.arquivadoEm);
}

/** Os feitos que a agenda mostra: à espera da confirmação, confirmados e pagos. */
export function feitosNaAgenda(lista: Trabalho[]): Trabalho[] {
  return lista.filter((t) => t.estado === "acordada" && ESTADO_DO_FEITO[t.fase] != null);
}

/** O dia de um trabalho por fazer: o combinado, ou o que o cliente pediu. */
export function quandoE(t: Pick<Trabalho, "dataCombinada" | "dataAgendada">): string | null {
  return t.dataCombinada ?? t.dataAgendada ?? null;
}

/** O dia de um feito: o marcado, ou, sem ele, quando o deu por feito. */
export function quandoFoi(t: Pick<Trabalho, "dataCombinada" | "dataAgendada" | "execucaoEnviadaEm">): string | null {
  return quandoE(t) ?? t.execucaoEnviadaEm ?? null;
}

const HEX_DO_PONTO: Record<string, string> = {
  "bg-[#06B6D4]": "#06B6D4",
  "bg-amber-500": "#F59E0B",
  "bg-violet-500": "#8B5CF6",
  "bg-blue-500": "#3B82F6",
  "bg-emerald-500": "#10B981",
  "bg-indigo-500": "#6366F1",
  "bg-orange-500": "#F97316",
  "bg-lime-500": "#84CC16",
  "bg-fuchsia-500": "#D946EF",
  "bg-teal-500": "#14B8A6",
  "bg-slate-400": "#94A3B8",
};

/** A cor do serviço — a mesma escolha do painel (`corDoServico`), em hexadecimal. */
export function corDoServicoNaApp(servico: string | null | undefined): string {
  return HEX_DO_PONTO[corDoServico(servico).ponto] ?? "#94A3B8";
}

export const COR_DO_FEITO = "#94A3B8";

function lido(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Os blocos da grelha: os por fazer com dia, e os feitos no dia em que foram
 * feitos. `movidos` são os que ele acabou de arrastar ou marcar, enquanto o
 * site não devolve a lista nova — o bloco fica onde o largou.
 */
export function eventosDaAgenda(lista: Trabalho[], movidos: Readonly<Record<number, string | null>> = {}): EventoDaApp[] {
  const quandoAgora = (t: Trabalho) =>
    t.negociacaoId in movidos ? quandoE({ dataCombinada: movidos[t.negociacaoId], dataAgendada: t.dataAgendada }) : quandoE(t);
  const saida: EventoDaApp[] = [];
  for (const t of porFazerNaAgenda(lista)) {
    const d = lido(quandoAgora(t));
    if (!d) continue;
    saida.push({
      id: t.negociacaoId,
      inicio: noRelogioDeLisboa(d),
      duracaoMin: t.duracaoMinutos ?? DURACAO_PADRAO_MIN,
      titulo: servicoDe(t),
      linha2: t.contactoNome ?? null,
      linha3: t.morada ?? t.city ?? null,
      valor: t.recebeSeFechado,
      cor: corDoServicoNaApp(t.serviceType),
      fixo: false,
    });
  }
  for (const t of feitosNaAgenda(lista)) {
    const d = lido(quandoFoi(t));
    if (!d) continue;
    const estado = ESTADO_DO_FEITO[t.fase] ?? "Feito";
    saida.push({
      id: t.negociacaoId,
      inicio: noRelogioDeLisboa(d),
      duracaoMin: t.duracaoMinutos ?? DURACAO_PADRAO_MIN,
      titulo: `✓ ${servicoDe(t)}`,
      linha2: [estado, t.contactoNome].filter(Boolean).join(" · "),
      linha3: t.morada ?? t.city ?? null,
      valor: t.recebeSeFechado,
      cor: COR_DO_FEITO,
      fixo: true,
    });
  }
  return saida.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** Os por fazer sem dia nenhum — nem combinado, nem pedido pelo cliente. */
export function semDiaNaAgenda(lista: Trabalho[], movidos: Readonly<Record<number, string | null>> = {}): Trabalho[] {
  return porFazerNaAgenda(lista).filter((t) => {
    const combinada = t.negociacaoId in movidos ? movidos[t.negociacaoId] : t.dataCombinada;
    return !quandoE({ dataCombinada: combinada, dataAgendada: t.dataAgendada });
  });
}

/** Os eventos de um dia (no relógio de Lisboa). */
export function doDia(eventos: EventoDaApp[], dia: Date): EventoDaApp[] {
  const chave = chaveDoDia(dia);
  return eventos.filter((e) => chaveDoDia(e.inicio) === chave);
}

/**
 * «Nada marcado nesta semana. Próximo trabalho: sexta-feira, 6 de novembro, às
 * 09:00.» — o próximo por fazer depois do período à vista (`proximoDepois`).
 */
export function proximoTrabalho(eventos: EventoDaApp[], depoisDe: Date): Date | null {
  return proximoDepois(
    eventos.filter((e) => !e.fixo).map((e) => e.inicio),
    depoisDe,
  );
}

/** «2026-10-30T14:30» — o que a rota da agenda grava, em hora de Lisboa. */
export function quandoParaGravar(parede: Date): string {
  return `${chaveDoDia(parede)}T${horaCurta(parede)}`;
}

/**
 * ONDE CAI O TRABALHO ARRASTADO — o dia e a hora, a partir de quanto o dedo
 * andou. Encaixa ao quarto de hora, como no painel, e nunca sai das horas que a
 * grelha mostra; nem do primeiro ao último dia que se vê.
 */
export function largarEm(args: {
  inicio: Date;
  /** Píxeis que o dedo andou para o lado e para baixo. */
  dx: number;
  dy: number;
  larguraDaColuna: number;
  /** Quantos dias tem a vista (1 no dia, 7 na semana) e em que coluna está o trabalho. */
  colunas: number;
  coluna: number;
  janela: { de: number; ate: number };
}): Date {
  const { inicio, dx, dy, larguraDaColuna, colunas, coluna, janela } = args;
  const passos = larguraDaColuna > 0 ? Math.round(dx / larguraDaColuna) : 0;
  const destino = Math.max(0, Math.min(colunas - 1, coluna + passos));
  const minutosAntes = minutosDoDia(inicio);
  const bruto = minutosAntes + (dy / ALTURA_DA_HORA) * 60;
  const encaixado = Math.round(bruto / PASSO_DO_ARRASTO) * PASSO_DO_ARRASTO;
  const minutos = Math.max(janela.de * 60, Math.min(janela.ate * 60 - PASSO_DO_ARRASTO, encaixado));
  return instanteDaChave(chaveDoDia(somarDias(inicio, destino - coluna)), minutos) ?? inicio;
}

/** O número do dia (1 a 31) de uma data da grelha, pelas contas dela. */
export function numeroDoDia(d: Date): number {
  return Number(chaveDoDia(d).slice(8));
}

/** As duas datas da grelha são do mesmo mês? */
export function mesmoMes(a: Date, b: Date): boolean {
  return chaveDoDia(a).slice(0, 7) === chaveDoDia(b).slice(0, 7);
}

/** «Hoje», «Amanhã» ou «Sexta, 30 de outubro» — os títulos da lista do painel (`cabecalhoDoDia`). */
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export function cabecalhoDoDia(instante: Date, agora: Date = new Date()): string {
  const dia = diaEmLisboa(instante);
  const hoje = diaEmLisboa(agora);
  if (dia === hoje) return "Hoje";
  if (dia === somarDiasAoDia(hoje, 1)) return "Amanhã";
  const p = pecasEmLisboa(instante);
  return `${DIAS[p.diaDaSemana]}, ${p.dia} de ${instante.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", month: "long" })}`;
}

export { JANELA_PADRAO };
