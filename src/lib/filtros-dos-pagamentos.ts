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

const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** «2026-09-28» de um `<input type="date">`, na hora local — ou null. */
function diaDoCampo(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
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
  const hoje = meiaNoite(agora);
  switch (p) {
    case "todos":
      return null;
    case "hoje":
      return { de: hoje, ate: somarDias(hoje, 1) };
    case "ontem":
      return { de: somarDias(hoje, -1), ate: hoje };
    case "7dias":
      return { de: somarDias(hoje, -6), ate: somarDias(hoje, 1) };
    case "este_mes":
      return {
        de: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
        ate: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1),
      };
    case "mes_passado":
      return {
        de: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
        ate: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
      };
    case "entre": {
      const de = diaDoCampo(entre?.de);
      const ateDia = diaDoCampo(entre?.ate);
      if (!de && !ateDia) return null;
      return {
        de: de ?? new Date(1970, 0, 1),
        ate: ateDia ? somarDias(ateDia, 1) : new Date(9999, 0, 1),
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
  const hoje = meiaNoite(agora).getTime();
  const dia = meiaNoite(d).getTime();
  if (dia === hoje) return "Hoje";
  if (dia === somarDias(meiaNoite(agora), -1).getTime()) return "Ontem";
  const nome = DIAS[d.getDay()];
  const ano = d.getFullYear() !== agora.getFullYear() ? ` de ${d.getFullYear()}` : "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}${ano}`;
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
        const dia = meiaNoite(d);
        chave = `d${dia.getTime()}`;
        titulo = tituloDoDia(dia, agora);
        ordem = dia.getTime();
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
