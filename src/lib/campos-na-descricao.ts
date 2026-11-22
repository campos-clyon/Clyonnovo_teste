import { diaEmLisboa as diaISOEmLisboa, horaEmLisboa, instanteDaBase, somarDiasAoDia } from "./hora-de-lisboa";

/**
 * O QUE OS CAMPOS DO PEDIDO JÁ DIZEM NÃO SE REPETE NA DESCRIÇÃO — 22-11-2026
 * (decisão d84, aprovada pelo CEO e pelo dono).
 *
 * A app Pro, o painel do profissional e a página do pedido mostram à parte a
 * localidade, o dia, o andar, o elevador, o estacionamento, o destino de uma
 * mudança e as fotografias. A descrição repetia tudo isso — e, pior, dizia
 * «Estacionamento: à porta» com o campo em «não perguntei»: duas coisas
 * diferentes no mesmo ecrã. Agora a descrição fica com o que só ela diz (o
 * que é para levar, o que se vê nas fotografias, o volume, as notas, o que
 * falta confirmar) e:
 *
 *   · as notas que só repetem um campo saem (`soRepeteOsCampos`);
 *   · o que o dia diz a mais do que o campo da data («ou ao fim de semana»)
 *     vai para as notas (`oQueOQuandoAcrescenta`);
 *   · o que a conversa diz e o campo não tem não se escreve no texto: no
 *     «Arrumar a descrição» vira uma sugestão para preencher o campo, e uma
 *     contradição vira um aviso (`sugestoesDosCampos`).
 *
 * PURO e leve — também o lê o navegador (o formulário e o painel).
 */

/** Minúsculas e sem acentos, LETRA A LETRA — o mesmo comprimento, para as posições valerem no original. */
export function plano(t: string): string {
  let out = "";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const p = c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    out += p.length === 1 ? p : c;
  }
  return out;
}

const temValor = (v: unknown): boolean => {
  if (v == null) return false;
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  const t = String(v).trim();
  return t !== "" && t !== "unknown";
};

/* ──────────────────────────────────────────────────────────────────────────
 * OS CAMPOS EM PALAVRAS
 * ────────────────────────────────────────────────────────────────────────── */

/** «3.º andar», «rés-do-chão», «cave», «2.º andar Esq». */
export function andarPorExtenso(floor: string | null | undefined): string | null {
  const f = String(floor ?? "").trim();
  if (!f) return null;
  const m = /^(-?\d{1,2})\s*[º°ª]?\s*(.*)$/.exec(f);
  if (m) {
    const n = m[1];
    const base = n === "0" ? "rés-do-chão" : n === "-1" ? "cave" : `${Number(n)}.º andar`;
    return m[2] ? `${base} ${m[2].trim()}` : base;
  }
  if (/^r\/?c\b/i.test(f)) return `rés-do-chão${f.replace(/^r\/?c/i, "")}`.trim();
  return f;
}

/** O elevador como as várias partes do site o gravam. */
export function elevadorPorExtenso(v: string | null | undefined): string | null {
  const e = plano(String(v ?? "").trim());
  if (["yes", "sim", "true", "1"].includes(e)) return "com elevador";
  if (e === "small" || /pequen/.test(e)) return "com elevador pequeno";
  if (["no", "nao", "false", "0"].includes(e)) return "sem elevador";
  return null;
}

/** O estacionamento como as várias partes do site o gravam (ver `estacionamentoDoPedido`). */
export function estacionamentoPorExtenso(v: string | null | undefined): string | null {
  const e = String(v ?? "").trim();
  if (["door", "under_20m", "near", "easy", "porta"].includes(e)) return "à porta";
  if (["over_30m", "difficult", "far"].includes(e)) return "longe da porta";
  return null;
}

/**
 * AS OPÇÕES DO «DÁ PARA ESTACIONAR À PORTA?» do formulário do backoffice — o
 * valor que se grava e o que se lê. Uma só lista: o formulário desenha-as
 * daqui, e as sugestões dizem o mesmo que o formulário.
 */
export const ESTACIONAMENTO_NO_FORMULARIO: ReadonlyArray<{ valor: string; rotulo: string }> = [
  { valor: "door", rotulo: "Sim, mesmo à porta" },
  { valor: "under_20m", rotulo: "Sim, até 20 metros" },
  { valor: "easy", rotulo: "Sim, junto à porta" },
  { valor: "over_30m", rotulo: "Mais de 30 metros" },
  { valor: "difficult", rotulo: "Longe ou complicado" },
  { valor: "unknown", rotulo: "Não sabe" },
];

/** O lado da porta de um valor de estacionamento: perto, longe, ou não se sabe. */
function ladoDoEstacionamento(v: string | null | undefined): "perto" | "longe" | null {
  const e = String(v ?? "").trim();
  if (["door", "under_20m", "easy", "near", "porta"].includes(e)) return "perto";
  if (["over_30m", "difficult", "far"].includes(e)) return "longe";
  return null;
}

function rotuloDoEstacionamento(v: string): string {
  return ESTACIONAMENTO_NO_FORMULARIO.find((o) => o.valor === v)?.rotulo ?? estacionamentoPorExtenso(v) ?? v;
}

/* ──────────────────────────────────────────────────────────────────────────
 * O ESTACIONAMENTO QUE A CONVERSA DIZ
 * ────────────────────────────────────────────────────────────────────────── */

export type EstacionamentoDito = {
  /** O valor do formulário que lhe corresponde — ou null quando não dá para dizer qual. */
  valor: string | null;
  /** Em palavras, como se diz na sugestão. */
  texto: string;
};

const DITO_LONGE = /\b(longe|dif[ií]cil|complicad|apertad|n[aã]o\s+(h[aá]|d[aá]|tem|consegue)|sem\s+(estacionamento|lugar|sitio)|proibid)/;
const DITO_PERTO = /\b(porta|em\s+frente|perto|junto|garagem|f[aá]cil|sem\s+(problema|dificuldade)|h[aá]\s+lugar|estaciona-se\s+bem)/;

/**
 * O que a conversa diz do estacionamento: os metros até à porta, o que a
 * Vitória apurou («near»/«far»), ou o que o modelo leu nas frases dele.
 */
export function estacionamentoDaConversa(
  dito: string | null | undefined,
  metros?: number | null,
  daConversa?: string | null,
): EstacionamentoDito | null {
  if (typeof metros === "number" && Number.isFinite(metros) && metros >= 0) {
    const valor = metros <= 5 ? "door" : metros <= 20 ? "under_20m" : metros >= 30 ? "over_30m" : null;
    return { valor, texto: metros === 0 ? "à porta" : `a carrinha fica a cerca de ${metros} m da porta` };
  }
  const t = String(dito ?? "").trim().replace(/[.;]+$/, "");
  if (t && !/^(por confirmar|a confirmar|n[aã]o sabe|n[aã]o disse)$/i.test(t)) {
    const p = plano(t);
    if (DITO_LONGE.test(p)) return { valor: "difficult", texto: t };
    if (DITO_PERTO.test(p)) return { valor: /porta|em frente/.test(p) ? "door" : "easy", texto: t };
    return { valor: null, texto: t };
  }
  const c = String(daConversa ?? "").trim();
  if (c === "near") return { valor: "easy", texto: "perto da porta" };
  if (c === "far") return { valor: "difficult", texto: "longe da porta" };
  if (ladoDoEstacionamento(c)) return { valor: c, texto: estacionamentoPorExtenso(c) ?? c };
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * OS DIAS QUE A CONVERSA DIZ
 * ────────────────────────────────────────────────────────────────────────── */

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_DA_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

const DOIS = (n: number) => String(n).padStart(2, "0");

/** O dia da semana (0 = domingo) de um `YYYY-MM-DD`. */
function diaDaSemana(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Um dia e um mês sem ano: este ano, ou o próximo se já passou. */
function comAno(dia: number, mes: number, hoje: string, ano?: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const a = ano ?? Number(hoje.slice(0, 4));
  let iso = `${a}-${DOIS(mes)}-${DOIS(dia)}`;
  if (ano == null && iso < somarDiasAoDia(hoje, -1)) iso = `${a + 1}-${DOIS(mes)}-${DOIS(dia)}`;
  const [y, mm, dd] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, mm - 1, dd));
  return d.getUTCMonth() === mm - 1 ? iso : null;
}

export type DiaDito = { dia: string; inicio: number; fim: number };

/**
 * OS DIAS DITOS NUM TEXTO, pela ordem — «segunda-feira, 23 de novembro»,
 * «23/11», «dia 23», «sábado», «amanhã». Um dia da semana colado a uma data
 * é a mesma data. Em `YYYY-MM-DD`, contados em Lisboa.
 */
export function diasDitos(texto: string | null | undefined, agora: Date = new Date()): DiaDito[] {
  const t = String(texto ?? "");
  const p = plano(t);
  const hoje = diaISOEmLisboa(agora);
  const achados: DiaDito[] = [];
  const ocupado = (a: number, b: number) => achados.some((x) => a < x.fim && b > x.inicio);
  const juntar = (dia: string | null, inicio: number, fim: number) => {
    if (dia && !ocupado(inicio, fim)) achados.push({ dia, inicio, fim });
  };
  const SEMANA = "(?:(?:segunda|terca|quarta|quinta|sexta)(?:-feira)?|sabado|domingo)";
  // O dia da semana (opcional) colado à data: «segunda-feira, 23 de novembro».
  const porExtenso = new RegExp(`(?:${SEMANA}\\s*,?\\s*(?:dia\\s+)?)?\\b(\\d{1,2})\\s+de\\s+(${MESES.join("|")})(?:\\s+de\\s+(\\d{4}))?`, "g");
  for (const m of p.matchAll(porExtenso)) {
    juntar(comAno(Number(m[1]), MESES.indexOf(m[2]) + 1, hoje, m[3] ? Number(m[3]) : undefined), m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  const comBarras = new RegExp(`(?:${SEMANA}\\s*,?\\s*(?:dia\\s+)?)?(?<![\\d/])(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?(?![\\d/])`, "g");
  for (const m of p.matchAll(comBarras)) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    juntar(comAno(Number(m[1]), Number(m[2]), hoje, ano), m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  const soODia = new RegExp(`(?:${SEMANA}\\s*,?\\s*)?\\bdia\\s+(\\d{1,2})\\b(?!\\s*(?:de\\s|/))`, "g");
  for (const m of p.matchAll(soODia)) {
    const n = Number(m[1]);
    const [a, mes] = hoje.split("-").map(Number);
    let iso = comAno(n, mes, hoje, a);
    if (iso && iso < hoje) iso = mes === 12 ? comAno(n, 1, hoje, a + 1) : comAno(n, mes + 1, hoje, a);
    juntar(iso, m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  for (const m of p.matchAll(new RegExp(`\\b${SEMANA}\\b`, "g"))) {
    const nome = m[0].replace(/-feira$/, "");
    const alvo = DIAS_DA_SEMANA.indexOf(nome);
    let n = (alvo - diaDaSemana(hoje) + 7) % 7;
    if (n === 0) n = 7;
    juntar(somarDiasAoDia(hoje, n), m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  for (const m of p.matchAll(/\bamanha\b/g)) juntar(somarDiasAoDia(hoje, 1), m.index ?? 0, (m.index ?? 0) + m[0].length);
  return achados.sort((a, b) => a.inicio - b.inicio);
}

/** «segunda-feira, 23 de novembro» — de um `YYYY-MM-DD`. */
export function diaPorExtenso(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Os dias ditos à volta do dia do campo: lêem-se a contar de três dias antes
 * dele, e não de hoje — «sexta 30/10» num pedido de 30 de outubro é esse dia,
 * mesmo lido em novembro (e um «sábado» é o sábado dessa semana).
 */
function diasDitosPerto(texto: string, dia: string): DiaDito[] {
  return diasDitos(texto, new Date(`${somarDiasAoDia(dia, -3)}T12:00:00Z`));
}

/** O dia e a hora do campo da data, em Lisboa. */
function campoDaData(v: Date | string | null | undefined): { dia: string; hora: number } | null {
  const d = instanteDaBase(v ?? null);
  if (!d) return null;
  return { dia: diaISOEmLisboa(d), hora: Number(horaEmLisboa(d).slice(0, 2)) };
}

const SO_LIGACOES = new Set(["e", "ou", "no", "na", "nos", "nas", "de", "do", "da", "a", "o", "as", "os", "ao", "dia", "pelas", "para", "entre", "feira"]);

/**
 * O QUE O DIA DITO ACRESCENTA AO CAMPO DA DATA — «segunda-feira, 23 de
 * novembro, ou ao fim de semana» com o campo na segunda, 23: «Também pode ao
 * fim de semana.» Sem nada a acrescentar, `null`. Com outro dia que não o do
 * campo (uma contradição), também `null`: manda o campo, e quem arruma vê o
 * aviso (`sugestoesDosCampos`).
 */
export function oQueOQuandoAcrescenta(
  quando: string | null | undefined,
  dataDoCampo: Date | string | null | undefined,
): string | null {
  const t = String(quando ?? "").trim();
  if (!t) return null;
  const campo = campoDaData(dataDoCampo);
  if (!campo) return null;
  const ditos = diasDitosPerto(t, campo.dia);
  if (ditos.length > 0 && !ditos.some((d) => d.dia === campo.dia)) return null;
  // Tira-se o dia do campo — e a parte do dia, se a hora do campo já a diz.
  const cortes: Array<[number, number]> = ditos.filter((d) => d.dia === campo.dia).map((d) => [d.inicio, d.fim]);
  const p = plano(t);
  const partes: Array<[RegExp, boolean]> = [
    [/\b(de|pela|durante a)\s+manha\b/g, campo.hora >= 6 && campo.hora < 12],
    [/\b(a|de|pela|durante a)\s+tarde\b/g, campo.hora >= 12 && campo.hora < 20],
  ];
  for (const [re, ja] of partes) if (ja) for (const m of p.matchAll(re)) cortes.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  let resto = t;
  for (const [a, b] of cortes.sort((x, y) => y[0] - x[0])) resto = resto.slice(0, a) + " " + resto.slice(b);
  resto = resto
    .replace(/\s*\(\s*\)/g, " ")
    .replace(/\s+([,;.])/g, "$1")
    .replace(/([,;])\s*[,;]+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;.:\-–—]+|[\s,;.:\-–—]+$/g, "")
    .trim();
  const palavras = plano(resto).split(/[^a-z0-9]+/).filter(Boolean);
  if (palavras.length === 0 || palavras.every((w) => SO_LIGACOES.has(w))) return null;
  let frase = /^ou\s+/i.test(resto) ? `Também pode ${resto.replace(/^ou\s+/i, "")}` : resto.charAt(0).toUpperCase() + resto.slice(1);
  if (!/[.!?…]$/.test(frase)) frase += ".";
  return frase;
}

/* ──────────────────────────────────────────────────────────────────────────
 * AS NOTAS QUE SÓ REPETEM OS CAMPOS
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * As palavras que só dizem o que os campos dizem — o andar, o elevador, a
 * cave, a morada, o dia, o estacionamento, o serviço — e as de ligação. Em
 * texto e não em lista de palavras soltas, de propósito: o teste da orquestra
 * lê os textos dos ficheiros.
 */
const DOS_CAMPOS = new Set(
  (
    "andar andares piso pisos cave caves subcave res chao rc r c terreo elevador elevadores " +
    "estacionamento estacionar estaciona estacionado parque parquear porta " +
    "morada moradas localidade localizado localizada localizados situado situada situados fica ficam zona codigo postal " +
    "dia dias data hora horas manha tarde noite hoje amanha " +
    "segunda terca quarta quinta sexta sabado domingo feira " +
    "janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro " +
    "servico servicos recolha recolhas mudanca mudancas esvaziamento esvaziamentos monos mono moveis mobilia entulho " +
    "pedido trabalho local sitio predio edificio casa " +
    "a o os as um uma uns umas e ou de da do das dos em no na nos nas num numa ao aos para pelo pela por com sem " +
    "que se trata tratase este esta isto esse essa e sao tem ha cliente"
  ).split(/\s+/),
);

/**
 * ESTA NOTA SÓ DIZ O QUE OS CAMPOS JÁ DIZEM? «Serviço localizado numa cave
 * sem elevador.» — sim: sai. «Sem elevador, e as escadas são estreitas.» —
 * não: as escadas são informação. As palavras da localidade do pedido
 * contam como campo.
 */
export function soRepeteOsCampos(frase: string | null | undefined, localidade?: string | null): boolean {
  const palavras = plano(String(frase ?? "")).split(/[^a-z0-9]+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const daLocalidade = new Set(plano(String(localidade ?? "")).split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
  return palavras.every((w) => DOS_CAMPOS.has(w) || daLocalidade.has(w) || /^\d+(o|a|ro|do|to)?$/.test(w));
}

/* ──────────────────────────────────────────────────────────────────────────
 * AS SUGESTÕES PARA O FORMULÁRIO
 * ────────────────────────────────────────────────────────────────────────── */

export type SugestaoDoCampo = {
  /** O campo do formulário. */
  campo: "parkingDistance" | "dataDesejada";
  /** «preencher»: o campo está vazio e a conversa diz; «contradiz»: o campo diz outra coisa. */
  tipo: "preencher" | "contradiz";
  /** A frase que o formulário mostra. */
  texto: string;
  /** O valor que o «Preencher» põe no campo (nunca grava sozinho). */
  valor: string | null;
};

/** O que a conversa diz, para as sugestões. */
export type OQueAConversaDiz = {
  /** O que o modelo leu sobre estacionar, ou "". */
  estacionamento?: string | null;
  metrosAtePorta?: number | null;
  /** O estacionamento que a Vitória apurou («near»/«far»). */
  parkingDistance?: string | null;
  /** O dia em palavras — do modelo, ou o que a conversa apurou. */
  quando?: string | null;
  /** O dia que a Vitória apurou, se o apurou (ISO). */
  dataDesejada?: string | null;
};

/** O valor para o `<input type="datetime-local">`: o dia, e a hora dita (ou a da parte do dia). */
function valorDaData(dia: string, quando: string): string {
  const p = plano(quando);
  const h = /(?<!\d)(\d{1,2})\s*(?:h(?:(\d{2}))?\b|:(\d{2}))/.exec(p);
  if (h && Number(h[1]) <= 23) return `${dia}T${DOIS(Number(h[1]))}:${h[2] ?? h[3] ?? "00"}`;
  if (/manha/.test(p)) return `${dia}T09:00`;
  if (/tarde/.test(p)) return `${dia}T14:00`;
  return `${dia}T00:00`;
}

/**
 * O DIA QUE A CONVERSA DÁ PARA O CAMPO — o que a Vitória apurou, ou o
 * primeiro dia dito. `null` quando não se diz nenhum dia certo.
 */
export function diaDaConversa(c: OQueAConversaDiz, agora: Date = new Date()): { dia: string; valor: string } | null {
  const quando = String(c.quando ?? "").trim();
  const apurado = instanteDaBase(c.dataDesejada ?? null);
  if (apurado) {
    const dia = diaISOEmLisboa(apurado);
    return { dia, valor: `${dia}T${horaEmLisboa(apurado)}` };
  }
  const [primeiro] = diasDitos(quando, agora);
  return primeiro ? { dia: primeiro.dia, valor: valorDaData(primeiro.dia, quando) } : null;
}

/**
 * O QUE O FORMULÁRIO MOSTRA POR BAIXO DO «ARRUMAR A DESCRIÇÃO» — o que a
 * conversa diz e o campo não tem (para preencher com um toque), e o que a
 * conversa diz ao contrário do campo (só o aviso: não se muda nada).
 */
export function sugestoesDosCampos(
  c: OQueAConversaDiz,
  campos: { parkingDistance?: string | null; dataAgendada?: Date | string | null },
  agora: Date = new Date(),
): SugestaoDoCampo[] {
  const out: SugestaoDoCampo[] = [];

  const est = estacionamentoDaConversa(c.estacionamento, c.metrosAtePorta, c.parkingDistance);
  if (est) {
    if (!temValor(campos.parkingDistance)) {
      out.push({
        campo: "parkingDistance",
        tipo: "preencher",
        texto: `Estacionamento: ${est.texto} (dito pelo cliente)`,
        valor: est.valor,
      });
    } else {
      const noCampo = ladoDoEstacionamento(campos.parkingDistance);
      const naConversa = ladoDoEstacionamento(est.valor);
      if (noCampo && naConversa && noCampo !== naConversa) {
        out.push({
          campo: "parkingDistance",
          tipo: "contradiz",
          texto: `A conversa diz «${est.texto}», o campo diz «${rotuloDoEstacionamento(String(campos.parkingDistance).trim())}».`,
          valor: null,
        });
      }
    }
  }

  const quando = String(c.quando ?? "").trim();
  const campo = campoDaData(campos.dataAgendada);
  if (!campo) {
    const d = diaDaConversa(c, agora);
    if (d) {
      out.push({ campo: "dataDesejada", tipo: "preencher", texto: `Dia: ${diaPorExtenso(d.dia)} (dito pelo cliente)`, valor: d.valor });
    } else if (quando) {
      out.push({ campo: "dataDesejada", tipo: "preencher", texto: `Quando: ${quando.replace(/[.;]+$/, "")} (dito pelo cliente) — marque o dia à mão`, valor: null });
    }
  } else if (quando) {
    const ditos = diasDitosPerto(quando, campo.dia);
    if (ditos.length > 0 && !ditos.some((d) => d.dia === campo.dia)) {
      out.push({
        campo: "dataDesejada",
        tipo: "contradiz",
        texto: `A conversa diz «${quando.replace(/[.;]+$/, "")}», o campo diz «${diaPorExtenso(campo.dia)}».`,
        valor: null,
      });
    }
  }
  return out;
}

/** O campo tem valor? (vazio, «não perguntei» e «não sabe» não contam). */
export function campoComValor(v: unknown): boolean {
  return temValor(v);
}
