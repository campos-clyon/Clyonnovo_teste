/**
 * A TABELA DAS MUDANÇAS — à hora, e não um valor fechado. 13-10-2026.
 *
 * *«Vamos tratar as mudanças diferente: não temos valores fixos para mudanças,
 * e sim este esquema.»* — o dono, com a tabela que está aqui em baixo. E as
 * decisões dele, às perguntas que se lhe fizeram:
 *
 *   · os valores são SEM IVA, e são o que o CLIENTE paga — a taxa da CLYON já
 *     vem lá dentro (o profissional propõe sobre `valorDoProfissionalPorHora`);
 *   · a mudança é contratada À HORA — a base «hora», ao lado de «total» e
 *     «por carga» (`base-do-preco.ts`);
 *   · antes de alguém ver o trabalho, as horas contam-se pela TIPOLOGIA;
 *   · acima de 50 km, os 1,30 €/km contam TODOS os km, ida e volta;
 *   · a tabela PUBLICA-SE no site.
 *
 * Antes disto o motor dava 70 €/h com uma base fixa de 7 horas — 490 € a
 * 735 € sem IVA para qualquer mudança, de um estúdio a um T4 —, e o site
 * dizia «orçamento personalizado» em todo o lado.
 *
 * Um sítio só: o motor, as páginas, o simulador e as mensagens lêem daqui.
 * Mudar um preço é mudar uma linha.
 */

import { TAXA_IVA, type Taxas } from "./taxas-plataforma";
import { baseDoPrecoDoCliente } from "./preco-do-cliente";

/** A. Mão de obra e viatura — viatura, motorista e dois ajudantes. */
export const PRECO_POR_HORA = 50;
export const PESSOAS_NA_EQUIPA = 3;
export const MINIMO_DE_HORAS = 3;

/** B. Deslocação — incluída até este raio; acima, cada km (ida e volta) paga-se. */
export const RAIO_INCLUIDO_KM = 50;
export const PRECO_POR_KM_LONGE = 1.3;

/** D. Extras. */
export const ELEVADOR_EXTERIOR = 120;
/** «Cada andar para apartamento sem elevador são mais 15 euros por pessoa.» */
export const POR_ANDAR_SEM_ELEVADOR_POR_PESSOA = 15;
export const POR_ANDAR_SEM_ELEVADOR = POR_ANDAR_SEM_ELEVADOR_POR_PESSOA * PESSOAS_NA_EQUIPA;
/* Desmontar e montar móveis acrescenta horas à equipa — desde 11-11-2026 por
 * tipologia (`HORAS_DA_DESMONTAGEM`, mais abaixo); era 1 h para qualquer casa. */

/** C. Materiais de embalamento. */
export type Material = { id: string; nome: string; preco: number; unidade: string };
export const MATERIAIS: Material[] = [
  { id: "caixa", nome: "Caixa pequena/média (cartão simples ou duplo)", preco: 2, unidade: "unidade" },
  { id: "caixa_cabides", nome: "Caixa para cabides (roupa em pé)", preco: 13.5, unidade: "unidade" },
  { id: "plastico_bolha", nome: "Plástico bolha", preco: 22, unidade: "rolo" },
  { id: "filme", nome: "Filme extensível (transparente ou preto), para proteger móveis", preco: 10, unidade: "rolo" },
  { id: "papel", nome: "Papel de embrulho (louças e vidros)", preco: 23, unidade: "resma" },
  { id: "fita", nome: "Fita cola larga de empacotar", preco: 2, unidade: "rolo" },
  { id: "cartao_canelado", nome: "Cartão canelado (proteção de pisos e superfícies)", preco: 30, unidade: "rolo longo" },
];

/**
 * O VALOR DE PARTIDA DE UMA MUDANÇA — por hora, no lado do profissional.
 *
 * Os 50 € são o que o CLIENTE paga sem IVA, com a taxa da CLYON dentro
 * (decisão do dono, 13-10-2026). O valor de partida de uma negociação é o do
 * profissional, e a taxa acresce-lhe: por isso parte-se do valor que, com a
 * taxa, dá os 50 € — 47,62 € com a taxa de 5 %.
 */
export function valorDePartidaPorHora(taxas?: Taxas): number {
  return baseDoPrecoDoCliente(PRECO_POR_HORA, taxas, "sem_iva") ?? PRECO_POR_HORA;
}

/* ──────────────────────────────────────────────────────────────────────────
 * AS HORAS, PELA TIPOLOGIA — EM INTERVALO (11-11-2026)
 *
 * Eram um número só (T3 = 5 h, 13-10-2026). O dono viu cerca de 300 € para um
 * T3 e achou irreal; a pesquisa de mercado de 11-11-2026 confirmou-o: o preço
 * por hora estava certo, as HORAS é que estavam curtas (um T3 é um dia inteiro
 * — 7 a 9 h com 3 pessoas). Decisão do CEO, aprovada pelo dono:
 *
 *   · as horas dizem-se num intervalo [mínimo, máximo], com 3 e com 2 pessoas;
 *   · T3 e T4+ só se fazem com 3 pessoas;
 *   · desmontar e montar soma horas por tipologia, aos dois extremos;
 *   · nunca abaixo do mínimo de horas do parceiro (ou do da referência);
 *   · o material de PROTEÇÃO entra por omissão na estimativa, e o EMBALAMENTO
 *     completo (caixas) só se o cliente o pedir.
 *
 * Um sítio só: a lista dos parceiros, o simulador, as páginas, a referência da
 * app, a Vitória e o aviso ao modelo lêem estas tabelas. O valor final continua
 * a ser o da folha do dia.
 * ────────────────────────────────────────────────────────────────────────── */

export type Tipologia = "itens" | "T0" | "T1" | "T2" | "T3" | "T4+";

/** Todas, do mais pequeno ao maior. «itens» é a pequena mudança: alguns móveis, sem casa inteira. */
export const TIPOLOGIAS: readonly Tipologia[] = Object.freeze(["itens", "T0", "T1", "T2", "T3", "T4+"] as Tipologia[]);

/** Um intervalo de horas: [mínimo, máximo] — iguais quando não há intervalo («3 h»). */
export type IntervaloDeHoras = readonly [minimo: number, maximo: number];

/** As horas com 3 pessoas (carrinha, motorista e dois ajudantes). */
export const HORAS_COM_TRES_PESSOAS: Readonly<Record<Tipologia, IntervaloDeHoras>> = Object.freeze({
  itens: [3, 3],
  T0: [3, 4],
  T1: [4, 5],
  T2: [5, 7],
  T3: [7, 9],
  "T4+": [9, 12],
});

/** As horas com 2 pessoas. `null`: a casa não se oferece com 2 (T3 e T4+ só com 3). */
export const HORAS_COM_DUAS_PESSOAS: Readonly<Record<Tipologia, IntervaloDeHoras | null>> = Object.freeze({
  itens: [3, 3],
  T0: [4, 5],
  T1: [5, 6.5],
  T2: [6.5, 9],
  T3: null,
  "T4+": null,
});

/** Desmontar e montar móveis: as horas a mais, por tipologia, nos dois extremos do intervalo. */
export const HORAS_DA_DESMONTAGEM: Readonly<Record<Tipologia, number>> = Object.freeze({
  itens: 0.5,
  T0: 1,
  T1: 1,
  T2: 1.5,
  T3: 2,
  "T4+": 3,
});

/** Esta casa só se faz com 3 pessoas (T3 e T4+)? Sem tipologia, conta a casa mais pequena. */
export function soComTresPessoas(tipologia: Tipologia | null | undefined): boolean {
  return HORAS_COM_DUAS_PESSOAS[tipologia ?? "itens"] == null;
}

/** A equipa que faz esta casa: a pedida, ou 3 quando a casa só se faz com 3. */
export function pessoasParaACasa(tipologia: Tipologia | null | undefined, pedidas: 2 | 3): 2 | 3 {
  return soComTresPessoas(tipologia) ? 3 : pedidas;
}

/** Num T3 ou maior, com 2 pessoas não: a frase que o diz. */
export const SO_COM_TRES_PESSOAS = "Num T3 ou maior a mudança faz-se com 3 pessoas: as horas e os preços são para 3.";

/** A nota de um T4 ou maior. */
export const NOTA_DO_T4_OU_MAIOR = "Para um T4 ou maior recomendamos 4 pessoas ou duas viaturas — fale connosco.";

/**
 * O INTERVALO DE HORAS de uma casa, com esta equipa: a tabela (numa casa que
 * só se faz com 3, a de 3, mesmo que se peçam 2), mais a desmontagem nos dois
 * extremos, e nunca abaixo de `minimoHoras` — o mínimo do parceiro, ou o da
 * referência. Sem tipologia, conta-se a casa mais pequena.
 */
export function intervaloDeHoras(
  tipologia: Tipologia | null | undefined,
  desmontagem: boolean,
  pessoas: 2 | 3 = 3,
  minimoHoras: number = MINIMO_DE_HORAS,
): IntervaloDeHoras {
  const t = tipologia ?? "itens";
  const tabela = (pessoas === 2 ? HORAS_COM_DUAS_PESSOAS[t] : null) ?? HORAS_COM_TRES_PESSOAS[t];
  const mais = desmontagem ? HORAS_DA_DESMONTAGEM[t] : 0;
  const min = Number.isFinite(minimoHoras) && minimoHoras > 0 ? minimoHoras : 0;
  return [Math.max(min, tabela[0] + mais), Math.max(min, tabela[1] + mais)];
}

/** O meio do intervalo — é por ele que a lista ordena e que o motor estima. */
export function meioDoIntervalo(iv: IntervaloDeHoras): number {
  return (iv[0] + iv[1]) / 2;
}

/** «6,5» — as horas como se escrevem. */
export function horasEscritas(h: number): string {
  const r = Math.round(h * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

/** «entre 7 e 9 h», ou «3 h» quando os dois extremos são iguais. */
export function intervaloDeHorasEmTexto(iv: IntervaloDeHoras): string {
  return iv[0] === iv[1] ? `${horasEscritas(iv[0])} h` : `entre ${horasEscritas(iv[0])} e ${horasEscritas(iv[1])} h`;
}

/** «7–9 h», curto, para tabelas e para o aviso ao modelo. */
export function intervaloDeHorasCurto(iv: IntervaloDeHoras): string {
  return iv[0] === iv[1] ? `${horasEscritas(iv[0])} h` : `${horasEscritas(iv[0])}–${horasEscritas(iv[1])} h`;
}

/** A tabela das horas numa linha: «alguns móveis 3 h · T0 / estúdio 3–4 h · …». */
export function horasPorTipologiaEmTexto(pessoas: 2 | 3): string {
  return TIPOLOGIAS.map((t) => {
    const iv = pessoas === 2 ? HORAS_COM_DUAS_PESSOAS[t] : HORAS_COM_TRES_PESSOAS[t];
    return `${TIPOLOGIA_POR_EXTENSO[t]} ${iv ? intervaloDeHorasCurto(iv) : "só com 3 pessoas"}`;
  }).join(" · ");
}

/** A desmontagem numa linha: «+0,5 h em alguns móveis · +1 h em T0 / estúdio · …». */
export function desmontagemPorTipologiaEmTexto(): string {
  return TIPOLOGIAS.map((t) => `+${horasEscritas(HORAS_DA_DESMONTAGEM[t])} h em ${TIPOLOGIA_POR_EXTENSO[t]}`).join(" · ");
}

/* ──────────────────────────────────────────────────────────────────────────
 * O MATERIAL, EM DOIS NÍVEIS (11-11-2026)
 *
 *   · a PROTEÇÃO — filme para os móveis, cartão para o chão, plástico bolha
 *     para o que parte — entra por omissão na estimativa;
 *   · o EMBALAMENTO COMPLETO — as caixas e mais plástico bolha — só se o
 *     cliente o pedir, numa linha à parte (`PEDIR_EMBALAMENTO`).
 *
 * As quantidades estão nas unidades da tarifa dos parceiros (caixas, rolos de
 * filme, rolos de plástico bolha), e o cartão em ROLOS: a tarifa conta-o em
 * metros, e um rolo de cartão canelado de proteção conta
 * `METROS_POR_ROLO_DE_CARTAO` metros (um rolo de 1 m × 10 m cobre a entrada,
 * o corredor e as escadas de uma casa até T3; um T4 ou maior leva dois). Na
 * tabela de referência (`MATERIAIS`) o cartão é por rolo.
 * ────────────────────────────────────────────────────────────────────────── */

export const METROS_POR_ROLO_DE_CARTAO = 10;

export type QuantidadesDeMaterial = Readonly<{
  caixas?: number;
  filmeRolos?: number;
  cartaoRolos?: number;
  plasticoBolhaRolos?: number;
}>;

export const PROTECAO_POR_TIPOLOGIA: Readonly<Record<Tipologia, QuantidadesDeMaterial>> = Object.freeze({
  itens: Object.freeze({ filmeRolos: 1 }),
  T0: Object.freeze({ filmeRolos: 1 }),
  T1: Object.freeze({ filmeRolos: 2, cartaoRolos: 1 }),
  T2: Object.freeze({ filmeRolos: 3, cartaoRolos: 1 }),
  T3: Object.freeze({ filmeRolos: 4, cartaoRolos: 1, plasticoBolhaRolos: 1 }),
  "T4+": Object.freeze({ filmeRolos: 6, cartaoRolos: 2, plasticoBolhaRolos: 1 }),
});

/** O embalamento completo, POR CIMA da proteção. `null`: alguns móveis não levam caixas. */
export const EMBALAMENTO_POR_TIPOLOGIA: Readonly<Record<Tipologia, QuantidadesDeMaterial | null>> = Object.freeze({
  itens: null,
  T0: Object.freeze({ caixas: 20, plasticoBolhaRolos: 1 }),
  T1: Object.freeze({ caixas: 30, plasticoBolhaRolos: 1 }),
  T2: Object.freeze({ caixas: 45, plasticoBolhaRolos: 2 }),
  T3: Object.freeze({ caixas: 70, plasticoBolhaRolos: 1 }),
  "T4+": Object.freeze({ caixas: 100, plasticoBolhaRolos: 2 }),
});

/** A opção do ecrã da lista e do simulador. */
export const PEDIR_EMBALAMENTO = "Também preciso de caixas e embalamento";

/** As quantidades na tabela de referência (`MATERIAIS`, por id). */
export function materiaisDeReferencia(q: QuantidadesDeMaterial | null | undefined): Record<string, number> {
  const m: Record<string, number> = {};
  if (!q) return m;
  if (q.caixas) m.caixa = q.caixas;
  if (q.filmeRolos) m.filme = q.filmeRolos;
  if (q.cartaoRolos) m.cartao_canelado = q.cartaoRolos;
  if (q.plasticoBolhaRolos) m.plastico_bolha = q.plasticoBolhaRolos;
  return m;
}

/** «3 rolos de filme, 1 rolo de cartão» — as quantidades, por extenso. */
export function materialEmTexto(q: QuantidadesDeMaterial | null | undefined): string {
  if (!q) return "";
  const p: string[] = [];
  const um = (n: number, s: string, pl: string) => `${n} ${n === 1 ? s : pl}`;
  if (q.caixas) p.push(um(q.caixas, "caixa", "caixas"));
  if (q.filmeRolos) p.push(um(q.filmeRolos, "rolo de filme", "rolos de filme"));
  if (q.cartaoRolos) p.push(um(q.cartaoRolos, "rolo de cartão", "rolos de cartão"));
  if (q.plasticoBolhaRolos) p.push(um(q.plasticoBolhaRolos, "rolo de plástico bolha", "rolos de plástico bolha"));
  return p.join(", ");
}

/** O nome por extenso, para as páginas e os resumos. */
export const TIPOLOGIA_POR_EXTENSO: Record<Tipologia, string> = {
  itens: "alguns móveis",
  T0: "T0 / estúdio",
  T1: "T1",
  T2: "T2",
  T3: "T3",
  "T4+": "T4 ou maior",
};

function semAcentos(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * A TIPOLOGIA DITA NUMA FRASE — «um T2 pequeno», «estúdio», «moradia V3»,
 * «só alguns móveis». `null` quando a frase não a diz.
 */
export function tipologiaDoTexto(texto: string | null | undefined): Tipologia | null {
  const t = semAcentos(texto ?? "");
  if (!t) return null;
  const m = t.match(/\b[tv]\s?([0-9])\b/);
  if (m) {
    const n = Number(m[1]);
    return n === 0 ? "T0" : n === 1 ? "T1" : n === 2 ? "T2" : n === 3 ? "T3" : "T4+";
  }
  if (/\b(estudio|kitchenette|quarto alugado|um quarto)\b/.test(t)) return "T0";
  if (/\b(alguns|poucos|uns)\s+(moveis|artigos|volumes|objetos|objectos)\b|\bpequena mudanca\b|\bso (uns|alguns|o|a)\b/.test(t)) {
    return "itens";
  }
  return null;
}

/**
 * As horas estimadas, num número só — o MEIO do intervalo com 3 pessoas (a
 * tabela, mais a desmontagem), nunca abaixo do mínimo. Para o motor e para as
 * horas previstas de um pedido. Sem tipologia conhecida, conta-se o mínimo: o
 * profissional diz quantas prevê quando vir o trabalho.
 */
export function horasEstimadas(tipologia: Tipologia | null | undefined, desmontagem = false): number {
  return Math.max(MINIMO_DE_HORAS, meioDoIntervalo(intervaloDeHoras(tipologia ?? "itens", desmontagem, 3)));
}

/* ──────────────────────────────────────────────────────────────────────────
 * A CONTA
 * ────────────────────────────────────────────────────────────────────────── */

/** Os andares a subir ou descer a pé: acima do r/c, e só sem elevador. */
export function andaresAPe(floor: string | number | null | undefined, hasElevator: string | null | undefined): number {
  if (hasElevator === "yes" || hasElevator === "small") return 0;
  const n = typeof floor === "number" ? floor : Number(String(floor ?? "").replace(/[^\d-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** A deslocação: incluída até ao raio; acima, todos os km, ida e volta. */
export function deslocacao(kmPercurso: number | null | undefined): number {
  const km = Number(kmPercurso);
  if (!Number.isFinite(km) || km <= RAIO_INCLUIDO_KM) return 0;
  return Math.round(km * 2 * PRECO_POR_KM_LONGE * 100) / 100;
}

export type PontaDaMudanca = { floor?: string | number | null; hasElevator?: string | null };

export type PedidoDeMudanca = {
  tipologia?: Tipologia | null;
  desmontagem?: boolean;
  kmPercurso?: number | null;
  origem?: PontaDaMudanca;
  destino?: PontaDaMudanca;
  elevadorExterior?: boolean;
  /** Quantidades por `Material.id`. */
  materiais?: Record<string, number>;
  /** Somar o material de proteção da tipologia (`PROTECAO_POR_TIPOLOGIA`) — é o que o site estima. */
  protecao?: boolean;
  /** Somar também o embalamento completo (`EMBALAMENTO_POR_TIPOLOGIA`), quando o cliente o pede. */
  embalamento?: boolean;
};

export type OrcamentoDaMudanca = {
  /** O meio do intervalo (o motor e quem precisa de um número só). */
  horas: number;
  /** O intervalo de horas da equipa de 3: [mínimo, máximo]. */
  intervalo: IntervaloDeHoras;
  maoDeObra: number;
  deslocacao: number;
  andares: number;
  custoDosAndares: number;
  elevadorExterior: number;
  materiais: number;
  /** Tudo, sem IVA, ao meio do intervalo — o que o cliente paga antes do imposto. */
  totalSemIva: number;
  totalComIva: number;
  /** Os dois extremos, sem IVA e com IVA. */
  totalSemIvaMinimo: number;
  totalSemIvaMaximo: number;
  totalComIvaMinimo: number;
  totalComIvaMaximo: number;
  /** A conta linha a linha, para o profissional e para a equipa. */
  linhas: string[];
};

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const arred = (v: number) => Math.round(v * 100) / 100;
/** «250,00–350,00 €», ou um valor só quando os extremos são iguais. */
const eurosDeA = (de: number, ate: number) => (de === ate ? euros(de) : `${euros(de).replace(" €", "")}–${euros(ate)}`);

function somarQuantidades(...qs: Array<Record<string, number> | undefined>): Record<string, number> {
  const r: Record<string, number> = {};
  for (const q of qs) for (const [k, v] of Object.entries(q ?? {})) r[k] = (r[k] ?? 0) + v;
  return r;
}

function valorDosMateriais(q: Record<string, number>): number {
  return arred(MATERIAIS.reduce((s, m) => s + Math.max(0, Math.floor(q[m.id] ?? 0)) * m.preco, 0));
}

/**
 * A ESTIMATIVA DE UMA MUDANÇA, pela tabela de referência (equipa de 3). É uma
 * estimativa: a mudança paga-se pelas horas feitas no dia. Desde 11-11-2026
 * em intervalo — as horas da tipologia de 3 a 9, de 9 a 12… —, com os totais
 * nos dois extremos e ao meio.
 */
export function orcamentoDaMudanca(p: PedidoDeMudanca): OrcamentoDaMudanca {
  const intervalo = intervaloDeHoras(p.tipologia ?? null, p.desmontagem === true, 3);
  const horas = meioDoIntervalo(intervalo);
  const maoMin = arred(intervalo[0] * PRECO_POR_HORA);
  const maoMax = arred(intervalo[1] * PRECO_POR_HORA);
  const desl = deslocacao(p.kmPercurso);
  const andares =
    andaresAPe(p.origem?.floor, p.origem?.hasElevator) + andaresAPe(p.destino?.floor, p.destino?.hasElevator);
  const custoDosAndares = andares * POR_ANDAR_SEM_ELEVADOR;
  const elevador = p.elevadorExterior ? ELEVADOR_EXTERIOR : 0;
  const t = p.tipologia ?? "itens";
  const daProtecao = p.protecao ? materiaisDeReferencia(PROTECAO_POR_TIPOLOGIA[t]) : {};
  const doEmbalamento = p.embalamento ? materiaisDeReferencia(EMBALAMENTO_POR_TIPOLOGIA[t]) : {};
  const valorProtecao = valorDosMateriais(daProtecao);
  const valorEmbalamento = valorDosMateriais(doEmbalamento);
  const valorAvulso = valorDosMateriais(p.materiais ?? {});
  const materiais = valorDosMateriais(somarQuantidades(daProtecao, doEmbalamento, p.materiais));
  const fixo = desl + custoDosAndares + elevador + materiais;
  const totalSemIvaMinimo = arred(maoMin + fixo);
  const totalSemIvaMaximo = arred(maoMax + fixo);
  const totalSemIva = arred((totalSemIvaMinimo + totalSemIvaMaximo) / 2);

  const linhas = [
    `${intervaloDeHorasEmTexto(intervalo).replace(/^entre/, "Entre")} × ${euros(PRECO_POR_HORA)} (viatura, motorista e 2 ajudantes) = ${eurosDeA(maoMin, maoMax)}`,
    desl > 0 ? `Deslocação: ${Number(p.kmPercurso).toFixed(0)} km × 2 × ${euros(PRECO_POR_KM_LONGE)} = ${euros(desl)} (mais portagens)` : null,
    andares > 0 ? `${andares} ${andares === 1 ? "andar" : "andares"} a pé × ${euros(POR_ANDAR_SEM_ELEVADOR)} = ${euros(custoDosAndares)}` : null,
    elevador > 0 ? `Elevador exterior: ${euros(elevador)}` : null,
    valorProtecao > 0 ? `Proteção (${materialEmTexto(PROTECAO_POR_TIPOLOGIA[t])}): ${euros(valorProtecao)}` : null,
    valorEmbalamento > 0 ? `Caixas e embalamento (${materialEmTexto(EMBALAMENTO_POR_TIPOLOGIA[t])}): ${euros(valorEmbalamento)}` : null,
    valorAvulso > 0 ? `Materiais de embalamento: ${euros(valorAvulso)}` : null,
  ].filter((l): l is string => l != null);

  return {
    horas,
    intervalo,
    maoDeObra: arred(horas * PRECO_POR_HORA),
    deslocacao: desl,
    andares,
    custoDosAndares,
    elevadorExterior: elevador,
    materiais,
    totalSemIva,
    totalComIva: arred(totalSemIva * (1 + TAXA_IVA)),
    totalSemIvaMinimo,
    totalSemIvaMaximo,
    totalComIvaMinimo: arred(totalSemIvaMinimo * (1 + TAXA_IVA)),
    totalComIvaMaximo: arred(totalSemIvaMaximo * (1 + TAXA_IVA)),
    linhas,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE SE DIZ — no site, nas mensagens
 * ────────────────────────────────────────────────────────────────────────── */

export const PRECO_POR_HORA_COM_IVA = arred(PRECO_POR_HORA * (1 + TAXA_IVA));

/** A deslocação numa frase. */
export const DESLOCACAO_DA_MUDANCA =
  `Até ${RAIO_INCLUIDO_KM} km a deslocação está incluída; acima disso, ${euros(PRECO_POR_KM_LONGE)} por km (ida e volta), mais portagens.`;

/**
 * A MESMA DESLOCAÇÃO, A MEIO DE UMA FRASE E PARA O MODELO — 10-11-2026 (d28).
 *
 * Uma FAQ de cidade dizia «acima de 50 km 1,30 € por km» escrito à mão, e o
 * aviso ao modelo dizia outra regra («percurso >30km: +30min», sem custo de
 * deslocação). Quem fala da distância de uma mudança lê uma destas — o teste
 * da orquestra chumba os números à mão.
 */
export const DESLOCACAO_DA_MUDANCA_CURTA =
  `acima de ${RAIO_INCLUIDO_KM} km, ${euros(PRECO_POR_KM_LONGE)} por km, ida e volta`;
export const DESLOCACAO_DA_MUDANCA_PARA_O_MODELO =
  `até ${RAIO_INCLUIDO_KM} km incluída; acima, ${PRECO_POR_KM_LONGE} €/km sobre todos os km, ida e volta, mais portagens`;

/** O mínimo de uma mudança sem extras: as horas mínimas da equipa, sem IVA. */
export const MINIMO_DA_MUDANCA = PRECO_POR_HORA * MINIMO_DE_HORAS;

/*
 * OS TEXTOS DO PREÇO DA HORA SAÍRAM DAQUI — 11-11-2026. Desde 10–11-11 as
 * mudanças são ao preço de cada parceiro: o «desde», a referência, os títulos,
 * os dados estruturados e o aviso ao modelo estão em
 * `preco-publico-das-mudancas.ts`. Esta tabela fica como REFERÊNCIA (quando
 * não há parceiros na lista) e para o motor que estima.
 */

/** O que pesa numa mudança, sem números: as horas e a tarifa do parceiro. */
export const EXTRAS_DA_MUDANCA =
  "Andares sem elevador, desmontagem e montagem de móveis pesam nas horas; os km e o material de embalamento " +
  "são os da tarifa do parceiro que escolher.";

/** O mesmo valor com IVA, escrito como a tabela os escreve («61,50 €»). */
const comIvaEscrito = (v: number) => euros(arred(v * (1 + TAXA_IVA)));

/**
 * Uma linha da tabela: o que é, o valor sem IVA e, quando há número, o mesmo
 * com IVA — que vai por baixo, em letra pequena.
 */
export type LinhaDaTabelaDasMudancas = [oQue: string, semIva: string, comIva?: string];

/**
 * A tabela toda, em linhas, para o site e para quem a pedir. Sem IVA, e cada
 * número com o com IVA ao lado desde 31-10-2026 — a tabela de /mudancas dizia
 * «Valores sem IVA (23 %)» por baixo de números nus.
 */
export function tabelaEmLinhas(): Array<{ titulo: string; linhas: LinhaDaTabelaDasMudancas[] }> {
  return [
    {
      titulo: "Mão de obra e viatura",
      linhas: [
        ["Carrinha + motorista + 2 ajudantes", `${euros(PRECO_POR_HORA)} / hora`, `${comIvaEscrito(PRECO_POR_HORA)} / hora com IVA`],
        ["Mínimo", `${MINIMO_DE_HORAS} horas`],
        ["Desmontagem e montagem de móveis", "acrescenta horas de trabalho"],
      ],
    },
    {
      titulo: "Deslocação",
      linhas: [
        [`Mudanças locais (até ${RAIO_INCLUIDO_KM} km)`, "incluída na tarifa horária"],
        [
          `Longas distâncias (mais de ${RAIO_INCLUIDO_KM} km)`,
          `${euros(PRECO_POR_KM_LONGE)} / km, ida e volta, mais portagens`,
          `${comIvaEscrito(PRECO_POR_KM_LONGE)} / km com IVA`,
        ],
      ],
    },
    {
      titulo: "Acessos",
      linhas: [
        [
          "Cada andar sem elevador",
          `${euros(POR_ANDAR_SEM_ELEVADOR_POR_PESSOA)} por pessoa (${euros(POR_ANDAR_SEM_ELEVADOR)} a equipa)`,
          `${comIvaEscrito(POR_ANDAR_SEM_ELEVADOR_POR_PESSOA)} por pessoa (${comIvaEscrito(POR_ANDAR_SEM_ELEVADOR)} a equipa) com IVA`,
        ],
        [
          "Elevador exterior (andares altos sem elevador)",
          `${euros(ELEVADOR_EXTERIOR)} / serviço`,
          `${comIvaEscrito(ELEVADOR_EXTERIOR)} / serviço com IVA`,
        ],
      ],
    },
    {
      titulo: "Materiais de embalamento",
      linhas: MATERIAIS.map(
        (m): LinhaDaTabelaDasMudancas => [m.nome, `${euros(m.preco)} / ${m.unidade}`, `${comIvaEscrito(m.preco)} / ${m.unidade} com IVA`],
      ),
    },
  ];
}

/* ── A REFERÊNCIA DE UMA CASA, COM A PROTEÇÃO — 11-11-2026 ──────────────── */

/** «310,00–410,00 € + IVA (381,30–504,30 € com IVA)» — o sem IVA nunca sozinho. */
export function faixaDaMudancaEmTexto(deSemIva: number, ateSemIva: number): string {
  return `${eurosDeA(deSemIva, ateSemIva)} + IVA (${eurosDeA(arred(deSemIva * (1 + TAXA_IVA)), arred(ateSemIva * (1 + TAXA_IVA)))} com IVA)`;
}

/** A estimativa de referência de uma casa (equipa de 3, com a proteção, sem andares nem km). */
export function referenciaDaCasa(t: Tipologia, desmontagem = false): OrcamentoDaMudanca {
  return orcamentoDaMudanca({ tipologia: t, desmontagem, protecao: true });
}
