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
/** Desmontar e montar móveis acrescenta horas à equipa. */
export const HORAS_A_MAIS_COM_DESMONTAGEM = 1;

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
 * AS HORAS, PELA TIPOLOGIA
 * ────────────────────────────────────────────────────────────────────────── */

export type Tipologia = "itens" | "T0" | "T1" | "T2" | "T3" | "T4+";

/**
 * Quantas horas se contam antes de alguém ver o trabalho — a proposta aceite
 * pelo dono a 13-10-2026. «itens» é a pequena mudança: alguns móveis, sem casa
 * inteira.
 */
export const HORAS_POR_TIPOLOGIA: Record<Tipologia, number> = {
  itens: 3,
  T0: 3,
  T1: 3,
  T2: 4,
  T3: 5,
  "T4+": 7,
};

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
 * As horas estimadas — a tipologia, mais a desmontagem, nunca abaixo do
 * mínimo. Sem tipologia conhecida, conta-se o mínimo: o profissional diz
 * quantas prevê quando vir o trabalho.
 */
export function horasEstimadas(tipologia: Tipologia | null | undefined, desmontagem = false): number {
  const base = tipologia ? HORAS_POR_TIPOLOGIA[tipologia] : MINIMO_DE_HORAS;
  return Math.max(MINIMO_DE_HORAS, base + (desmontagem ? HORAS_A_MAIS_COM_DESMONTAGEM : 0));
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
};

export type OrcamentoDaMudanca = {
  horas: number;
  maoDeObra: number;
  deslocacao: number;
  andares: number;
  custoDosAndares: number;
  elevadorExterior: number;
  materiais: number;
  /** Tudo, sem IVA — o que o cliente paga antes do imposto. */
  totalSemIva: number;
  totalComIva: number;
  /** A conta linha a linha, para o profissional e para a equipa. */
  linhas: string[];
};

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const arred = (v: number) => Math.round(v * 100) / 100;

/**
 * A ESTIMATIVA DE UMA MUDANÇA, pela tabela. É uma estimativa: a mudança paga-se
 * pelas horas feitas no dia — o que aqui se calcula é o que se espera.
 */
export function orcamentoDaMudanca(p: PedidoDeMudanca): OrcamentoDaMudanca {
  const horas = horasEstimadas(p.tipologia, p.desmontagem === true);
  const maoDeObra = arred(horas * PRECO_POR_HORA);
  const desl = deslocacao(p.kmPercurso);
  const andares =
    andaresAPe(p.origem?.floor, p.origem?.hasElevator) + andaresAPe(p.destino?.floor, p.destino?.hasElevator);
  const custoDosAndares = andares * POR_ANDAR_SEM_ELEVADOR;
  const elevador = p.elevadorExterior ? ELEVADOR_EXTERIOR : 0;
  const materiais = arred(
    MATERIAIS.reduce((s, m) => s + Math.max(0, Math.floor(p.materiais?.[m.id] ?? 0)) * m.preco, 0),
  );
  const totalSemIva = arred(maoDeObra + desl + custoDosAndares + elevador + materiais);

  const linhas = [
    `${horas} h × ${euros(PRECO_POR_HORA)} (viatura, motorista e 2 ajudantes) = ${euros(maoDeObra)}`,
    desl > 0 ? `Deslocação: ${Number(p.kmPercurso).toFixed(0)} km × 2 × ${euros(PRECO_POR_KM_LONGE)} = ${euros(desl)} (mais portagens)` : null,
    andares > 0 ? `${andares} ${andares === 1 ? "andar" : "andares"} a pé × ${euros(POR_ANDAR_SEM_ELEVADOR)} = ${euros(custoDosAndares)}` : null,
    elevador > 0 ? `Elevador exterior: ${euros(elevador)}` : null,
    materiais > 0 ? `Materiais de embalamento: ${euros(materiais)}` : null,
  ].filter((l): l is string => l != null);

  return {
    horas,
    maoDeObra,
    deslocacao: desl,
    andares,
    custoDosAndares,
    elevadorExterior: elevador,
    materiais,
    totalSemIva,
    totalComIva: arred(totalSemIva * (1 + TAXA_IVA)),
    linhas,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE SE DIZ — no site, nas mensagens
 * ────────────────────────────────────────────────────────────────────────── */

export const PRECO_POR_HORA_COM_IVA = arred(PRECO_POR_HORA * (1 + TAXA_IVA));

/** «50 € + IVA por hora · mínimo 3 horas» — para os cartões e as etiquetas. */
export const PRECO_DA_MUDANCA_CURTO = `${PRECO_POR_HORA} € + IVA por hora · mínimo ${MINIMO_DE_HORAS} horas`;

/** A deslocação numa frase. */
export const DESLOCACAO_DA_MUDANCA =
  `Até ${RAIO_INCLUIDO_KM} km a deslocação está incluída; acima disso, ${euros(PRECO_POR_KM_LONGE)} por km (ida e volta), mais portagens.`;

/** A frase inteira, para uma página ou uma resposta. */
export const PRECO_DA_MUDANCA_POR_EXTENSO =
  `${euros(PRECO_POR_HORA)} + IVA por hora (${euros(PRECO_POR_HORA_COM_IVA)} com IVA), ` +
  `com carrinha, motorista e 2 ajudantes — mínimo de ${MINIMO_DE_HORAS} horas. ` +
  DESLOCACAO_DA_MUDANCA;

/*
 * O PREÇO À HORA NOS TÍTULOS E NAS DESCRIÇÕES — 14-10-2026.
 *
 * «Mantenha as mudanças a 50 € + IVA por hora» — o dono, depois de a
 * auditoria de SEO notar que os 61,50 €/h com IVA ficam acima das
 * referências públicas. O número fica, e diz-se logo para quantas pessoas é:
 * a equipa toda, com a carrinha. As páginas de mudanças não diziam preço
 * nenhum no Google («Sem Stress», «Orçamento em 6h»).
 */

/** Para títulos, por ordem de preferência — fica o primeiro que couber nos 60 caracteres. */
export const PRECO_DA_MUDANCA_NO_TITULO = [
  `Equipa de ${PESSOAS_NA_EQUIPA} a ${PRECO_POR_HORA} €/h + IVA`,
  `${PRECO_POR_HORA} €/h + IVA`,
] as const;

/** Para uma descrição: o número e para quantos é. Sem ponto final. */
export const PRECO_DA_MUDANCA_NA_DESCRICAO =
  `${PRECO_POR_HORA} €/h + IVA pela equipa de ${PESSOAS_NA_EQUIPA} (carrinha, motorista e 2 ajudantes), ` +
  `mínimo ${MINIMO_DE_HORAS} horas`;

/*
 * O PREÇO DA HORA NOS DADOS ESTRUTURADOS — 17-10-2026.
 *
 * As páginas de mudanças tiraram o `offers` porque declaravam ao Google um
 * preço que o motor não praticava («desde 150 €», quando facturava 490 €).
 * Desde 13-10-2026 a tabela à hora está à vista em todas elas, e é ela que se
 * declara: o mesmo número, à hora, sem IVA. Um sítio só, para as páginas não
 * divergirem.
 */
export const OFERTA_DA_MUDANCA = {
  "@type": "Offer",
  priceCurrency: "EUR",
  priceSpecification: {
    "@type": "UnitPriceSpecification",
    price: PRECO_POR_HORA,
    priceCurrency: "EUR",
    unitCode: "HUR",
    unitText: "hora",
    valueAddedTaxIncluded: false,
  },
} as const;

/** O mínimo de uma mudança sem extras: as horas mínimas da equipa, sem IVA. */
export const MINIMO_DA_MUDANCA = PRECO_POR_HORA * MINIMO_DE_HORAS;

/** Os extras numa frase — andares, elevador exterior, desmontagem, materiais. */
export const EXTRAS_DA_MUDANCA =
  `Cada andar sem elevador acresce ${euros(POR_ANDAR_SEM_ELEVADOR_POR_PESSOA)} por pessoa ` +
  `(${euros(POR_ANDAR_SEM_ELEVADOR)} para a equipa de ${PESSOAS_NA_EQUIPA}); elevador exterior, ${euros(ELEVADOR_EXTERIOR)}; ` +
  `desmontar e montar móveis acrescenta horas; os materiais de embalamento pagam-se à parte, pela tabela.`;

/** As regras, para o aviso ao modelo que estima — a mesma tabela, em texto. */
export const REGRAS_DA_MUDANCA_PARA_O_MODELO = `MUDANÇA — À HORA (tabela CLYON, valores sem IVA, o que o cliente paga):
  Carrinha + motorista + 2 ajudantes: ${PRECO_POR_HORA} €/hora, mínimo ${MINIMO_DE_HORAS} horas.
  HORAS ESTIMADAS PELA TIPOLOGIA: ${(Object.keys(HORAS_POR_TIPOLOGIA) as Tipologia[])
    .map((t) => `${TIPOLOGIA_POR_EXTENSO[t]} ${HORAS_POR_TIPOLOGIA[t]}h`)
    .join(" · ")} · desmontagem/montagem +${HORAS_A_MAIS_COM_DESMONTAGEM}h.
  Deslocação: até ${RAIO_INCLUIDO_KM} km incluída; acima, ${PRECO_POR_KM_LONGE} €/km sobre todos os km, ida e volta, mais portagens.
  Cada andar sem elevador: ${POR_ANDAR_SEM_ELEVADOR_POR_PESSOA} € por pessoa (${POR_ANDAR_SEM_ELEVADOR} € a equipa de ${PESSOAS_NA_EQUIPA}).
  Elevador exterior: ${ELEVADOR_EXTERIOR} € por serviço. Materiais de embalamento à parte, pela tabela.
  O preço é POR HORA: o total sai das horas feitas no dia; isto é só a estimativa.`;

/** A tabela toda, em linhas, para o site e para quem a pedir. Sem IVA. */
export function tabelaEmLinhas(): Array<{ titulo: string; linhas: Array<[string, string]> }> {
  return [
    {
      titulo: "Mão de obra e viatura",
      linhas: [
        ["Carrinha + motorista + 2 ajudantes", `${euros(PRECO_POR_HORA)} / hora`],
        ["Mínimo", `${MINIMO_DE_HORAS} horas`],
        ["Desmontagem e montagem de móveis", "acrescenta horas de trabalho"],
      ],
    },
    {
      titulo: "Deslocação",
      linhas: [
        [`Mudanças locais (até ${RAIO_INCLUIDO_KM} km)`, "incluída na tarifa horária"],
        [`Longas distâncias (mais de ${RAIO_INCLUIDO_KM} km)`, `${euros(PRECO_POR_KM_LONGE)} / km, ida e volta, mais portagens`],
      ],
    },
    {
      titulo: "Acessos",
      linhas: [
        ["Cada andar sem elevador", `${euros(POR_ANDAR_SEM_ELEVADOR_POR_PESSOA)} por pessoa (${euros(POR_ANDAR_SEM_ELEVADOR)} a equipa)`],
        ["Elevador exterior (andares altos sem elevador)", `${euros(ELEVADOR_EXTERIOR)} / serviço`],
      ],
    },
    {
      titulo: "Materiais de embalamento",
      linhas: MATERIAIS.map((m) => [m.nome, `${euros(m.preco)} / ${m.unidade}`] as [string, string]),
    },
  ];
}
