/**
 * OS TRABALHOS NO CALENDÁRIO, E SE ESTÃO A HORAS.
 *
 * "Quero uma agenda para o admin acompanhar as datas e horários dos trabalhos,
 * para saber se os trabalhos estão no horário ou não. Também deve ter a opção
 * do pro corrigir a sua agenda, podendo alterar horário e data."
 *
 * A mesa das negociações responde «quem está à espera de quem». Não responde à
 * outra pergunta, que é a que faz o telefone tocar: QUANDO. Um trabalho fechado
 * a 20 de agosto para o dia 22 aparecia em «Contratados» exactamente igual a um
 * fechado ontem para o mês que vem — e o que passou do dia sem ninguém lá ir
 * não se distinguia de nenhum dos outros.
 *
 * DUAS DATAS, E NÃO UMA
 *
 * `dataAgendada` é o que o CLIENTE pediu, e fica como está: é a promessa que
 * lhe foi feita. `dataCombinada` é o que os dois marcaram DEPOIS de fechar o
 * negócio, e é a que manda na agenda. Guardar as duas é o que permite ver que
 * um trabalho pedido para quinta acabou combinado para sábado — informação que
 * se perderia se a segunda escrevesse por cima da primeira.
 */

const TZ = "Europe/Lisbon";

export type EstadoNaAgenda =
  /** Contratado e sem dia nenhum marcado. É o que precisa de um telefonema. */
  | "sem_data"
  /** O dia passou e ninguém deu o trabalho por feito. */
  | "atrasado"
  /** É hoje. */
  | "hoje"
  /** Ainda vem. */
  | "por_vir"
  /** Já foi feito — a prova está enviada, confirmada ou paga. */
  | "feito";

export type TrabalhoNaAgenda = {
  /** O que os dois marcaram depois de fechar. Manda sempre. */
  dataCombinada?: string | Date | null;
  /** O que o cliente pediu. Serve de recurso quando não se combinou nada. */
  dataAgendada?: string | Date | null;
  execucaoEnviadaEm?: string | Date | null;
  confirmadoEm?: string | Date | null;
  pagoEm?: string | Date | null;
};

export type NaAgenda = {
  estado: EstadoNaAgenda;
  /** O instante que conta, já escolhido entre as duas datas. */
  quando: Date | null;
  /** De onde saiu: o que se combinou, ou o que o cliente tinha pedido. */
  origem: "combinada" | "do_cliente" | "nenhuma";
  /** Dias de atraso, contados em dias de calendário. Zero quando não há. */
  diasDeAtraso: number;
  /**
   * É hoje E a hora já passou.
   *
   * Não é «atrasado» — um trabalho das 9h às 15h da tarde pode estar a
   * decorrer, e a prova chega quase sempre ao fim do dia. Mas é o que ele quer
   * ver quando pergunta «isto está a andar?».
   */
  horaJaPassou: boolean;
};

function paraData(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** O dia civil em Lisboa, "2026-08-29": o mesmo dia para toda a gente. */
function diaCivil(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Quantos dias de calendário separam dois instantes, contados em Lisboa. */
export function diasEntre(de: Date, para: Date): number {
  const a = Date.parse(`${diaCivil(de)}T00:00:00Z`);
  const b = Date.parse(`${diaCivil(para)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Onde é que este trabalho está, no tempo.
 *
 * `agora` é parâmetro para os testes poderem escolher o dia; em produção não
 * se passa.
 */
export function naAgenda(t: TrabalhoNaAgenda, agora: Date = new Date()): NaAgenda {
  const combinada = paraData(t.dataCombinada);
  const doCliente = paraData(t.dataAgendada);
  const quando = combinada ?? doCliente;
  const origem: NaAgenda["origem"] = combinada
    ? "combinada"
    : doCliente
      ? "do_cliente"
      : "nenhuma";

  /*
   * FEITO GANHA A TUDO O RESTO.
   *
   * Um trabalho entregue no dia seguinte ao marcado está feito, e não
   * atrasado: pintá-lo de vermelho para sempre seria transformar o histórico
   * numa lista de queixas. O atraso interessa enquanto há alguma coisa a
   * fazer com ele.
   */
  const feito = Boolean(t.execucaoEnviadaEm || t.confirmadoEm || t.pagoEm);
  if (feito) {
    return { estado: "feito", quando, origem, diasDeAtraso: 0, horaJaPassou: false };
  }

  if (!quando) {
    return { estado: "sem_data", quando: null, origem, diasDeAtraso: 0, horaJaPassou: false };
  }

  const dias = diasEntre(agora, quando);
  if (dias < 0) {
    return {
      estado: "atrasado",
      quando,
      origem,
      diasDeAtraso: -dias,
      horaJaPassou: true,
    };
  }
  if (dias === 0) {
    return {
      estado: "hoje",
      quando,
      origem,
      diasDeAtraso: 0,
      horaJaPassou: quando.getTime() < agora.getTime(),
    };
  }
  return { estado: "por_vir", quando, origem, diasDeAtraso: 0, horaJaPassou: false };
}

/**
 * A ordem por que se olha para isto.
 *
 * Atrasado primeiro, depois hoje, depois sem data, depois o que vem aí, e por
 * fim o que já está feito. Não é alfabética nem cronológica: é por quem precisa
 * de um telefonema mais depressa.
 *
 * «Sem data» vem a seguir a «hoje» e não no fim, de propósito: um trabalho
 * contratado sem dia marcado é um atraso que ainda não começou a contar.
 */
export const PESO_NA_AGENDA: Record<EstadoNaAgenda, number> = {
  atrasado: 0,
  hoje: 1,
  sem_data: 2,
  por_vir: 3,
  feito: 4,
};

export const ETIQUETA: Record<EstadoNaAgenda, string> = {
  atrasado: "Atrasado",
  hoje: "Hoje",
  sem_data: "Sem data",
  por_vir: "Por vir",
  feito: "Feito",
};

/** "há 3 dias", "hoje às 11:00", "sexta, 4 de setembro". */
export function quandoPorExtenso(a: NaAgenda, agora: Date = new Date()): string {
  if (!a.quando) return "sem dia marcado";
  const hora = new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(a.quando);
  /* Meia-noite é o que sobra de um dia gravado sem hora — não é uma hora. */
  const comHora = hora !== "00:00" && hora !== "24:00" ? `, às ${hora}` : "";

  const dias = diasEntre(agora, a.quando);
  if (dias === 0) return `hoje${comHora}`;
  if (dias === 1) return `amanhã${comHora}`;
  if (dias === -1) return `ontem${comHora}`;
  const dia = new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(a.quando);
  return `${dia}${comHora}`;
}

/**
 * As cores de cada estado, na paleta escura do backoffice.
 *
 * O atraso é o único a vermelho. Se os cinco tivessem cor, nenhum se via — e o
 * ecrã existe precisamente para o vermelho saltar.
 */
export const CORES: Record<EstadoNaAgenda, string> = {
  atrasado: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  hoje: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  sem_data: "border-slate-600 bg-slate-800 text-slate-300",
  por_vir: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  feito: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

/**
 * A DATA PARA DENTRO DE UM CAMPO `datetime-local`, EM HORA DE LISBOA.
 *
 * O campo não fala fusos: escreve-se-lhe "2026-08-31T09:30" e ele mostra
 * 09:30, seja onde for que a pessoa esteja. Toda a agenda — as etiquetas, o
 * «hoje às 09:00», o atraso — é lida em Lisboa, porque é lá que o trabalho
 * acontece. O campo tinha de ser lido no mesmo sítio.
 *
 * A ARMADILHA, e apanhou-se num ecrã: `d.getHours()` dá a hora do RELÓGIO DE
 * QUEM ESTÁ A OLHAR. Num portátil em Paris, o mesmo trabalho aparecia às 08:30
 * no rótulo e às 09:30 no campo logo por baixo — e bastava carregar em Guardar
 * sem lhe tocar para o adiantar uma hora a sério. `toISOString().slice(0,16)`
 * tem o defeito simétrico: dá Greenwich, e atrasa-o uma.
 */
export function paraOCampoDeData(v: string | Date | null | undefined): string {
  const d = paraData(v ?? null);
  if (!d) return "";
  // `sv-SE` dá "2026-08-31 09:30" — a forma ISO, que é a única que este campo lê.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(" ", "T");
}

/** Quanto é que Lisboa está à frente de Greenwich NAQUELE instante, em ms. */
function desvioDeLisboa(d: Date): number {
  const comoSeFosseUtc = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(" ", "T");
  return Date.parse(`${comoSeFosseUtc}Z`) - d.getTime();
}

/**
 * O CAMINHO DE VOLTA: o que está escrito no campo é hora de Lisboa.
 *
 * "2026-08-31T09:30" quer dizer nove e meia da manhã em Portugal. Mandá-lo em
 * cru para o servidor deixava a interpretação ao fuso de quem o lesse — o
 * browser lia-o no relógio da pessoa, o Node da Vercel lia-o em Greenwich, e
 * nenhum dos dois é Lisboa. Aqui fecha-se a questão: sai daqui um instante
 * exacto, e é esse que viaja.
 *
 * DUAS PASSAGENS por causa das mudanças da hora. Nas madrugadas de março e de
 * outubro o desvio antes e depois da conversão não é o mesmo, e uma passagem
 * só deixava lá uma hora de erro no único fim-de-semana do ano em que ninguém
 * ia desconfiar dela.
 */
export function doCampoParaInstante(local: string): Date | null {
  const t = local.trim();
  if (!t) return null;
  const comoSeFosseUtc = Date.parse(`${t}${t.length === 16 ? ":00" : ""}Z`);
  if (Number.isNaN(comoSeFosseUtc)) return null;
  const primeiro = new Date(comoSeFosseUtc - desvioDeLisboa(new Date(comoSeFosseUtc)));
  const segundo = new Date(comoSeFosseUtc - desvioDeLisboa(primeiro));
  return segundo;
}
