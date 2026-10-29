import {
  ENTULHO_ATE_10_SACOS,
  ENTULHO_POR_M3_ACIMA_DE_1,
  ESVAZIAMENTO_POR_TIPOLOGIA,
  PECAS_DE_REFERENCIA,
  PRECOS,
  desdeDoVolume,
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
 * ENTULHO — por volume, a partir do preço por m³
 * ────────────────────────────────────────────────────────────────────────── */

export const ENTULHO_POR_M3 = exigir(PRECOS.recolha_entulho.minimo, "recolha_entulho");

/** Os volumes da grelha, em m³ — os da página /recolha-de-entulho. */
const VOLUMES: Array<{ m3: number; exemplo: string }> = [
  { m3: 1, exemplo: "Remodelação de uma casa de banho ou de uma cozinha" },
  { m3: 3, exemplo: "Obra num apartamento T1 ou T2" },
  { m3: 5, exemplo: "Demolições e renovações completas" },
];

export function linhasDoEntulho(): LinhaDaTabela[] {
  return [
    {
      oQue: "Até 10 sacos",
      exemplo: ENTULHO_ATE_10_SACOS.descricao,
      valor: { tipo: "faixa", de: ENTULHO_ATE_10_SACOS.minimo, ate: ENTULHO_ATE_10_SACOS.maximo },
    },
    ...VOLUMES.map(({ m3, exemplo }) => ({
      oQue: `Até ${m3} m³ (≈ ${m3 * SACOS_POR_METRO_CUBICO} sacos)`,
      exemplo,
      valor: { tipo: "desde", de: desdeDoVolume(m3) } as Valor,
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
 */
export type UnidadeDoEntulho = "sacos" | "m3" | "bigbags";

export type ReferenciaDoEntulho = { sacos: number; m3: number; valor: Valor };

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

  if (sacos <= 10) {
    return { sacos, m3, valor: { tipo: "faixa", de: ENTULHO_ATE_10_SACOS.minimo, ate: ENTULHO_ATE_10_SACOS.maximo } };
  }
  const maior = VOLUMES[VOLUMES.length - 1].m3;
  if (m3 > maior) return { sacos, m3, valor: { tipo: "orcamento" } };
  // Até 1 m³, o piso da grelha (120 €); daí para cima, 144 €/m³ — a conta que
  // dá os 432 € dos 3 m³ e os 720 € dos 5 m³ (17-10-2026).
  const de = m3 <= 1 ? ENTULHO_POR_M3 : Math.max(ENTULHO_POR_M3, Math.ceil(ENTULHO_POR_M3_ACIMA_DE_1 * m3));
  return { sacos, m3, valor: { tipo: "desde", de } };
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

export function linhasDosMonosEMoveis(): LinhaDaTabela[] {
  const monos = PRECOS.recolha_monos;
  const moveis = PRECOS.recolha_moveis;
  return [
    {
      oQue: "Recolha de monos",
      exemplo: "Peças volumosas soltas, como um colchão, um eletrodoméstico ou cadeiras",
      valor: { tipo: "faixa", de: exigir(monos.minimo, "recolha_monos"), ate: exigir(monos.maximo, "recolha_monos") },
    },
    {
      oQue: "Recolha de móveis",
      exemplo: "De uma peça pequena e acessível a uma pesada num 4.º andar sem elevador",
      valor: { tipo: "faixa", de: exigir(moveis.minimo, "recolha_moveis"), ate: exigir(moveis.maximo, "recolha_moveis") },
    },
    ...PECAS_DE_REFERENCIA.map((p) => ({
      oQue: p.peca,
      valor: { tipo: "faixa", de: p.minimo, ate: p.maximo } as Valor,
    })),
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
    {
      oQue: "Garagem ou arrecadação",
      exemplo: "Uma divisão cheia, sem a casa toda",
      valor: { tipo: "desde", de: exigir(PRECOS.esvaziamento_casa.minimo, "esvaziamento_casa") },
    },
    {
      oQue: "Só algumas peças",
      exemplo: "Quando não é a casa inteira, conta como recolha de móveis",
      valor: {
        tipo: "faixa",
        de: exigir(PRECOS.recolha_moveis.minimo, "recolha_moveis"),
        ate: exigir(PRECOS.recolha_moveis.maximo, "recolha_moveis"),
      },
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
      exemplo: `${euros(POR_ANDAR_SEM_ELEVADOR_POR_PESSOA)} por pessoa, para a equipa de ${PESSOAS_NA_EQUIPA}`,
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
