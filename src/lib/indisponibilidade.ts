/**
 * QUANDO O PROFISSIONAL NÃO PODE TRABALHAR — d35, 15-11-2026.
 *
 * O profissional marca na agenda os dias (ou as horas de um dia) em que não
 * pode trabalhar. Três formas, todas em hora de Lisboa:
 *   · um dia inteiro             { dia }
 *   · vários dias seguidos       { dia, ate }
 *   · um intervalo de horas      { dia, inicio, fim }  (no mesmo dia)
 *
 * Guarda-se como um intervalo de instantes [inicioEm, fimEm) — o fim não conta
 * — e `diaInteiro`. As contas de dia e hora fazem-se aqui, com
 * `hora-de-lisboa.ts`: um dia inteiro começa e acaba à meia-noite de LISBOA,
 * seja onde for que o servidor ou o telemóvel estejam.
 *
 * O QUE FAZ À DISTRIBUIÇÃO DE PEDIDOS NOVOS (`cruzarComOPedido`):
 *   · data certa (dia e hora, ou só o dia) que cai num período indisponível →
 *     o pedido NÃO vai a esse profissional;
 *   · data vaga («esta semana», «na próxima semana», sem data) → vai, com a
 *     nota «tem indisponibilidade nesses dias»;
 *   · no backoffice nunca bloqueia: diz «indisponível neste dia».
 *
 * Este ficheiro é puro (sem base), para se poder testar e para a app Pro poder
 * seguir as mesmas regras pela API.
 */
import { diaEmLisboa, instanteEmLisboa, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";

/** Quantos dias seguidos se podem marcar de uma vez. */
export const MAXIMO_DE_DIAS_SEGUIDOS = 60;
/** Até quando se pode marcar (dias a partir de hoje). */
export const DIAS_PARA_A_FRENTE = 365;
/** Quanto tempo se conta para um trabalho com hora marcada, quando não se sabe a duração. */
export const DURACAO_DO_TRABALHO_MIN = 120;
/** A janela de um pedido sem data nenhuma: os próximos dias. */
export const DIAS_DE_UM_PEDIDO_SEM_DATA = 14;
/** O tamanho máximo da nota. */
export const NOTA_MAXIMA = 200;

/** A frase que o profissional vê num pedido de data vaga que cruza com uma indisponibilidade. */
export const NOTA_DA_DATA_VAGA = "Tem indisponibilidade nesses dias.";
/** A frase do backoffice — informa, não bloqueia. */
export const INDISPONIVEL_NESTE_DIA = "indisponível neste dia";
/** A pergunta do painel quando se marca em cima de um trabalho já marcado. */
export const PERGUNTA_COM_TRABALHO_MARCADO =
  "Tem trabalho marcado nesse período. Marca na mesma como indisponível? O trabalho continua marcado — fale com o cliente se for preciso mudar o dia.";

export type Indisponibilidade = {
  id: number;
  providerId: number;
  inicioEm: Date;
  /** Exclusivo: às 00:00 do dia a seguir, num dia inteiro. */
  fimEm: Date;
  diaInteiro: boolean;
  nota: string | null;
};

/** O que se pede para marcar (o corpo do POST). */
export type PedidoDeIndisponibilidade = {
  dia?: unknown;
  ate?: unknown;
  inicio?: unknown;
  fim?: unknown;
  nota?: unknown;
};

export type IndisponibilidadeLida = {
  inicioEm: Date;
  fimEm: Date;
  diaInteiro: boolean;
  nota: string | null;
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function diaValido(v: unknown): string | null {
  if (typeof v !== "string" || !DIA.test(v.trim())) return null;
  const d = v.trim();
  // 2026-02-30 não existe: somar zero dias devolve outro dia.
  return somarDiasAoDia(d, 0) === d ? d : null;
}

function horaValida(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const h = v.trim();
  return HORA.test(h) ? h : null;
}

/**
 * Lê e valida o que o profissional quer marcar. Recusa datas passadas (hoje
 * pode-se), mais de 60 dias seguidos, mais de um ano para a frente, e horas
 * sem sentido.
 */
export function lerIndisponibilidade(
  p: PedidoDeIndisponibilidade,
  agora: Date = new Date(),
): { ok: true; valor: IndisponibilidadeLida } | { ok: false; erro: string } {
  const dia = diaValido(p.dia);
  if (!dia) return { ok: false, erro: "Indique o dia (AAAA-MM-DD)." };
  const hoje = diaEmLisboa(agora);
  if (dia < hoje) return { ok: false, erro: "Esse dia já passou." };
  if (dia > somarDiasAoDia(hoje, DIAS_PARA_A_FRENTE)) {
    return { ok: false, erro: "Só se marca até um ano para a frente." };
  }
  const nota = typeof p.nota === "string" && p.nota.trim() ? p.nota.trim().slice(0, NOTA_MAXIMA) : null;

  const temHoras = p.inicio != null && p.inicio !== "" ? true : p.fim != null && p.fim !== "";
  if (temHoras) {
    const inicio = horaValida(p.inicio);
    const fim = horaValida(p.fim);
    if (!inicio || !fim) return { ok: false, erro: "Indique a hora de início e a de fim (HH:MM)." };
    if (p.ate != null && p.ate !== "" && diaValido(p.ate) !== dia) {
      return { ok: false, erro: "Um intervalo de horas é num dia só." };
    }
    if (fim <= inicio) return { ok: false, erro: "A hora de fim tem de ser depois da de início." };
    const inicioEm = instanteEmLisboa(`${dia}T${inicio}`);
    const fimEm = instanteEmLisboa(`${dia}T${fim}`);
    if (!inicioEm || !fimEm) return { ok: false, erro: "As horas não são válidas." };
    if (fimEm.getTime() <= agora.getTime()) return { ok: false, erro: "Essas horas já passaram." };
    return { ok: true, valor: { inicioEm, fimEm, diaInteiro: false, nota } };
  }

  const ate = p.ate != null && p.ate !== "" ? diaValido(p.ate) : dia;
  if (!ate) return { ok: false, erro: "Indique o último dia (AAAA-MM-DD)." };
  if (ate < dia) return { ok: false, erro: "O último dia tem de ser depois do primeiro." };
  if (ate > somarDiasAoDia(dia, MAXIMO_DE_DIAS_SEGUIDOS - 1)) {
    return { ok: false, erro: `No máximo ${MAXIMO_DE_DIAS_SEGUIDOS} dias seguidos de cada vez.` };
  }
  const inicioEm = instanteEmLisboa(`${dia}T00:00`);
  const fimEm = instanteEmLisboa(`${somarDiasAoDia(ate, 1)}T00:00`);
  if (!inicioEm || !fimEm) return { ok: false, erro: "O dia não é válido." };
  return { ok: true, valor: { inicioEm, fimEm, diaInteiro: true, nota } };
}

const dois = (n: number) => String(n).padStart(2, "0");
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const hora = (d: Date) => {
  const p = pecasEmLisboa(d);
  return `${dois(p.hora)}:${dois(p.minuto)}`;
};

/** O último dia de um intervalo de dias inteiros (o fim é exclusivo). */
function ultimoDia(i: Pick<Indisponibilidade, "fimEm">): string {
  return diaEmLisboa(new Date(i.fimEm.getTime() - 1));
}

/** «14/11», «14/11 a 18/11», «14/11, das 14:00 às 18:00» — em Lisboa. */
export function indisponibilidadePorExtenso(i: Pick<Indisponibilidade, "inicioEm" | "fimEm" | "diaInteiro">): string {
  const primeiro = diaEmLisboa(i.inicioEm);
  if (i.diaInteiro) {
    const ultimo = ultimoDia(i);
    return ultimo === primeiro ? `${diaCurto(primeiro)} (dia inteiro)` : `${diaCurto(primeiro)} a ${diaCurto(ultimo)}`;
  }
  return `${diaCurto(primeiro)}, das ${hora(i.inicioEm)} às ${hora(i.fimEm)}`;
}

/** A forma para a API — dias e horas de Lisboa ao lado dos instantes. */
export function indisponibilidadeParaAApi(i: Indisponibilidade) {
  return {
    id: i.id,
    inicioEm: i.inicioEm.toISOString(),
    fimEm: i.fimEm.toISOString(),
    diaInteiro: i.diaInteiro,
    dia: diaEmLisboa(i.inicioEm),
    ate: i.diaInteiro ? ultimoDia(i) : diaEmLisboa(i.inicioEm),
    inicio: i.diaInteiro ? null : hora(i.inicioEm),
    fim: i.diaInteiro ? null : hora(i.fimEm),
    nota: i.nota,
    texto: indisponibilidadePorExtenso(i),
  };
}

const cruza = (a: { inicio: Date; fim: Date }, b: { inicioEm: Date; fimEm: Date }) =>
  a.inicio.getTime() < b.fimEm.getTime() && b.inicioEm.getTime() < a.fim.getTime();

/* ──────────────────────────────────────────────────────────────────────────
 * A DATA DO PEDIDO
 * ────────────────────────────────────────────────────────────────────────── */

const DIAS_DEPOIS: Record<string, number> = { today: 0, hoje: 0, tomorrow: 1, amanha: 1, "amanhã": 1 };
const ESTA_SEMANA = new Set(["this_week", "esta_semana", "semana"]);
const PROXIMA_SEMANA = new Set(["next_week", "proxima_semana"]);

/**
 * QUANDO É O PEDIDO, para cruzar com as indisponibilidades.
 *   · `certa` com hora: [hora, hora + 2 h) (a duração, se a houver);
 *   · `certa` sem hora (só o dia, ou «hoje»/«amanhã»): o dia inteiro;
 *   · `vaga`: a janela («esta semana», «na próxima semana») ou, sem data
 *     nenhuma, os próximos 14 dias.
 * As mesmas palavras de `quando-e-o-trabalho.ts`.
 */
export type JanelaDoPedido =
  | { tipo: "certa"; comHora: boolean; inicio: Date; fim: Date }
  | { tipo: "vaga"; inicio: Date; fim: Date };

export function janelaDoPedido(
  p: {
    dataCombinada?: Date | string | null;
    dataAgendada?: Date | string | null;
    urgency?: string | null;
    criadoEm?: Date | string | null;
    duracaoMinutos?: number | null;
  },
  agora: Date = new Date(),
): JanelaDoPedido {
  const ler = (v: Date | string | null | undefined) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const marcada = ler(p.dataCombinada) ?? ler(p.dataAgendada);
  const doDia = (dia: string) => ({
    inicio: instanteEmLisboa(`${dia}T00:00`) as Date,
    fim: instanteEmLisboa(`${somarDiasAoDia(dia, 1)}T00:00`) as Date,
  });
  if (marcada) {
    const pe = pecasEmLisboa(marcada);
    if (pe.hora === 0 && pe.minuto === 0) return { tipo: "certa", comHora: false, ...doDia(diaEmLisboa(marcada)) };
    const dur = (p.duracaoMinutos && p.duracaoMinutos > 0 ? p.duracaoMinutos : DURACAO_DO_TRABALHO_MIN) * 60_000;
    return { tipo: "certa", comHora: true, inicio: marcada, fim: new Date(marcada.getTime() + dur) };
  }
  const palavra = (p.urgency ?? "").trim().toLowerCase();
  const criado = ler(p.criadoEm) ?? agora;
  const zero = diaEmLisboa(criado);
  if (palavra in DIAS_DEPOIS) {
    return { tipo: "certa", comHora: false, ...doDia(somarDiasAoDia(zero, DIAS_DEPOIS[palavra])) };
  }
  if (ESTA_SEMANA.has(palavra)) {
    return {
      tipo: "vaga",
      inicio: instanteEmLisboa(`${zero}T00:00`) as Date,
      fim: instanteEmLisboa(`${somarDiasAoDia(zero, 8)}T00:00`) as Date,
    };
  }
  if (PROXIMA_SEMANA.has(palavra)) {
    const diaDaSemana = pecasEmLisboa(instanteEmLisboa(`${zero}T12:00`) as Date).diaDaSemana; // 0 = domingo
    const ateSegunda = (8 - diaDaSemana) % 7 || 7;
    const segunda = somarDiasAoDia(zero, ateSegunda);
    return {
      tipo: "vaga",
      inicio: instanteEmLisboa(`${segunda}T00:00`) as Date,
      fim: instanteEmLisboa(`${somarDiasAoDia(segunda, 7)}T00:00`) as Date,
    };
  }
  const hoje = diaEmLisboa(agora);
  return {
    tipo: "vaga",
    inicio: instanteEmLisboa(`${hoje}T00:00`) as Date,
    fim: instanteEmLisboa(`${somarDiasAoDia(hoje, DIAS_DE_UM_PEDIDO_SEM_DATA)}T00:00`) as Date,
  };
}

/**
 * O PEDIDO CONTRA AS INDISPONIBILIDADES DE UM PROFISSIONAL.
 *   · `livre` — nada cruza;
 *   · `indisponivel` — data certa dentro de um período indisponível: com hora,
 *     qualquer cruzamento com as 2 h do trabalho; só com o dia, o dia inteiro
 *     marcado. Não vai na distribuição;
 *   · `nota` — cruza, mas não bloqueia: data vaga, ou umas horas num pedido
 *     que só tem o dia. Vai, com a nota.
 */
export type CruzamentoComOPedido =
  | { estado: "livre"; texto: null; periodos: [] }
  | { estado: "indisponivel" | "nota"; texto: string; periodos: string[] };

export function cruzarComOPedido(janela: JanelaDoPedido, indisponibilidades: Indisponibilidade[]): CruzamentoComOPedido {
  const janelaComo = { inicio: janela.inicio, fim: janela.fim };
  const cruzam = indisponibilidades.filter((i) => cruza(janelaComo, i));
  if (cruzam.length === 0) return { estado: "livre", texto: null, periodos: [] };
  const periodos = cruzam
    .sort((a, b) => a.inicioEm.getTime() - b.inicioEm.getTime())
    .map((i) => indisponibilidadePorExtenso(i));
  if (janela.tipo === "certa") {
    const bloqueia = janela.comHora
      ? true
      : cruzam.some((i) => i.inicioEm.getTime() <= janela.inicio.getTime() && i.fimEm.getTime() >= janela.fim.getTime());
    if (bloqueia) return { estado: "indisponivel", texto: INDISPONIVEL_NESTE_DIA, periodos };
    return { estado: "nota", texto: `Tem indisponibilidade nesse dia (${periodos.join("; ")}).`, periodos };
  }
  return { estado: "nota", texto: `${NOTA_DA_DATA_VAGA.replace(/\.$/, "")} (${periodos.join("; ")}).`, periodos };
}

/** Os trabalhos marcados que caem num período que se quer marcar como indisponível. */
export function trabalhosEmCima<T extends { inicio: Date; fim: Date }>(
  valor: Pick<IndisponibilidadeLida, "inicioEm" | "fimEm">,
  trabalhos: T[],
): T[] {
  return trabalhos.filter((t) => cruza(t, valor));
}

/**
 * A NOTA QUE O PROFISSIONAL VÊ NUM PEDIDO POR DECIDIR — d35. `null` sem
 * cruzamento. Num pedido de data certa dentro de um período indisponível (que
 * lhe chegou antes de o marcar, ou escolhido à mão), diz-lhe isso mesmo.
 */
export function notaDeIndisponibilidade(
  pedido: Parameters<typeof janelaDoPedido>[0],
  minhas: Indisponibilidade[],
  agora: Date = new Date(),
): string | null {
  if (minhas.length === 0) return null;
  const c = cruzarComOPedido(janelaDoPedido(pedido, agora), minhas);
  if (c.estado === "livre") return null;
  if (c.estado === "indisponivel") return `Marcou-se indisponível nesse dia (${c.periodos.join("; ")}).`;
  return c.texto;
}
