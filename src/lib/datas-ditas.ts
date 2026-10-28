import { deslocamentoDeLisboa } from "./hora-de-lisboa";
import { semAcentos, semLugaresNemPassado } from "./leitor-da-recolha";

/**
 * TODAS AS DATAS QUE O CLIENTE DISSE, PELA ORDEM EM QUE AS DISSE — 28-10-2026
 * (decisão d35).
 *
 * *«Idealmente na sexta-feira, 30 de outubro, ou no sábado, 31 de outubro. No
 * máximo, até domingo, 1 de novembro.»* O resumo ficou «Quando: domingo, 1 de
 * novembro»: a leitura procurava os dias da semana pela ordem do calendário
 * (domingo primeiro), e não pela ordem da frase — ficou o último, que era o
 * limite, e perderam-se as duas preferências.
 *
 * Aqui lêem-se todas: as datas escritas («30 de outubro», «30/10», «October
 * 30th», «30 octobre») e os dias da semana sozinhos («sexta»), cada uma com o
 * seu papel — preferida, ou limite («no máximo», «até», «at the latest»). O
 * campo de data do pedido fica com a PRIMEIRA preferida; o resumo e a
 * descrição dizem-nas todas.
 *
 * Pura e na hora de Lisboa: o «hoje» é o relógio de Lisboa, seja qual for o
 * fuso do servidor.
 */

export type PapelDaData = "preferida" | "limite";

export type DataDita = {
  /** O dia, «AAAA-MM-DD», no calendário de Lisboa. */
  dia: string;
  /** 0 = domingo … 6 = sábado. */
  diaDaSemana: number;
  papel: PapelDaData;
  /** Onde começa na frase (para a ordem). */
  posicao: number;
  /** Escrita com o mês (ou dia/mês), ou só o dia da semana. */
  tipo: "data" | "semana";
};

const MESES_POR_NOME: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
  outubro: 10, novembro: 11, dezembro: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9,
  october: 10, november: 11, december: 12,
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9,
  octobre: 10, novembre: 11, decembre: 12,
  enero: 1, febrero: 2, marzo: 3, mayo: 5, julio: 7, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

const DIAS_POR_NOME: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5,
};

const NOMES_DOS_MESES = Object.keys(MESES_POR_NOME).join("|");
const NOMES_DOS_DIAS = Object.keys(DIAS_POR_NOME).join("|");

/** «30 de outubro», «30th of October», «30 octobre», «30 de octubre». */
const DIA_E_MES = new RegExp(
  `(?<![\\d])(\\d{1,2})(?:st|nd|rd|th|º|o)?\\s+(?:de\\s+|of\\s+)?(${NOMES_DOS_MESES})\\b(?:\\s+(?:de\\s+)?(\\d{4}))?`,
  "g",
);
/** «October 30», «October 30th, 2026». */
const MES_E_DIA = new RegExp(`\\b(${NOMES_DOS_MESES})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\d])(?:,?\\s+(\\d{4}))?`, "g");
/** «30/10», «30-10-2026», «30.10» — sem a porta e o andar («12 -4dto») nem as medidas («1.5 m³»). */
const NUMERICA =
  /(?<![\d])(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:[/.-](\d{2,4}))?(?![\d-]|[º°ª]|\s*(?:esq|dto|dt|dir|frente|andar|m3|kg|cm|mm|metros?|meters?|sacos?|m)\b|\s*(?:m³|€))/g;
/** «sexta», «sexta-feira», «Friday». */
const DIA_DA_SEMANA = new RegExp(`\\b(${NOMES_DOS_DIAS})(?:-feira|\\s+feira)?\\b`, "g");

/** O que põe uma data no papel de limite, ANTES dela na mesma parte da frase. */
const LIMITE_ANTES =
  /\b(no maximo|o mais tardar|ate( ao| a| o)?|at the latest|at most|latest|no later than|au plus tard|au maximum|jusqu|como maximo|a mas tardar|hasta)\b/;
/**
 * E DEPOIS dela, a fechar a oração: «Sunday at the latest», «domingo, no
 * máximo.». Se a seguir vem outra data («sábado; no máximo domingo»), o
 * limite é dessa, e não desta.
 */
const LIMITE_DEPOIS =
  /^[\s,)-]*(at the latest|latest|no maximo|o mais tardar|au plus tard|como maximo|a mas tardar)\s*([.;!?,\n]|$)/;

type Mencao = { posicao: number; fim: number; tipo: "data" | "semana"; dia?: number; mes?: number; ano?: number; semana?: number };

/** «2ª feira», «4f» — o dia da semana por extenso, como `interpretarQuando`. */
function comDiasPorExtenso(t: string): string {
  return t.replace(
    /(?<![\d])([2-6])\s*[ªa]?\s*-?\s*f(?:eira)?\b/g,
    (_, n: string) => ` ${["segunda", "terca", "quarta", "quinta", "sexta"][Number(n) - 2]} `,
  );
}

function mencoes(t: string): Mencao[] {
  const out: Mencao[] = [];
  const ocupado: Array<[number, number]> = [];
  const livre = (a: number, b: number) => !ocupado.some(([x, y]) => a < y && b > x);
  const juntar = (m: Mencao) => {
    if (!livre(m.posicao, m.fim)) return;
    ocupado.push([m.posicao, m.fim]);
    out.push(m);
  };
  for (const m of t.matchAll(DIA_E_MES)) {
    const i = m.index ?? 0;
    juntar({ posicao: i, fim: i + m[0].length, tipo: "data", dia: Number(m[1]), mes: MESES_POR_NOME[m[2]], ano: m[3] ? Number(m[3]) : undefined });
  }
  for (const m of t.matchAll(MES_E_DIA)) {
    const i = m.index ?? 0;
    juntar({ posicao: i, fim: i + m[0].length, tipo: "data", dia: Number(m[2]), mes: MESES_POR_NOME[m[1]], ano: m[3] ? Number(m[3]) : undefined });
  }
  for (const m of t.matchAll(NUMERICA)) {
    const i = m.index ?? 0;
    const ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined;
    juntar({ posicao: i, fim: i + m[0].length, tipo: "data", dia: Number(m[1]), mes: Number(m[2]), ano });
  }
  for (const m of t.matchAll(DIA_DA_SEMANA)) {
    const i = m.index ?? 0;
    juntar({ posicao: i, fim: i + m[0].length, tipo: "semana", semana: DIAS_POR_NOME[m[1]] });
  }
  out.sort((a, b) => a.posicao - b.posicao);

  // «sexta-feira, 30 de outubro» e «30/10 (sexta)» são UMA data: o dia da
  // semana encostado a uma data escrita junta-se a ela.
  const juntas: Mencao[] = [];
  for (const m of out) {
    const antes = juntas[juntas.length - 1];
    if (antes) {
      const entre = t.slice(antes.fim, m.posicao);
      const encostadas = /^[\s,(]*(?:dia\s+|the\s+|le\s+|el\s+)?$/.test(entre) || /^\s*\(?\s*$/.test(entre);
      if (encostadas && antes.tipo === "semana" && m.tipo === "data") {
        juntas[juntas.length - 1] = { ...m, posicao: antes.posicao };
        continue;
      }
      if (encostadas && antes.tipo === "data" && m.tipo === "semana") {
        antes.fim = m.fim;
        continue;
      }
    }
    juntas.push(m);
  }
  return juntas;
}

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * As datas que o cliente disse, pela ordem da frase, sem repetidas.
 * `agora` decide o ano de «30 de outubro» e a próxima «sexta».
 */
export function datasDitas(texto: string | null | undefined, agora: Date = new Date()): DataDita[] {
  if (!texto || !texto.trim()) return [];
  const t = comDiasPorExtenso(semLugaresNemPassado(semAcentos(texto)));
  const parede = new Date(agora.getTime() + deslocamentoDeLisboa(agora));
  const hoje = Date.UTC(parede.getUTCFullYear(), parede.getUTCMonth(), parede.getUTCDate());
  const vistas = new Set<string>();
  const out: DataDita[] = [];
  let fimDaAnterior = 0;
  for (const m of mencoes(t)) {
    let dia: Date;
    if (m.tipo === "data") {
      if (!m.dia || !m.mes || m.mes < 1 || m.mes > 12 || m.dia < 1 || m.dia > 31) continue;
      const ano = m.ano ?? parede.getUTCFullYear();
      dia = new Date(Date.UTC(ano, m.mes - 1, m.dia));
      if (dia.getUTCMonth() !== m.mes - 1) continue; // 31/11 não existe
      if (m.ano == null && dia.getTime() < hoje - 86_400_000) dia = new Date(Date.UTC(ano + 1, m.mes - 1, m.dia));
    } else {
      dia = new Date(hoje);
      let salto = ((m.semana ?? 0) - parede.getUTCDay() + 7) % 7;
      if (salto === 0) salto = 7; // «sexta» dito numa sexta é a próxima
      dia.setUTCDate(dia.getUTCDate() + salto);
    }
    const iso = `${dia.getUTCFullYear()}-${dois(dia.getUTCMonth() + 1)}-${dois(dia.getUTCDate())}`;
    const antes = t.slice(fimDaAnterior, m.posicao);
    const depois = t.slice(m.fim, m.fim + 40);
    // A parte da frase dela: desde a data anterior, ou desde o fim da frase de antes.
    const parte = antes.split(/[.;!?\n]|\b(?:ou|or)\b/).pop() ?? antes;
    const papel: PapelDaData = LIMITE_ANTES.test(parte) || LIMITE_DEPOIS.test(depois) ? "limite" : "preferida";
    fimDaAnterior = m.fim;
    if (vistas.has(iso)) continue;
    vistas.add(iso);
    out.push({ dia: iso, diaDaSemana: dia.getUTCDay(), papel, posicao: m.posicao, tipo: m.tipo });
  }
  return out;
}

/** A data que vai para o campo do pedido: a primeira preferida (ou a primeira). */
export function primeiraPreferida(datas: DataDita[]): DataDita | null {
  return datas.find((d) => d.papel === "preferida") ?? datas[0] ?? null;
}

const DIA_CURTO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** «sexta 30/10». */
export function dataCurta(d: DataDita): string {
  const [, mes, dia] = d.dia.split("-").map(Number);
  return `${DIA_CURTO[d.diaDaSemana]} ${dia}/${mes}`;
}

/**
 * TODAS, NUMA LINHA — «sexta 30/10 ou sábado 31/10; no máximo domingo 1/11».
 * As preferidas pela ordem, com «ou»; o limite a seguir. Vazio sem datas.
 */
export function quandoComTodasAsDatas(datas: DataDita[]): string {
  const preferidas = datas.filter((d) => d.papel === "preferida").map(dataCurta);
  const limites = datas.filter((d) => d.papel === "limite").map(dataCurta);
  const partes: string[] = [];
  if (preferidas.length > 0) partes.push(preferidas.join(" ou "));
  if (limites.length > 0) partes.push(`no máximo ${limites.join(" ou ")}`);
  return partes.join("; ");
}

/**
 * O que se escreve no resumo e na descrição quando o cliente deu MAIS DO QUE
 * UMA data — ou null, quando deu uma ou nenhuma (aí chega a data do pedido).
 */
export function quandoComVariasDatas(texto: string | null | undefined, agora: Date = new Date()): string | null {
  const datas = datasDitas(texto, agora);
  return datas.length >= 2 ? quandoComTodasAsDatas(datas) : null;
}
