import {
  ENTULHO_ATE_10_SACOS,
  ESVAZIAMENTO_POR_ESPACO,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  NOME_DO_TAMANHO,
  PECAS_DE_REFERENCIA,
  MINIMO_DE_SACOS,
  PRECOS,
  PRECO_POR_ITEM,
  PRECO_POR_SACO,
  RECOLHA_MINIMA_DOS_MOVEIS,
  RECOLHA_POR_ANDAR_COM_ELEVADOR,
  RECOLHA_POR_ANDAR_SEM_ELEVADOR,
  faixaDoVolume,
  precoDaPeca,
  precoDosSacos,
} from "./precos-publicos";
import { PESO_DO_SACO, SACOS_POR_BIG_BAG, SACOS_POR_METRO_CUBICO } from "./sacos-de-entulho";
import {
  ELEVADOR_EXTERIOR,
  HORAS_A_MAIS_COM_DESMONTAGEM,
  HORAS_POR_TIPOLOGIA,
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  POR_ANDAR_SEM_ELEVADOR,
  POR_ANDAR_SEM_ELEVADOR_POR_PESSOA,
  PRECO_POR_HORA,
  PRECO_POR_KM_LONGE,
  RAIO_INCLUIDO_KM,
  TIPOLOGIA_POR_EXTENSO,
  andaresAPe,
  orcamentoDaMudanca,
  type PedidoDeMudanca,
  type Tipologia,
} from "./tabela-das-mudancas";
import { TAXA_IVA } from "./taxas-plataforma";

/**
 * AS PÁGINAS «QUANTO CUSTA» — 17-10-2026.
 *
 * *«Começa pelas páginas quanto custa.»* — o dono, depois do raio-X da
 * Fixando: ela é a primeira no Google em «quanto custa uma mudança em Lisboa»
 * e em «preço de remoção de entulho por m³», com médias de pedidos que não
 * batem certo de página para página. A CLYON tem uma tabela a sério e não
 * tinha uma página que respondesse a essa pergunta.
 *
 * Quatro páginas, uma por serviço, cada uma com a tabela, exemplos e a
 * recolha da câmara concelho a concelho — e não uma página por concelho com o
 * mesmo texto, que é o que a Fixando faz e o que o Google desvaloriza.
 *
 * NENHUM NÚMERO SE ESCREVE AQUI À MÃO. Saem de `precos-publicos.ts`,
 * `tabela-das-mudancas.ts` e `sacos-de-entulho.ts` — os mesmos que o motor e
 * as outras páginas lêem. Mudar um preço continua a ser mudar uma linha lá.
 * Os valores são sem IVA, e o com IVA vai sempre ao lado (a regra de
 * 14-10-2026: a referência sem IVA nunca sai sozinha).
 */

/** O dia em que as tabelas destas páginas se conferiram com o motor. */
export const TABELAS_REVISTAS_EM = "2026-10-17";

/** «17 de outubro de 2026». */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${dia} de ${meses[mes - 1]} de ${ano}`;
}

/** O ano das tabelas, para os títulos — o da revisão, e não o do relógio. */
export const ANO_DAS_TABELAS = Number(TABELAS_REVISTAS_EM.slice(0, 4));

/* ──────────────────────────────────────────────────────────────────────────
 * OS VALORES E COMO SE ESCREVEM
 * ────────────────────────────────────────────────────────────────────────── */

export type Valor =
  | { tipo: "faixa"; de: number; ate: number }
  | { tipo: "desde"; de: number }
  /** Uma estimativa — as mudanças, que se pagam pelas horas feitas no dia. */
  | { tipo: "cerca"; valor: number }
  | { tipo: "exacto"; valor: number }
  | { tipo: "orcamento" };

const arred = (v: number) => Math.round(v * 100) / 100;

/** O mesmo valor com o IVA. */
export const comIva = (v: number) => arred(v * (1 + TAXA_IVA));

/** «110 €», «135,30 €», «1 476 €». */
export function euros(v: number): string {
  const [inteiros, centimos] = arred(v).toFixed(2).split(".");
  const comEspacos = inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return centimos === "00" ? `${comEspacos} €` : `${comEspacos},${centimos} €`;
}

function escrever(v: Valor, conta: (n: number) => number, unidade?: string): string {
  const u = unidade ? ` / ${unidade}` : "";
  switch (v.tipo) {
    case "faixa":
      return `${euros(conta(v.de)).replace(" €", "")} – ${euros(conta(v.ate))}${u}`;
    case "desde":
      return `desde ${euros(conta(v.de))}${u}`;
    case "cerca":
      return `≈ ${euros(conta(v.valor))}${u}`;
    case "exacto":
      return `${euros(conta(v.valor))}${u}`;
    case "orcamento":
      return "proposta com fotos";
  }
}

/** O valor como está na tabela, sem IVA. */
export const semIvaEscrito = (v: Valor, unidade?: string) => escrever(v, (n) => n, unidade);
/** O mesmo, com o IVA. */
export const comIvaEscrito = (v: Valor, unidade?: string) => escrever(v, comIva, unidade);
/**
 * Os dois numa frase: «120 – 180 € + IVA (147,60 – 221,40 € com IVA)» — como
 * `faixaSemEComIva` de preco-de-referencia.ts, que não se importa aqui (ela
 * importa este ficheiro). Para o texto pequeno de uma linha, onde não há a
 * coluna «Com IVA» (31-10-2026).
 */
export const semEComIvaEscrito = (v: Valor, unidade?: string) =>
  v.tipo === "orcamento" ? semIvaEscrito(v) : `${semIvaEscrito(v, unidade)} + IVA (${comIvaEscrito(v, unidade)} com IVA)`;

export type LinhaDaTabela = {
  oQue: string;
  exemplo?: string;
  valor: Valor;
  unidade?: string;
};

function exigir(n: number | null | undefined, onde: string): number {
  if (n == null) throw new Error(`${onde} sem preço em precos-publicos.ts`);
  return n;
}

/* ──────────────────────────────────────────────────────────────────────────
 * ENTULHO — pelos sacos, ensacado ou a granel (d7, 04-11-2026)
 * ────────────────────────────────────────────────────────────────────────── */

/** O m³ de entulho, sem IVA: 40 sacos × 4,00–4,80 € = 160–192 € (d7; era «desde 120 €»). */
export const ENTULHO_POR_M3: { readonly de: number; readonly ate: number } = {
  de: exigir(PRECOS.recolha_entulho.minimo, "recolha_entulho"),
  ate: exigir(PRECOS.recolha_entulho.maximo, "recolha_entulho"),
};

/** Os volumes da grelha, em m³ — os da página /recolha-de-entulho. */
const VOLUMES: Array<{ m3: number; exemplo: string }> = [
  { m3: 1, exemplo: "Remodelação de uma casa de banho ou de uma cozinha" },
  { m3: 3, exemplo: "Obra num apartamento T1 ou T2" },
  { m3: 5, exemplo: "Demolições e renovações completas" },
];

/*
 * A GRELHA POR m³ SEGUE OS SACOS — 04-11-2026 (decisão d7, o dono): *«1 m³ a
 * granel ao mesmo preço que os sacos»*. Cada volume é a conta dos sacos que faz
 * (40 por m³), ensacados ou a granel: 1 m³ 160–192 €, 3 m³ 480–576 €, 5 m³
 * 800–960 € sem IVA. Era «Até 1 m³ (≈ 40 sacos) desde 120 €». O mínimo de 10
 * sacos (40–48 €) fica, e acima de 5 m³ continua a proposta com fotografias.
 */
export function linhasDoEntulho(): LinhaDaTabela[] {
  return [
    {
      oQue: "Até 10 sacos",
      exemplo: ENTULHO_ATE_10_SACOS.descricao,
      valor: { tipo: "faixa", de: ENTULHO_ATE_10_SACOS.minimo, ate: ENTULHO_ATE_10_SACOS.maximo },
    },
    ...VOLUMES.map(({ m3, exemplo }) => ({
      oQue: `${m3} m³ (≈ ${m3 * SACOS_POR_METRO_CUBICO} sacos, ou a granel)`,
      exemplo,
      valor: { tipo: "faixa", ...faixaDoVolume(m3) } as Valor,
    })),
    {
      oQue: `Mais de ${VOLUMES[VOLUMES.length - 1].m3} m³`,
      exemplo: "Volumes maiores: o parceiro faz a proposta a partir das fotografias",
      valor: { tipo: "orcamento" },
    },
  ];
}

/*
 * A CALCULADORA DA PÁGINA DE ENTULHO — 17-10-2026, decisão do dono.
 *
 * A 18-09 ficou que o cliente não via um preço calculado. A 17-10 o dono
 * abriu uma excepção para o entulho: uma REFERÊNCIA pela quantidade, como a
 * da recolhaentulho.pt, com o preço certo a vir na proposta. Por isso isto
 * não é o motor: é a grelha publicada lida ao contrário — a pessoa diz a
 * quantidade e recebe a linha da grelha que lhe cabe, com o «desde» à medida
 * do volume. As conversões são as da casa (40 sacos o m³, 38 o big bag).
 *
 * OS SACOS UM A UM — 03-11-2026 (decisão d4): os sacos e os big bags contam-se
 * a `PRECO_POR_SACO` cada (4,00–4,80 €; até 10, o mínimo de 10), numa faixa.
 * E O GRANEL TAMBÉM — 04-11-2026 (decisão d7): o volume em m³ conta-se pelos
 * sacos que faz (40 por m³), ao mesmo preço; «1 m³ a granel» = «40 sacos
 * ensacados». Acima de 5 m³ (200 sacos), proposta com fotografias, como antes.
 */
export type UnidadeDoEntulho = "sacos" | "m3" | "bigbags";

export type ReferenciaDoEntulho = {
  sacos: number;
  m3: number;
  valor: Valor;
  /** Contado saco a saco (a faixa de `precoDosSacos`) — também a granel desde a d7; `false` só acima da grelha. */
  porSaco: boolean;
};

export function referenciaDoEntulho(
  quantidade: number,
  unidade: UnidadeDoEntulho,
): ReferenciaDoEntulho | null {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return null;
  const sacos =
    unidade === "m3"
      ? Math.round(quantidade * SACOS_POR_METRO_CUBICO)
      : unidade === "bigbags"
        ? Math.round(quantidade * SACOS_POR_BIG_BAG)
        : Math.round(quantidade);
  if (sacos <= 0) return null;
  const m3 = arred(sacos / SACOS_POR_METRO_CUBICO);
  const dosSacos = (): ReferenciaDoEntulho => {
    const p = precoDosSacos(sacos);
    return { sacos, m3, valor: { tipo: "faixa", de: p.de, ate: p.ate }, porSaco: true };
  };

  if (sacos <= MINIMO_DE_SACOS) return dosSacos();
  const maior = VOLUMES[VOLUMES.length - 1].m3;
  if (m3 > maior) return { sacos, m3, valor: { tipo: "orcamento" }, porSaco: false };
  // Em sacos, em big bags ou a granel, a mesma conta (d7, 04-11-2026): era a
  // grelha por m³, «desde 120 €» até 1 m³ e 144 €/m³ daí para cima.
  return dosSacos();
}

/** «4,00–4,80 €» — o preço de um saco, sempre com os cêntimos. */
const comCentimos = (v: number) => arred(v).toFixed(2).replace(".", ",");
export const PRECO_DO_SACO_EM_TEXTO = `${comCentimos(PRECO_POR_SACO.minimo)}–${comCentimos(PRECO_POR_SACO.maximo)} €`;

/** «200–240 €», «152–182,40 €» — sem espaços, como na conta do dono. */
const faixaNaConta = (de: number, ate: number) => `${euros(de).replace(" €", "")}–${euros(ate)}`;
const sacosEscritos = (n: number) => `${n} ${n === 1 ? "saco" : "sacos"}`;

/**
 * A CONTA DOS SACOS À VISTA — 03-11-2026 (d4): «50 sacos × 4,00–4,80 € =
 * 200–240 € + IVA». Com `antes`, o que a pessoa disse vem primeiro: «1 big bag
 * = 38 sacos × 4,00–4,80 € = 152–182,40 € + IVA». Até 10 sacos, o mínimo: «5
 * sacos: conta o mínimo de 10 sacos × 4,00–4,80 € = 40–48 € + IVA».
 */
export function contaDosSacosEmTexto(sacos: number, antes?: string, ligacao = "="): string {
  const n = Math.max(0, Math.round(sacos));
  const p = precoDosSacos(n);
  const conta = `× ${PRECO_DO_SACO_EM_TEXTO} = ${faixaNaConta(p.de, p.ate)} + IVA`;
  if (n < MINIMO_DE_SACOS) return `${antes ?? sacosEscritos(n)}: conta o mínimo de ${sacosEscritos(MINIMO_DE_SACOS)} ${conta}`;
  return `${antes ? `${antes} ${ligacao} ` : ""}${sacosEscritos(n)} ${conta}`;
}

/*
 * OS ANDARES, POR TRABALHO — 03-11-2026 (decisão d4, e nos móveis por peça desde
 * a d6): `RECOLHA_POR_ANDAR_COM_ELEVADOR` por andar com elevador (também o
 * pequeno), `RECOLHA_POR_ANDAR_SEM_ELEVADOR` por andar a pé; o estacionamento a
 * mais de 30 m ou difícil conta como mais um andar sem elevador; no rés-do-chão
 * nada; com «não sei» se há elevador, não se soma e o parceiro confirma na
 * proposta. Não depende da quantidade. A mesma conta para a referência (R12 e o
 * simulador do site), a calculadora e o motor. Substitui a regra da d1 v2
 * (+15 € por m³ e por andar sem elevador).
 */
export type AcessoDoEntulho = { floor?: string | number | null; hasElevator?: string | null; parkingDistance?: string | null };

export type SuplementoDosAndares = {
  /** O número do andar (0 no rés-do-chão ou sem andar). */
  andar: number;
  /** Os andares com elevador que se contam (com «sim» ou «pequeno»). */
  andaresComElevador: number;
  /** Os andares a pé (só com «não tem elevador»). */
  andaresAPe: number;
  /** O estacionamento longe, que conta como mais um andar sem elevador. */
  estacionamentoLonge: boolean;
  /** Do 1.º andar para cima, sem saber se há elevador: não se conta, o parceiro confirma. */
  naoSabeOElevador: boolean;
  /** Os andares com elevador, sem IVA. */
  valorComElevador: number;
  /** Os andares a pé, sem IVA. */
  valorAPe: number;
  /** Tudo, sem IVA. */
  valor: number;
};

export function suplementoDosAndares(a: AcessoDoEntulho | null | undefined): SuplementoDosAndares {
  // O número do andar, com ou sem elevador («4º+» conta 4; o rés-do-chão, 0).
  const andar = andaresAPe(a?.floor, "no");
  const comElevador = a?.hasElevator === "yes" || a?.hasElevator === "small";
  const andaresComElevador = comElevador ? andar : 0;
  const aPe = a?.hasElevator === "no" ? andar : 0;
  const naoSabeOElevador = a?.hasElevator === "unknown" && andar > 0;
  const estacionamentoLonge = a?.parkingDistance === "over_30m" || a?.parkingDistance === "difficult";
  const valorComElevador = arred(RECOLHA_POR_ANDAR_COM_ELEVADOR * andaresComElevador);
  const valorAPe = arred(RECOLHA_POR_ANDAR_SEM_ELEVADOR * aPe);
  const valorDoEstacionamento = estacionamentoLonge ? RECOLHA_POR_ANDAR_SEM_ELEVADOR : 0;
  return {
    andar,
    andaresComElevador,
    andaresAPe: aPe,
    estacionamentoLonge,
    naoSabeOElevador,
    valorComElevador,
    valorAPe,
    valor: arred(valorComElevador + valorAPe + valorDoEstacionamento),
  };
}

/** «3.º andar», «4.º andar ou acima» — o nome do andar para as linhas da conta. */
const andarEscrito = (floor: string | number | null | undefined, n: number) =>
  floor === "4º+" ? "4.º andar ou acima" : `${n}.º andar`;

/**
 * Os andares na conta, como o dono os escreveu: «2.º andar com elevador: +10 €
 * + IVA», «3.º andar sem elevador: +45 € + IVA», «Estacionamento a mais de 30
 * metros, como mais um andar sem elevador: +15 € + IVA». Vazio no rés-do-chão.
 */
export function linhasDosAndares(s: SuplementoDosAndares, a: AcessoDoEntulho | null | undefined): string[] {
  const l: string[] = [];
  const andar = s.andar > 0 ? andarEscrito(a?.floor, s.andar) : null;
  if (andar && s.andaresComElevador > 0) l.push(`${andar} com elevador: +${euros(s.valorComElevador)} + IVA`);
  if (andar && s.andaresAPe > 0) l.push(`${andar} sem elevador: +${euros(s.valorAPe)} + IVA`);
  if (s.estacionamentoLonge) {
    const nome = a?.parkingDistance === "difficult" ? "Estacionamento difícil" : "Estacionamento a mais de 30 metros";
    l.push(`${nome}, como mais um andar sem elevador: +${euros(RECOLHA_POR_ANDAR_SEM_ELEVADOR)} + IVA`);
  }
  if (andar && s.naoSabeOElevador) l.push(`${andar}, sem saber se há elevador: o parceiro confirma na proposta.`);
  return l;
}

/** «Cada andar soma +5 € + IVA (6,15 € com IVA) com elevador e +15 € + IVA (18,45 € com IVA) sem elevador; …» — para as páginas. */
export const ANDARES_DO_ENTULHO_EM_FRASE =
  `Cada andar soma ${euros(RECOLHA_POR_ANDAR_COM_ELEVADOR)} + IVA (${euros(comIva(RECOLHA_POR_ANDAR_COM_ELEVADOR))} com IVA) com elevador ` +
  `e ${euros(RECOLHA_POR_ANDAR_SEM_ELEVADOR)} + IVA (${euros(comIva(RECOLHA_POR_ANDAR_SEM_ELEVADOR))} com IVA) sem elevador, por trabalho; ` +
  "o estacionamento a mais de 30 metros ou difícil conta como mais um andar sem elevador, e no rés-do-chão não há.";

/** O valor com o suplemento dos andares: as duas pontas da faixa, ou o «desde», sobem o mesmo. */
export function comOSuplemento(v: Valor, suplemento: number): Valor {
  if (!(suplemento > 0)) return v;
  switch (v.tipo) {
    case "faixa":
      return { tipo: "faixa", de: arred(v.de + suplemento), ate: arred(v.ate + suplemento) };
    case "desde":
      return { tipo: "desde", de: arred(v.de + suplemento) };
    case "cerca":
    case "exacto":
      return { ...v, valor: arred(v.valor + suplemento) };
    case "orcamento":
      return v;
  }
}

/** As medidas que as pessoas usam, convertidas — para a caixa «quanto é 1 m³». */
export const MEDIDAS_DO_ENTULHO = {
  sacosPorMetroCubico: SACOS_POR_METRO_CUBICO,
  sacosPorBigBag: SACOS_POR_BIG_BAG,
  pesoDoSaco: PESO_DO_SACO,
};

/* ──────────────────────────────────────────────────────────────────────────
 * MONOS E MÓVEIS — as duas faixas, e as peças de referência
 * ────────────────────────────────────────────────────────────────────────── */

/** As peças da recolha de móveis por tamanho (d6 v2, 03-11-2026), com os exemplos do simulador. */
const PECAS_POR_TAMANHO: ReadonlyArray<{ id: keyof typeof PRECO_POR_ITEM; oQue: string; exemplo: string }> = [
  { id: "pequeno", oQue: "Móveis: peça pequena", exemplo: "Micro-ondas, forno, mesinha de cabeceira" },
  { id: "medio", oQue: "Móveis: peça média", exemplo: "Fogão, frigorífico bar, cadeirão" },
  { id: "grande", oQue: "Móveis: peça grande", exemplo: "Sofá, armário, frigorífico, máquina de lavar" },
];

export function linhasDosMonosEMoveis(): LinhaDaTabela[] {
  const monos = PRECOS.recolha_monos;
  return [
    {
      oQue: "Recolha de monos",
      exemplo: "Peças volumosas soltas, como um colchão, um eletrodoméstico ou cadeiras",
      valor: { tipo: "faixa", de: exigir(monos.minimo, "recolha_monos"), ate: exigir(monos.maximo, "recolha_monos") },
    },
    // Os móveis por peça (d6 v2, 03-11-2026): era uma linha «40 – 120 €» pelo trabalho.
    ...PECAS_POR_TAMANHO.map((p): LinhaDaTabela => ({
      oQue: p.oQue,
      exemplo: p.exemplo,
      valor: { tipo: "exacto", valor: PRECO_POR_ITEM[p.id] },
      unidade: "peça",
    })),
    // A recolha mínima (d7, 04-11-2026): a soma das peças nunca fica abaixo dela.
    {
      oQue: "Móveis: recolha mínima",
      exemplo: "Uma peça pequena ou média sozinha conta a recolha mínima; os andares somam-se depois",
      valor: { tipo: "exacto", valor: RECOLHA_MINIMA_DOS_MOVEIS },
    },
    // Os exemplos pela tabela das peças (d7): eram faixas próprias, que chocavam com ela.
    ...PECAS_DE_REFERENCIA.map(
      (p): LinhaDaTabela => ({
        oQue: p.peca,
        exemplo: NOME_DO_TAMANHO[p.tamanho].charAt(0).toUpperCase() + NOME_DO_TAMANHO[p.tamanho].slice(1),
        valor: { tipo: "exacto", valor: precoDaPeca(p) },
      }),
    ),
  ];
}

/* ──────────────────────────────────────────────────────────────────────────
 * ESVAZIAMENTOS
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * As tipologias de `ESVAZIAMENTO_POR_TIPOLOGIA` — a grelha que
 * /esvaziamento-de-casas já mostrava —, e à volta delas o mínimo
 * (`esvaziamento_casa`, a garagem ou a arrecadação) e as peças soltas.
 */
export function linhasDoEsvaziamento(): LinhaDaTabela[] {
  const apartamentos = ESVAZIAMENTO_POR_TIPOLOGIA.map((t) => ({
    oQue: t.tipo,
    exemplo: t.maximo != null ? "Com recheio, conforme o volume, o andar e o elevador" : "A casa toda, com mais divisões, arrecadação ou quintal",
    valor: (t.maximo != null ? { tipo: "faixa", de: t.minimo, ate: t.maximo } : { tipo: "desde", de: t.minimo }) as Valor,
  }));
  return [
    ...apartamentos,
    // A garagem, o sótão e a cave, por faixa de volume (29-10-2026, `ESVAZIAMENTO_POR_ESPACO`).
    // Cada faixa com o com IVA ao lado (31-10-2026): dizia «… (sem IVA)» e mais nada.
    ...ESVAZIAMENTO_POR_ESPACO.map((e) => ({
      oQue: e.espaco,
      exemplo: (
        [
          ["Pouca coisa", e.faixas.carrinha],
          ["volume médio", e.faixas.camiao_caixa],
          ["cheia", e.faixas.camiao_lixo],
        ] as const
      )
        .map(([nome, f]) => `${nome} ${semEComIvaEscrito({ tipo: "faixa", de: f.de, ate: f.ate })}`)
        .join(", "),
      valor: { tipo: "faixa", de: e.faixas.carrinha.de, ate: e.faixas.camiao_lixo.ate } as Valor,
    })),
    {
      oQue: "Só algumas peças",
      exemplo:
        "Quando não é a casa inteira, conta como recolha de móveis, peça a peça, com a recolha mínima de " +
        `${euros(RECOLHA_MINIMA_DOS_MOVEIS)} + IVA (${euros(comIva(RECOLHA_MINIMA_DOS_MOVEIS))} com IVA)`,
      valor: { tipo: "faixa", de: PRECO_POR_ITEM.pequeno, ate: PRECO_POR_ITEM.grande },
      unidade: "peça",
    },
    {
      oQue: "Loja ou escritório",
      exemplo: "O parceiro faz a proposta a partir das fotografias",
      valor: { tipo: "orcamento" },
    },
  ];
}

/** Uma linha do esvaziamento pela tipologia — «T2», «moradia». */
export function linhaDoEsvaziamento(chave: string): LinhaDaTabela {
  const t = ESVAZIAMENTO_POR_TIPOLOGIA.find((x) => x.chave === chave);
  const linha = t && linhasDoEsvaziamento().find((l) => l.oQue === t.tipo);
  if (!linha) throw new Error(`Tipologia de esvaziamento desconhecida: ${chave}`);
  return linha;
}

/* ──────────────────────────────────────────────────────────────────────────
 * MUDANÇAS — à hora, pela tabela do dono (13-10-2026)
 * ────────────────────────────────────────────────────────────────────────── */

const TIPOLOGIAS: Tipologia[] = ["itens", "T0", "T1", "T2", "T3", "T4+"];

/** Uma linha por tipologia: as horas que se contam antes de alguém ver o trabalho. */
export function linhasDasMudancas(): LinhaDaTabela[] {
  return TIPOLOGIAS.map((t) => {
    const horas = HORAS_POR_TIPOLOGIA[t];
    return {
      oQue: t === "itens" ? "Pequena mudança (alguns móveis)" : TIPOLOGIA_POR_EXTENSO[t],
      exemplo: `≈ ${horas} horas da equipa de ${PESSOAS_NA_EQUIPA}`,
      valor: { tipo: "cerca", valor: orcamentoDaMudanca({ tipologia: t }).totalSemIva } as Valor,
    };
  });
}

/** Os extras da tabela, cada um com o seu valor. */
export function extrasDasMudancas(): LinhaDaTabela[] {
  return [
    {
      oQue: "Hora de trabalho a mais",
      exemplo: `Carrinha, motorista e 2 ajudantes · mínimo ${MINIMO_DE_HORAS} horas`,
      valor: { tipo: "exacto", valor: PRECO_POR_HORA },
      unidade: "hora",
    },
    {
      oQue: "Cada andar sem elevador",
      // Com o com IVA ao lado (31-10-2026): o valor por pessoa ia só sem IVA.
      exemplo: `${semEComIvaEscrito({ tipo: "exacto", valor: POR_ANDAR_SEM_ELEVADOR_POR_PESSOA })} por pessoa, para a equipa de ${PESSOAS_NA_EQUIPA}`,
      valor: { tipo: "exacto", valor: POR_ANDAR_SEM_ELEVADOR },
      unidade: "andar",
    },
    {
      oQue: "Desmontar e montar móveis",
      exemplo: `Acrescenta cerca de ${HORAS_A_MAIS_COM_DESMONTAGEM} hora`,
      valor: { tipo: "cerca", valor: HORAS_A_MAIS_COM_DESMONTAGEM * PRECO_POR_HORA },
    },
    {
      oQue: "Elevador exterior",
      exemplo: "Para andares altos sem elevador, ou peças que não cabem na escada",
      valor: { tipo: "exacto", valor: ELEVADOR_EXTERIOR },
      unidade: "serviço",
    },
    {
      oQue: `Percurso acima de ${RAIO_INCLUIDO_KM} km`,
      exemplo: "Todos os km, ida e volta, mais portagens",
      valor: { tipo: "exacto", valor: PRECO_POR_KM_LONGE },
      unidade: "km",
    },
  ];
}

export type ExemploDeMudanca = { titulo: string; pedido: PedidoDeMudanca; conta: string[]; totalSemIva: number };

/**
 * Mudanças inteiras, feitas pela mesma função que estima o pedido no
 * simulador e no backoffice — para o exemplo e a proposta não divergirem.
 */
export function exemplosDeMudanca(): ExemploDeMudanca[] {
  const casos: Array<{ titulo: string; pedido: PedidoDeMudanca }> = [
    {
      titulo: "T1 com elevador nas duas casas, dentro da mesma zona",
      pedido: { tipologia: "T1", origem: { floor: 2, hasElevator: "yes" }, destino: { floor: 4, hasElevator: "yes" } },
    },
    {
      titulo: "T2 de um 3.º andar sem elevador para um rés-do-chão",
      pedido: { tipologia: "T2", origem: { floor: 3, hasElevator: "no" }, destino: { floor: 0, hasElevator: "no" } },
    },
    {
      titulo: "T3 com desmontagem e montagem dos móveis",
      pedido: { tipologia: "T3", desmontagem: true, origem: { floor: 1, hasElevator: "yes" }, destino: { floor: 2, hasElevator: "yes" } },
    },
    {
      titulo: `T2 para uma casa a 120 km (fora dos ${RAIO_INCLUIDO_KM} km incluídos)`,
      pedido: { tipologia: "T2", kmPercurso: 120, origem: { floor: 1, hasElevator: "yes" }, destino: { floor: 0, hasElevator: "no" } },
    },
  ];
  return casos.map(({ titulo, pedido }) => {
    const o = orcamentoDaMudanca(pedido);
    return { titulo, pedido, conta: o.linhas, totalSemIva: o.totalSemIva };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * AS QUATRO PÁGINAS
 * ────────────────────────────────────────────────────────────────────────── */

export type PaginaDePreco = {
  caminho: string;
  /** O id do serviço no simulador (`?servico=`). */
  servico: string;
  /** O slug do serviço nas páginas de cidade (`recolha-entulho-almada`). */
  servicoDaCidade: string;
  /** A página do serviço, a que esta pertence. */
  paginaDoServico: string;
  nome: string;
  /** Sem « | CLYON»: o layout junta-o. Com ele, cabe nos 60. */
  titulo: string;
};

export const PAGINAS_DE_PRECO: PaginaDePreco[] = [
  {
    caminho: "/precos/recolha-de-entulho",
    servico: "recolha_entulho",
    servicoDaCidade: "recolha-entulho",
    paginaDoServico: "/recolha-de-entulho",
    nome: "Recolha de entulho",
    titulo: "Quanto Custa Recolher Entulho? Preços por m³ e Sacos",
  },
  {
    caminho: "/precos/recolha-de-monos-e-moveis",
    servico: "recolha_monos",
    servicoDaCidade: "recolha-monos",
    paginaDoServico: "/recolha-de-monos",
    nome: "Recolha de monos e móveis",
    titulo: `Quanto Custa Recolher Monos e Móveis? Preços ${ANO_DAS_TABELAS}`,
  },
  {
    caminho: "/precos/esvaziamento-de-casas",
    servico: "esvaziamento_casa",
    servicoDaCidade: "esvaziamento-casas",
    paginaDoServico: "/esvaziamento-de-casas",
    nome: "Esvaziamento de casas",
    titulo: `Quanto Custa Esvaziar uma Casa? Preços ${ANO_DAS_TABELAS}`,
  },
  {
    caminho: "/precos/mudancas",
    servico: "mudanca",
    servicoDaCidade: "mudancas",
    paginaDoServico: "/mudancas",
    nome: "Mudanças",
    titulo: "Quanto Custa uma Mudança? Preços por T0, T1, T2, T3",
  },
];

export function paginaDePreco(caminho: string): PaginaDePreco {
  const p = PAGINAS_DE_PRECO.find((x) => x.caminho === caminho);
  if (!p) throw new Error(`Página de preço desconhecida: ${caminho}`);
  return p;
}
