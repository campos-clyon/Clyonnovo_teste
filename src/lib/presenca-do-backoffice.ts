/**
 * A PRESENÇA DAS ASSISTENTES NO BACKOFFICE — 31-10-2026 (ordem do CEO e do dono).
 *
 * *«Apenas informação interna, para ter noção do tempo e da produtividade, sem
 * efeito nenhum.»* — o dono. Não é um relógio de ponto: não desconta, não paga,
 * não decide nada. Prepara a plataforma para o dia em que houver mais gente a
 * trabalhar no backoffice. Vale para as contas de assistente; o administrador
 * (o dono) não é contado.
 *
 * O QUE SE GUARDA: só blocos — quando começou e quando acabou um período
 * activo, por pessoa. Nada do que ela vê, das páginas que abre, nem do que
 * escreve. A assistente é informada na conta dela (`FRASE_DA_TRANSPARENCIA`).
 *
 * COMO SE CONTA:
 *   · enquanto a página do backoffice está à vista E houve um clique, uma
 *     tecla, um scroll ou um toque nos últimos `MINUTOS_SEM_INTERACCAO`, o
 *     navegador manda um sinal a cada minuto, a dizer há quanto tempo foi a
 *     última interacção;
 *   · o bloco vai da primeira à ÚLTIMA interacção. Sem interacção há 15
 *     minutos o navegador deixa de enviar, esse tempo não conta, e o bloco fica
 *     fechado na hora dessa última interacção — não na do último sinal;
 *   · se os sinais param pelo meio (o separador escondido, fechado, o
 *     computador desligado), o bloco pára ali — o tempo escondido não conta;
 *   · vários separadores contam uma vez: o bloco é da pessoa e não do
 *     separador, e as contas juntam o que se sobrepõe (`unirBlocos`).
 *
 * AUSÊNCIAS são os vãos de `MINUTOS_SEM_INTERACCAO` ou mais entre dois blocos
 * do mesmo dia. Ao lado de cada uma, a agenda dela: «avisou» (marcou antes),
 * «avisou depois» (marcou já depois de a ausência começar) ou «sem aviso».
 *
 * Tudo em hora de Lisboa. Este ficheiro é PURO (sem base, sem navegador) — é o
 * que se testa.
 */

import type { MarcacaoNova } from "./agenda-das-assistentes";
import { diasDaMarcacao } from "./agenda-das-assistentes";
import {
  diaEmLisboa,
  inicioDoDiaEmLisboa,
  instanteEmLisboa,
  primeiroDoMesEmLisboa,
  primeiroDoMesSeguinte,
  segundaDaSemanaEmLisboa,
  somarDiasAoDia,
} from "./hora-de-lisboa";

/**
 * MINUTOS SEM INTERACÇÃO AO FIM DOS QUAIS O TEMPO DEIXA DE CONTAR — e a partir
 * dos quais um vão entre blocos é uma ausência. O dono quer ir ajustando:
 * muda-se aqui, e só aqui.
 */
export const MINUTOS_SEM_INTERACCAO = 15;
export const LIMITE_DE_INACTIVIDADE_MS = MINUTOS_SEM_INTERACCAO * 60_000;

/** De quanto em quanto tempo o navegador manda o sinal. */
export const INTERVALO_DO_SINAL_MS = 60_000;

/**
 * Dois sinais mais afastados do que isto: a página esteve escondida ou fechada
 * pelo meio, e o bloco não atravessa esse tempo. Minuto e meio de folga sobre o
 * intervalo, para um sinal atrasado ou uma troca rápida de separador não
 * partirem o bloco.
 */
export const SINAIS_SEGUIDOS_MS = 150_000;

/** Um sinal sem nada de novo, no mesmo minuto do anterior, não se grava (vários separadores). */
export const SINAL_REPETIDO_MS = 30_000;

/** O que a assistente lê na conta dela — o dever de informar (RGPD). */
export const FRASE_DA_TRANSPARENCIA =
  "O backoffice regista os períodos em que está activa, só como informação interna.";

// ─── O sinal ─────────────────────────────────────────────────────────────────

export type BlocoNaBase = { inicioEm: Date; fimEm: Date; ultimoSinalEm: Date };

export type SinalDePresenca = {
  /** A hora do servidor quando o sinal chegou. */
  recebidoEm: Date;
  /** Há quanto tempo foi a última interacção, medido no navegador. */
  msDesdeInteraccao: number;
};

export type AccaoDoSinal =
  | { tipo: "nada"; porque: string }
  | { tipo: "estender"; fimEm: Date; ultimoSinalEm: Date }
  | { tipo: "novo"; inicioEm: Date; fimEm: Date; ultimoSinalEm: Date };

/**
 * O QUE UM SINAL FAZ AO ÚLTIMO BLOCO DA PESSOA.
 *
 *   · sem interacção há 15 minutos (ou mais) → nada: esse tempo não conta;
 *   · os sinais vêm seguidos e a interacção está a menos de 15 minutos do fim
 *     do bloco → o bloco estende-se até ela (nunca até ao sinal);
 *   · os sinais pararam pelo meio → o bloco velho fica como estava; uma
 *     interacção nova começa outro.
 */
export function oQueFazerComOSinal(ultimo: BlocoNaBase | null, sinal: SinalDePresenca): AccaoDoSinal {
  const t = sinal.recebidoEm.getTime();
  const ms = Number(sinal.msDesdeInteraccao);
  if (!Number.isFinite(t) || !Number.isFinite(ms)) return { tipo: "nada", porque: "sinal ilegível" };
  if (ms >= LIMITE_DE_INACTIVIDADE_MS) return { tipo: "nada", porque: "sem interacção há 15 minutos" };

  const interaccao = t - Math.max(0, ms);
  const novo = (): AccaoDoSinal => ({
    tipo: "novo",
    inicioEm: new Date(interaccao),
    fimEm: new Date(interaccao),
    ultimoSinalEm: sinal.recebidoEm,
  });
  if (!ultimo) return novo();

  const fim = ultimo.fimEm.getTime();
  const ultimoSinal = ultimo.ultimoSinalEm.getTime();

  if (t - ultimoSinal <= SINAIS_SEGUIDOS_MS) {
    // Os sinais vêm seguidos: a página esteve à vista desde o último.
    if (interaccao - fim >= LIMITE_DE_INACTIVIDADE_MS) return novo();
    if (interaccao <= fim && t - ultimoSinal < SINAL_REPETIDO_MS) {
      return { tipo: "nada", porque: "nada de novo neste minuto" };
    }
    return { tipo: "estender", fimEm: new Date(Math.max(fim, interaccao)), ultimoSinalEm: sinal.recebidoEm };
  }

  // Os sinais pararam pelo meio — a página esteve escondida ou fechada.
  if (interaccao <= fim) return { tipo: "nada", porque: "sem interacção nova desde o fim do bloco" };
  if (interaccao - ultimoSinal <= SINAIS_SEGUIDOS_MS && interaccao - fim < LIMITE_DE_INACTIVIDADE_MS) {
    // A interacção foi antes de a página se esconder (o sinal só chegou agora):
    // fecha o bloco nela, e o tempo escondido continua de fora.
    return { tipo: "estender", fimEm: new Date(interaccao), ultimoSinalEm: new Date(interaccao) };
  }
  return novo();
}

// ─── As contas ───────────────────────────────────────────────────────────────

export type Intervalo = { inicioEm: Date; fimEm: Date };

/** Os blocos por ordem, com os que se sobrepõem (vários separadores) juntos num só. */
export function unirBlocos(blocos: readonly Intervalo[]): Intervalo[] {
  const ordenados = blocos
    .map((b) => ({ inicio: b.inicioEm.getTime(), fim: b.fimEm.getTime() }))
    .filter((b) => Number.isFinite(b.inicio) && Number.isFinite(b.fim))
    .map((b) => ({ inicio: b.inicio, fim: Math.max(b.inicio, b.fim) }))
    .sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
  const saida: Array<{ inicio: number; fim: number }> = [];
  for (const b of ordenados) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && b.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, b.fim);
    else saida.push({ ...b });
  }
  return saida.map((b) => ({ inicioEm: new Date(b.inicio), fimEm: new Date(b.fim) }));
}

/** O que dos blocos (já unidos) cai entre dois instantes, cortado nas pontas. */
export function blocosEntre(unidos: readonly Intervalo[], de: Date, ate: Date): Intervalo[] {
  const a = de.getTime();
  const b = ate.getTime();
  const saida: Intervalo[] = [];
  for (const x of unidos) {
    const i = x.inicioEm.getTime();
    const f = x.fimEm.getTime();
    if (i >= b) continue;
    if (i < a && f <= a) continue;
    saida.push({ inicioEm: new Date(Math.max(i, a)), fimEm: new Date(Math.min(f, b)) });
  }
  return saida;
}

/** Os segundos activos entre dois instantes. */
export function segundosEntre(unidos: readonly Intervalo[], de: Date, ate: Date): number {
  const ms = blocosEntre(unidos, de, ate).reduce((s, x) => s + (x.fimEm.getTime() - x.inicioEm.getTime()), 0);
  return Math.round(ms / 1000);
}

/** O início do dia de Lisboa e o do dia seguinte. */
export function limitesDoDia(dia: string): { de: Date; ate: Date } {
  return { de: inicioDoDiaEmLisboa(dia), ate: inicioDoDiaEmLisboa(somarDiasAoDia(dia, 1)) };
}

/** Os vãos de `limiteMs` ou mais entre blocos seguidos (já unidos e do mesmo dia). */
export function vaosEntreBlocos(doDia: readonly Intervalo[], limiteMs = LIMITE_DE_INACTIVIDADE_MS): Intervalo[] {
  const saida: Intervalo[] = [];
  for (let i = 1; i < doDia.length; i++) {
    const de = doDia[i - 1].fimEm;
    const ate = doDia[i].inicioEm;
    if (ate.getTime() - de.getTime() >= limiteMs) saida.push({ inicioEm: de, fimEm: ate });
  }
  return saida;
}

/** O pedaço de um dia que a marcação cobre, em instantes; `null` se não o cobre. */
export function intervaloDaMarcacaoNoDia(m: MarcacaoNova, dia: string): Intervalo | null {
  if (dia < m.deDia || dia > m.ateDia) return null;
  const { de, ate } = limitesDoDia(dia);
  if (m.tipo !== "parte") return { inicioEm: de, fimEm: ate };
  const inicio = m.deHora ? instanteEmLisboa(`${dia}T${m.deHora}`) : null;
  if (!inicio) return null;
  const fim = m.ateHora ? instanteEmLisboa(`${dia}T${m.ateHora}`) : ate;
  return fim && fim.getTime() > inicio.getTime() ? { inicioEm: inicio, fimEm: fim } : null;
}

export type Aviso = "avisou" | "avisou_depois" | "sem_aviso";

export const ROTULO_DO_AVISO: Record<Aviso, string> = {
  avisou: "avisou",
  avisou_depois: "avisou depois",
  sem_aviso: "sem aviso",
};

type MarcacaoComRegisto = MarcacaoNova & { id: number; criadaEm: string };

/** A ausência estava na agenda? E foi marcada antes de começar, ou já depois? */
export function avisoDoVao(
  vao: Intervalo,
  dia: string,
  marcacoes: readonly MarcacaoComRegisto[],
): { aviso: Aviso; marcacaoId: number | null } {
  let depois: number | null = null;
  for (const m of marcacoes) {
    const i = intervaloDaMarcacaoNoDia(m, dia);
    if (!i) continue;
    const toca = i.inicioEm.getTime() < vao.fimEm.getTime() && i.fimEm.getTime() > vao.inicioEm.getTime();
    if (!toca) continue;
    const marcadaEm = Date.parse(m.criadaEm);
    if (Number.isFinite(marcadaEm) && marcadaEm <= vao.inicioEm.getTime()) return { aviso: "avisou", marcacaoId: m.id };
    if (depois == null) depois = m.id;
  }
  return depois != null ? { aviso: "avisou_depois", marcacaoId: depois } : { aviso: "sem_aviso", marcacaoId: null };
}

export type BlocoDoDia = { de: string; ate: string; segundos: number };
export type AusenciaDoDia = { de: string; ate: string; minutos: number; aviso: Aviso; marcacaoId: number | null };
export type DiaDaPresenca = {
  dia: string;
  segundos: number;
  blocos: BlocoDoDia[];
  ausencias: AusenciaDoDia[];
  /** As marcações da agenda que tocam este dia. */
  marcacoes: number[];
};

/** Um dia de Lisboa: os blocos, as ausências entre eles e as marcações da agenda. */
export function diaDaPresenca(
  dia: string,
  unidos: readonly Intervalo[],
  marcacoes: readonly MarcacaoComRegisto[],
): DiaDaPresenca {
  const { de, ate } = limitesDoDia(dia);
  const doDia = blocosEntre(unidos, de, ate);
  const segundos = (x: Intervalo) => Math.round((x.fimEm.getTime() - x.inicioEm.getTime()) / 1000);
  return {
    dia,
    segundos: doDia.reduce((s, x) => s + segundos(x), 0),
    blocos: doDia.map((x) => ({ de: x.inicioEm.toISOString(), ate: x.fimEm.toISOString(), segundos: segundos(x) })),
    ausencias: vaosEntreBlocos(doDia).map((v) => ({
      de: v.inicioEm.toISOString(),
      ate: v.fimEm.toISOString(),
      minutos: Math.round((v.fimEm.getTime() - v.inicioEm.getTime()) / 60_000),
      ...avisoDoVao(v, dia, marcacoes),
    })),
    marcacoes: marcacoes.filter((m) => diasDaMarcacao(m).includes(dia)).map((m) => m.id),
  };
}

export function mesValido(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Os dias de um mês (`AAAA-MM`), por ordem. */
export function diasDoMes(mes: string): string[] {
  const dias: string[] = [];
  const fim = primeiroDoMesSeguinte(`${mes}-01`);
  for (let d = `${mes}-01`; d < fim; d = somarDiasAoDia(d, 1)) dias.push(d);
  return dias;
}

/** As segundas-feiras das semanas que tocam o mês. */
export function segundasDoMes(mes: string): string[] {
  const fim = primeiroDoMesSeguinte(`${mes}-01`);
  const segundas: string[] = [];
  for (let s = segundaDaSemanaEmLisboa(inicioDoDiaEmLisboa(`${mes}-01`)); s < fim; s = somarDiasAoDia(s, 7)) {
    segundas.push(s);
  }
  return segundas;
}

/** De que dia a que dia (o fim exclusivo) há que ler blocos para o resumo de um mês e para os totais de hoje. */
export function diasALer(mes: string, agora: Date): { deDia: string; ateDia: string } {
  const segundas = segundasDoMes(mes);
  const hoje = diaEmLisboa(agora);
  const menor = (l: string[]) => l.reduce((a, b) => (b < a ? b : a));
  const maior = (l: string[]) => l.reduce((a, b) => (b > a ? b : a));
  return {
    deDia: menor([segundas[0], segundaDaSemanaEmLisboa(agora), primeiroDoMesEmLisboa(agora)]),
    ateDia: maior([
      somarDiasAoDia(segundas[segundas.length - 1], 7),
      somarDiasAoDia(segundaDaSemanaEmLisboa(agora), 7),
      primeiroDoMesSeguinte(primeiroDoMesEmLisboa(agora)),
      somarDiasAoDia(hoje, 1),
    ]),
  };
}

export type ResumoDaPresenca = {
  /** Hoje, esta semana (desde segunda) e este mês — contados no relógio de Lisboa. */
  totais: { hoje: number; semana: number; mes: number };
  /** Activa agora: os sinais estão a chegar e houve interacção há menos de 15 minutos. */
  activaAgora: boolean;
  /** O mês pedido, dia a dia. */
  dias: DiaDaPresenca[];
  semanas: Array<{ segunda: string; segundos: number }>;
  totalDoMes: number;
};

export function resumoDaPresenca(args: {
  blocos: readonly BlocoNaBase[];
  marcacoes: readonly MarcacaoComRegisto[];
  mes: string;
  agora: Date;
}): ResumoDaPresenca {
  const { mes, agora } = args;
  const unidos = unirBlocos(args.blocos);
  const hoje = diaEmLisboa(agora);
  const segunda = segundaDaSemanaEmLisboa(agora);
  const primeiro = primeiroDoMesEmLisboa(agora);
  const entre = (deDia: string, ateDia: string) =>
    segundosEntre(unidos, inicioDoDiaEmLisboa(deDia), inicioDoDiaEmLisboa(ateDia));

  const ultimo = [...args.blocos].sort((a, b) => b.ultimoSinalEm.getTime() - a.ultimoSinalEm.getTime())[0];
  const activaAgora = Boolean(
    ultimo &&
      agora.getTime() - ultimo.ultimoSinalEm.getTime() <= SINAIS_SEGUIDOS_MS &&
      agora.getTime() - ultimo.fimEm.getTime() < LIMITE_DE_INACTIVIDADE_MS,
  );

  return {
    totais: {
      hoje: entre(hoje, somarDiasAoDia(hoje, 1)),
      semana: entre(segunda, somarDiasAoDia(segunda, 7)),
      mes: entre(primeiro, primeiroDoMesSeguinte(primeiro)),
    },
    activaAgora,
    dias: diasDoMes(mes).map((d) => diaDaPresenca(d, unidos, args.marcacoes)),
    semanas: segundasDoMes(mes).map((s) => ({ segunda: s, segundos: entre(s, somarDiasAoDia(s, 7)) })),
    totalDoMes: entre(`${mes}-01`, primeiroDoMesSeguinte(`${mes}-01`)),
  };
}

/** «0 min», «45 min», «3 h», «3 h 05 min». */
export function duracaoEscrita(segundos: number): string {
  const minutos = Math.max(0, Math.round(segundos / 60));
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}
