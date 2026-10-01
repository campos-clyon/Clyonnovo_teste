/**
 * OS FILTROS DOS PAGAMENTOS — por profissional, por datas, e como se agrupa.
 *
 * *«Corrija a secção pagamentos, coloque filtros para ser mais fácil de
 * identificar, separe por profissional e datas.»* — 01-10-2026.
 *
 * O gestor tinha uma busca de texto e quatro separadores. Com 29 trabalhos por
 * receber e 48 pagos aos pros numa coluna só, encontrar «o que o Revolution
 * recebeu em Setembro» era ler a lista inteira.
 *
 * PURO, para se testar sem ecrã: as contas das datas são as que mais se
 * enganam (meia-noite, mês anterior, o último dia do intervalo), e um filtro
 * que esconde um pagamento em silêncio é pior do que não haver filtro.
 */

import {
  diaEmLisboa,
  hojeOuOntem,
  instanteEmLisboa,
  pecasEmLisboa,
  somarDiasAoDia,
} from "./hora-de-lisboa";

/** Os quatro separadores do gestor — a mesma união que o ecrã usa. */
export type SeparadorDoDinheiro = "por_receber" | "recebidos" | "por_pagar" | "pagos";

/** O que cada linha tem de datas. */
export type DatasDoTrabalho = {
  /** O dia do trabalho: o combinado, ou o pedido, ou o dia em que foi dado por feito. */
  dataDoTrabalho: string | null;
  clientePagouEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
};

/**
 * A DATA QUE CONTA EM CADA SEPARADOR.
 *
 * Cada separador responde a uma pergunta diferente, e cada pergunta tem a sua
 * data: o que entrou em Setembro filtra-se pelo dia em que entrou, e o que se
 * transferiu em Setembro pelo dia da transferência. Filtrar tudo pela data do
 * trabalho daria «pagos em Setembro» a trabalhos feitos em Agosto e
 * transferidos em Outubro — uma lista que não bate com o extracto do banco.
 *
 * O que ainda não aconteceu (por receber, por pagar) não tem data de dinheiro:
 * aí conta o dia do trabalho.
 */
export function dataDeReferencia(t: DatasDoTrabalho, s: SeparadorDoDinheiro): string | null {
  switch (s) {
    case "por_receber":
      return t.dataDoTrabalho;
    case "recebidos":
      return t.clientePagouEm ?? t.dataDoTrabalho;
    case "por_pagar":
      return t.confirmadoEm ?? t.dataDoTrabalho;
    case "pagos":
      return t.pagoEm ?? t.dataDoTrabalho;
  }
}

/** Para o ecrã dizer por que data está a filtrar — sem isto, o filtro é uma adivinha. */
export const NOME_DA_DATA: Record<SeparadorDoDinheiro, string> = {
  por_receber: "pela data do trabalho",
  recebidos: "pela data em que o cliente pagou",
  por_pagar: "pela data em que o trabalho foi confirmado",
  pagos: "pela data da transferência ao profissional",
};

export type Periodo = "todos" | "hoje" | "ontem" | "7dias" | "este_mes" | "mes_passado" | "entre";

export const PERIODOS: ReadonlyArray<{ id: Periodo; rotulo: string }> = [
  { id: "todos", rotulo: "Qualquer data" },
  { id: "hoje", rotulo: "Hoje" },
  { id: "ontem", rotulo: "Ontem" },
  { id: "7dias", rotulo: "Últimos 7 dias" },
  { id: "este_mes", rotulo: "Este mês" },
  { id: "mes_passado", rotulo: "Mês passado" },
  { id: "entre", rotulo: "Entre datas…" },
];

export function periodoValido(v: unknown): v is Periodo {
  return PERIODOS.some((p) => p.id === v);
}

/*
 * OS DIAS SÃO OS DE LISBOA — 01-10-2026.
 *
 * *«Deve estar sempre no horário de Lisboa, independente de onde o admin
 * esteja.»* Contava-se pelo relógio do computador: do Brasil, «hoje» acabava
 * às 4h da manhã de Lisboa. Os dias são `YYYY-MM-DD` de Lisboa, e as
 * fronteiras são instantes verdadeiros — a meia-noite de Lisboa de cada um.
 */
const meiaNoiteDe = (dia: string) => instanteEmLisboa(`${dia}T00:00`)!;

/** O primeiro dia do mês de `dia`, mais `n` meses. */
function primeiroDoMes(dia: string, n: number): string {
  const [a, m] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 10);
}

/** «2026-09-28» de um `<input type="date">` — ou null. */
function diaDoCampo(v: string | null | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return instanteEmLisboa(`${v}T00:00`) ? v : null;
}

/**
 * O intervalo de um período: `de` incluído, `ate` EXCLUÍDO — sempre à
 * meia-noite, pelo calendário e não por 24 horas, para não tropeçar na mudança
 * da hora.
 *
 * «Entre datas» inclui o último dia escolhido inteiro: quem escreve «até 30 de
 * Setembro» está a contar com o dia 30, e um `ate` às 00:00 do dia 30
 * deixava-o de fora.
 *
 * `null` quer dizer «sem filtro».
 */
export function intervaloDoPeriodo(
  p: Periodo,
  agora: Date,
  entre?: { de?: string | null; ate?: string | null },
): { de: Date; ate: Date } | null {
  const hoje = diaEmLisboa(agora);
  const dias = (de: string, ate: string) => ({ de: meiaNoiteDe(de), ate: meiaNoiteDe(ate) });
  switch (p) {
    case "todos":
      return null;
    case "hoje":
      return dias(hoje, somarDiasAoDia(hoje, 1));
    case "ontem":
      return dias(somarDiasAoDia(hoje, -1), hoje);
    case "7dias":
      return dias(somarDiasAoDia(hoje, -6), somarDiasAoDia(hoje, 1));
    case "este_mes":
      return dias(primeiroDoMes(hoje, 0), primeiroDoMes(hoje, 1));
    case "mes_passado":
      return dias(primeiroDoMes(hoje, -1), primeiroDoMes(hoje, 0));
    case "entre": {
      const de = diaDoCampo(entre?.de);
      const ateDia = diaDoCampo(entre?.ate);
      if (!de && !ateDia) return null;
      return {
        de: de ? meiaNoiteDe(de) : new Date(0),
        ate: ateDia ? meiaNoiteDe(somarDiasAoDia(ateDia, 1)) : new Date(Date.UTC(9999, 0, 1)),
      };
    }
  }
}

export function dentroDoIntervalo(iso: string | null, intervalo: { de: Date; ate: Date } | null): boolean {
  if (!intervalo) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= intervalo.de.getTime() && t < intervalo.ate.getTime();
}

export type Agrupamento = "profissional" | "dia" | "nada";

export const AGRUPAMENTOS: ReadonlyArray<{ id: Agrupamento; rotulo: string }> = [
  { id: "profissional", rotulo: "Profissional" },
  { id: "dia", rotulo: "Dia" },
  { id: "nada", rotulo: "Nada" },
];

export function agrupamentoValido(v: unknown): v is Agrupamento {
  return v === "profissional" || v === "dia" || v === "nada";
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** «Quarta, 30 de setembro» — e «Hoje» e «Ontem», que se lêem mais depressa. */
export function tituloDoDia(d: Date, agora: Date): string {
  const qual = hojeOuOntem(d, agora);
  if (qual === "hoje") return "Hoje";
  if (qual === "ontem") return "Ontem";
  const p = pecasEmLisboa(d);
  const nome = DIAS[p.diaDaSemana];
  const ano = p.ano !== pecasEmLisboa(agora).ano ? ` de ${p.ano}` : "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}, ${p.dia} de ${MESES[p.mes - 1]}${ano}`;
}

export type Grupo<T> = { chave: string; titulo: string; linhas: T[] };

/**
 * SEPARAR A LISTA — por profissional, por dia, ou não separar.
 *
 * Por PROFISSIONAL, pelo nome, de A a Z — é como se paga: uma transferência a
 * cada um. Por DIA, do mais recente para trás — é como se lê o extracto do
 * banco. Os que não têm data vão para um grupo «Sem data» no fim, e nunca
 * desaparecem.
 *
 * Dentro de cada grupo, a ordem que já trazia mantém-se.
 */
export function agrupar<T>(
  linhas: readonly T[],
  modo: Agrupamento,
  como: {
    profissional: (t: T) => { id: number; nome: string };
    data: (t: T) => string | null;
  },
  agora: Date,
): Grupo<T>[] {
  if (modo === "nada") return [{ chave: "todos", titulo: "", linhas: [...linhas] }];

  const grupos = new Map<string, Grupo<T> & { ordem: string | number }>();
  for (const t of linhas) {
    let chave: string;
    let titulo: string;
    let ordem: string | number;
    if (modo === "profissional") {
      const p = como.profissional(t);
      chave = `p${p.id}`;
      titulo = p.nome || `Profissional #${p.id}`;
      ordem = titulo.toLocaleLowerCase("pt");
    } else {
      const iso = como.data(t);
      const d = iso ? new Date(iso) : null;
      if (!d || Number.isNaN(d.getTime())) {
        chave = "sem-data";
        titulo = "Sem data";
        ordem = -Infinity;
      } else {
        const dia = diaEmLisboa(d);
        chave = `d${dia}`;
        titulo = tituloDoDia(d, agora);
        ordem = Date.parse(`${dia}T00:00:00Z`);
      }
    }
    const g = grupos.get(chave) ?? { chave, titulo, linhas: [], ordem };
    g.linhas.push(t);
    grupos.set(chave, g);
  }

  const lista = [...grupos.values()];
  if (modo === "profissional") {
    lista.sort((a, b) => String(a.ordem).localeCompare(String(b.ordem), "pt"));
  } else {
    lista.sort((a, b) => Number(b.ordem) - Number(a.ordem));
  }
  return lista.map(({ chave, titulo, linhas: l }) => ({ chave, titulo, linhas: l }));
}
