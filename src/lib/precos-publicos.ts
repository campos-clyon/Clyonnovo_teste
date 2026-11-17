/**
 * Os preços que o site mostra ao público.
 *
 * PORQUE É QUE ISTO PRECISA DE EXISTIR
 *
 * Porque não existia, e o resultado foi este: o mesmo serviço anunciado com
 * quatro números diferentes em quatro páginas, e nenhum deles a bater com o
 * que o motor cobrava. A recolha de entulho chegou a dizer 80 € no texto, 120
 * no schema que o Google lê, e 90 no motor — na mesma manhã. A página de
 * mudanças anunciava 150 € para um trabalho que o motor factura a 490.
 *
 * Nenhum destes números dá erro quando está errado. Compila, renderiza, e fica
 * ali a prometer um preço que não se pratica.
 *
 * A partir daqui há um sítio só. Mudar um preço é mudar uma linha, e muda em
 * todo o lado — grelha, metadados, dados estruturados e páginas de serviço.
 *
 * OS VALORES SÃO SEM IVA
 *
 * E isso tem de ser dito, não escondido. A CLYON é plataforma: quem executa o
 * trabalho emite a factura, e cada profissional tem o seu regime — uns na
 * isenção do artigo 53.º do CIVA, que não acrescentam nada, outros a liquidar
 * 23%. O site não sabe, no momento em que mostra o preço, quem vai ficar com
 * o trabalho.
 *
 * O que resolve isto sem enganar ninguém é a natureza do número: o que está na
 * grelha é ORIENTATIVO, e o preço a sério é a proposta que o profissional faz
 * — e essa já mostra a linha de imposto quando ele está no regime normal.
 * A nota que acompanha os preços diz exatamente isso.
 */

import { PESO_DO_SACO, SACOS_POR_METRO_CUBICO } from "./sacos-de-entulho";
import { PRECO_POR_HORA_DUAS_PESSOAS, MINIMO_DE_HORAS } from "./tabela-das-mudancas";

export type PrecoPublico = {
  /** O que aparece no cartão e no texto: "40 – 120 €", "desde 260 €". */
  etiqueta: string;
  /**
   * O piso, em euros e sem IVA — para os dados estruturados e para comparar
   * com o motor. `null` quando o serviço não tem preço publicado.
   */
  minimo: number | null;
  /** O tecto, quando a etiqueta é uma faixa. */
  maximo?: number;
  /** A unidade, quando o preço não é do trabalho todo. */
  unidade?: string;
  /**
   * O tecto só conta na estimativa de um pedido (o motor e a R12): ao público diz-se o
   * «desde» da etiqueta (d63, os monos).
   */
  tectoSoNaEstimativa?: boolean;
};

/*
 * OS MÓVEIS POR PEÇA — 29-10-2026 (S13 da app de cliente v3), e os preços do
 * dono de 03-11-2026 (decisão d6): *«55 € os itens grandes, 30 € o médio e 15 €
 * os pequenos, mais os 5 € por andar com elevador e 15 € sem»* — e na v2, uma
 * hora depois, a grande a 50 € (*«achei 184,50 muito para 2 itens»*). Eram 25,
 * 50 e 60 €, com um mínimo de 80 € por pedido — o mínimo acabou: conta-se peça a
 * peça, mais os andares (`RECOLHA_POR_ANDAR_*`). Um valor fixo, sem faixa.
 * Exemplo do dono: 2 grandes + 1 média num 2.º andar com elevador pequeno =
 * 2 × 50 + 30 + 2 × 5 = 140 € + IVA (172,20 € com IVA). O texto que se mostra
 * sai de `preco-de-referencia.ts`, sempre com o valor com IVA ao lado. Sem IVA.
 */
export const PRECO_POR_ITEM: Readonly<Record<"pequeno" | "medio" | "grande", number>> = {
  pequeno: 15,
  medio: 30,
  grande: 50,
};

/*
 * A PRIMEIRA PEÇA GRANDE — 16-11-2026 (decisão d60, o CEO e o dono). A primeira
 * peça grande de uma recolha conta 65 € sem IVA; as seguintes, 50 €
 * (`PRECO_POR_ITEM.grande`). As médias e as pequenas não mudam. Um sofá sozinho
 * fica em 65 € + IVA; dois sofás, 65 + 50 = 115 € + IVA. Sem IVA.
 */
export const PRECO_DA_PRIMEIRA_GRANDE = 65;

/** A peça mais cara da tabela (a primeira grande), para as faixas «15 a 65 €». */
export const PRECO_MAXIMO_DA_PECA = PRECO_DA_PRIMEIRA_GRANDE;

/** As grandes de uma recolha: a primeira a 65 €, as seguintes a 50 € (sem IVA). */
export function valorDasGrandes(n: number): number {
  const g = Math.max(0, Math.floor(n));
  return g === 0 ? 0 : PRECO_DA_PRIMEIRA_GRANDE + (g - 1) * PRECO_POR_ITEM.grande;
}

/*
 * A RECOLHA MÍNIMA DOS MÓVEIS — 04-11-2026 (decisão d7, o dono): *«recolha
 * mínima de 40 € + IVA»*. A soma das peças nunca fica abaixo dela; os andares e
 * o estacionamento somam-se DEPOIS do mínimo. Diz-se «recolha mínima» (já inclui
 * o parceiro ir a casa, carregar e levar ao destino certo), nunca «deslocação».
 * DESDE 16-11-2026 (d60): 60 € + IVA — a recolha mínima paga a saída do
 * parceiro. Os monos com as peças contadas seguem a mesma conta (d59). Sem IVA.
 */
export const RECOLHA_MINIMA_DOS_MOVEIS = 60;

/** «grande 65 € a primeira e 50 € as seguintes» — as grandes (d60). */
export const GRANDES_EM_TEXTO = `grande ${PRECO_DA_PRIMEIRA_GRANDE} € a primeira e ${PRECO_POR_ITEM.grande} € as seguintes`;

/** «pequena 15 €, média 30 €, grande 65 € a primeira e 50 € as seguintes» — as peças pela ordem, sem IVA. */
export const PECAS_EM_TEXTO = `pequena ${PRECO_POR_ITEM.pequeno} €, média ${PRECO_POR_ITEM.medio} €, ${GRANDES_EM_TEXTO}`;

/**
 * «por peça: pequena 15 €, média 30 €, grande 50 € + IVA; recolha mínima 40 € +
 * IVA» — a etiqueta da recolha de móveis (d6; o mínimo desde a d7). Já leva o
 * «+ IVA» dos dois números (`maisIva` não lhe acrescenta outro).
 */
export const ETIQUETA_DOS_MOVEIS = `por peça: ${PECAS_EM_TEXTO} + IVA; recolha mínima ${RECOLHA_MINIMA_DOS_MOVEIS} € + IVA`;

/** O mínimo da manutenção da casa, sem IVA — o «desde» publicado e o piso da grelha por tipo (03-11-2026). */
export const MINIMO_DA_MANUTENCAO = 57;

/*
 * O SACO PEQUENO A 4,00–4,80 € — 03-11-2026 (decisão d4, aprovada pelo dono).
 *
 * O saco de obra de 25 a 30 kg («como os do Leroy Merlin») conta-se um a um:
 * 4,00 a 4,80 € sem IVA cada. 10 sacos passam de 40–50 € a 40–48 €; 50 sacos
 * são 200–240 €; um big bag conta como 38 sacos (`SACOS_POR_BIG_BAG`), ou seja
 * 152–182,40 €. Até 10 sacos conta o mínimo de 10 — o mínimo de uma recolha (a
 * deslocação é a mesma para dois ou para dez). Sem IVA.
 *
 * E O GRANEL AO MESMO PREÇO — 04-11-2026 (decisão d7, o dono): o entulho solto
 * conta-se pelos sacos que faria, 40 por m³ (`SACOS_POR_METRO_CUBICO`). 1 m³ a
 * granel = 40 sacos × 4,00–4,80 € = 160–192 € + IVA, o mesmo que 40 sacos
 * ensacados. A grelha por m³ (`ENTULHO_POR_VOLUME`) sai daqui. Era «até 1 m³
 * desde 120 €, 3 m³ desde 432 €, 5 m³ desde 720 €».
 */
export const PRECO_POR_SACO = { minimo: 4, maximo: 4.8 } as const;

/** Até aqui conta-se o mínimo de uma recolha: 10 sacos. */
export const MINIMO_DE_SACOS = 10;

const emCentimos = (v: number) => Math.round(v * 100) / 100;

/** «1 300» — os milhares com espaço, como `euros` (quanto-custa.ts) os escreve. */
const milhares = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Estes sacos, um a um, sem IVA — até 10, o mínimo de 10. */
export function precoDosSacos(sacos: number): { de: number; ate: number } {
  const n = Math.max(MINIMO_DE_SACOS, Math.round(sacos));
  return { de: emCentimos(n * PRECO_POR_SACO.minimo), ate: emCentimos(n * PRECO_POR_SACO.maximo) };
}

/** 1 m³ de entulho, ensacado ou a granel: 40 sacos (160–192 € sem IVA). */
const UM_METRO_CUBICO = precoDosSacos(SACOS_POR_METRO_CUBICO);

/*
 * DESDE 16-11-2026 (d60): T2 400–600 €, T3 650–950 €, T4 900–1 300 € e a
 * moradia desde 900 € (o T3 e o T4 separaram-se: eram «T3/T4 380–450 €»). O
 * T0/T1 fica. A chave antiga «T3/T4» lê-se como T3 (`lerTipologiaDoEsvaziamento`).
 */
export const ESVAZIAMENTO_POR_TIPOLOGIA: ReadonlyArray<{ chave: string; tipo: string; minimo: number; maximo?: number }> = [
  { chave: "T0/T1", tipo: "Apartamento T0/T1", minimo: 260, maximo: 350 },
  { chave: "T2", tipo: "Apartamento T2", minimo: 400, maximo: 600 },
  { chave: "T3", tipo: "Apartamento T3", minimo: 650, maximo: 950 },
  { chave: "T4", tipo: "Apartamento T4 ou maior", minimo: 900, maximo: 1300 },
  { chave: "moradia", tipo: "Moradia completa", minimo: 900 },
];

/** Do piso ao tecto dos apartamentos de `ESVAZIAMENTO_POR_TIPOLOGIA` (a moradia não tem tecto). */
const APARTAMENTOS = (() => {
  const comTecto = ESVAZIAMENTO_POR_TIPOLOGIA.filter((t) => t.maximo != null);
  return { minimo: Math.min(...comTecto.map((t) => t.minimo)), maximo: Math.max(...comTecto.map((t) => t.maximo as number)) };
})();

/**
 * OS MONOS SEM PEÇAS CONTADAS, NO MOTOR — 65 € sem IVA (17-11-2026, acerto da d63).
 * É o que o motor dava antes da d63 (o meio da faixa antiga, 30 – 100 €): a d63 só
 * mudava o que se DIZ («desde 60 €», a recolha mínima), não o preço. Ao subir o piso
 * da faixa para 60, o meio passou a 80 € sem ninguém o decidir. Fica escrito aqui,
 * e muda só por decisão do dono; nunca abaixo da recolha mínima.
 */
export const MONOS_SEM_PECAS_CONTADAS = 65;

/** O piso do T0/T1, o «desde» do esvaziamento de casa (d63). */
const PISO_DO_T0_T1 = ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === "T0/T1")!.minimo;

export const PRECOS: Record<string, PrecoPublico> = {
  /*
   * POR PEÇA DESDE 03-11-2026 (d6): era «40 – 120 €» pelo trabalho; a conta de
   * um pedido é peça a peça, `PRECO_POR_ITEM`, mais os andares. Desde a d7
   * (04-11-2026) o piso é a recolha mínima — o «desde 40 €» —, e a etiqueta diz
   * as peças e o mínimo. Sem tecto: cada peça tem o seu valor.
   */
  recolha_moveis: { etiqueta: ETIQUETA_DOS_MOVEIS, minimo: RECOLHA_MINIMA_DOS_MOVEIS },
  /*
   * DESDE 17-11-2026 (d63): «desde 60 € + IVA», a recolha mínima — era «30 – 100 €»,
   * e o motor nunca cobra menos do que a recolha mínima (d59/d60). O tecto fica só
   * para o motor (o ponto dos monos sem peças contadas, `monosPelaFaixa`); o que se
   * mostra ao público é o «desde».
   */
  recolha_monos: { etiqueta: `desde ${RECOLHA_MINIMA_DOS_MOVEIS} €`, minimo: RECOLHA_MINIMA_DOS_MOVEIS, maximo: 100, tectoSoNaEstimativa: true },

  /*
   * Por metro cúbico, e a unidade vai ESCRITA.
   *
   * Este cartão dizia "3 – 5 €" — o preço por saco, sem unidade, numa grelha
   * onde tudo o resto mostra o preço do trabalho inteiro. Lia-se como se a
   * CLYON levasse entulho por quatro euros. Um preço impossível não gera
   * pedidos baratos: gera desconfiança em todos os outros preços da grelha.
   */
  /*
   * 120 €/m³ DESDE 17-10-2026 — *«vamos mudar o valor do metro cúbico para 120,
   * não só aqui mas em todo o site»* (o dono). Era 110 desde 01-10-2026.
   * DESDE 04-11-2026 (d7) o m³ é o dos sacos: 40 sacos × 4,00–4,80 € = 160 –
   * 192 €/m³, ensacado ou a granel. A grelha por volume está em
   * `ENTULHO_POR_VOLUME`, e os sacos soltos em `ENTULHO_ATE_10_SACOS`.
   */
  recolha_entulho: {
    etiqueta: `${UM_METRO_CUBICO.de} – ${UM_METRO_CUBICO.ate} €/m³`,
    minimo: UM_METRO_CUBICO.de,
    maximo: UM_METRO_CUBICO.ate,
    unidade: "m³",
  },

  /*
   * DESDE 17-11-2026 (d63): o piso do T0/T1 (`ESVAZIAMENTO_POR_TIPOLOGIA`) — era
   * «desde 250 €», abaixo do T0/T1 da d60, e lia-se como «moradia desde 250 €».
   */
  esvaziamento_casa: { etiqueta: `desde ${PISO_DO_T0_T1} €`, minimo: PISO_DO_T0_T1 },
  // Os apartamentos de T0/T1 a T4 (d60, 16-11-2026): do piso do T0/T1 ao tecto do T4.
  esvaziamento_apartamento: {
    etiqueta: `${milhares(APARTAMENTOS.minimo)} – ${milhares(APARTAMENTOS.maximo)} €`,
    minimo: APARTAMENTOS.minimo,
    maximo: APARTAMENTOS.maximo,
  },
  // Garagem, sótão e cave (29-10-2026): as faixas estão em `ESVAZIAMENTO_POR_ESPACO`.
  esvaziamento_garagem: { etiqueta: "desde 120 €", minimo: 120, maximo: 420 },
  esvaziamento_sotao: { etiqueta: "desde 150 €", minimo: 150, maximo: 480 },
  esvaziamento_cave: { etiqueta: "desde 140 €", minimo: 140, maximo: 450 },

  /*
   * As mudanças não publicam número. É uma decisão, não um esquecimento.
   *
   * O site anunciava "desde 150 €" em quinze páginas indexadas, incluindo
   * dados estruturados. O motor factura a partir de 490 € — sete horas a
   * 70 €/h. São 340 € de diferença entre o que o Google mostra e o que a
   * factura diz, e é a maior discrepância que este site teve.
   *
   * Enquanto os dois não estiverem alinhados, não se publica número nenhum:
   * um preço que não se pratica custa mais do que a ausência dele.
   */
  /*
   * E DESDE 13-10-2026 PUBLICAM — à hora, a tabela do dono, a mesma que o
   * motor usa (`tabela-das-mudancas.ts`). O piso é o mínimo de 3 horas.
   * Lidos de lá desde 27-10-2026 (d12): estavam escritos à mão aqui.
   *
   * DESDE 11-11-2026 CADA PARCEIRO TEM O SEU PREÇO: a etiqueta diz que é a
   * referência (estes cartões não lêem a base); o «desde» dos parceiros está
   * nas páginas das mudanças (`preco-publico-das-mudancas.ts`).
   */
  // Desde 16-11-2026 (d60) a referência tem a equipa de 2 (40 €/h) e a de 3 (55 €/h): a etiqueta diz a de 2.
  mudanca: { etiqueta: `referência desde ${PRECO_POR_HORA_DUAS_PESSOAS} €/hora + IVA`, minimo: PRECO_POR_HORA_DUAS_PESSOAS * MINIMO_DE_HORAS },

  montagem_moveis: { etiqueta: "desde 49 €", minimo: 49 },
  jardinagem: { etiqueta: "desde 64 €", minimo: 64 },
  manutencao_casa: { etiqueta: `desde ${MINIMO_DA_MANUTENCAO} €`, minimo: MINIMO_DA_MANUTENCAO },
};

/*
 * A MANUTENÇÃO DA CASA POR TIPO DE TRABALHO — 03-11-2026 (decisão d1 v2: a
 * proposta das Finanças, aprovada pelo dono). Só as células com fontes; o
 * resto é proposta com fotografias. Sem IVA (o texto mostra sempre o com IVA
 * ao lado). O «desde 57 €» publicado continua certo: é o mínimo.
 *
 * Os materiais não multiplicam nada (não foi aprovado): a pintura inclui a
 * tinta e a remodelação os materiais; nos outros a faixa é só mão de obra e as
 * peças vão à parte, pelo talão — são notas, em `NOTA_DOS_MATERIAIS`.
 *
 * Os ids são os das perguntas da app (`respostas-do-simulador.ts`); um teste
 * confere que batem.
 */
export type QuantoDaManutencao = "uma_pequena" | "varias_pequenas" | "uma_divisao" | "remodelacao";

export type CelulaDaManutencao =
  | { tipo: "faixa"; de: number; ate: number }
  | { tipo: "desde"; de: number; porDivisao?: boolean }
  | { tipo: "proposta" }
  /** «Conta como» outra célula da grelha. */
  | { tipo: "comoSe"; trabalho: string; quanto: QuantoDaManutencao };

const faixaM = (de: number, ate: number): CelulaDaManutencao => ({ tipo: "faixa", de, ate });
const PROPOSTA_M: CelulaDaManutencao = { tipo: "proposta" };
const DESDE_O_MINIMO: CelulaDaManutencao = { tipo: "desde", de: MINIMO_DA_MANUTENCAO };
const M = MINIMO_DA_MANUTENCAO;

export const MANUTENCAO_POR_TIPO: Readonly<Record<string, Readonly<Record<QuantoDaManutencao, CelulaDaManutencao>>>> = {
  canalizacao: { uma_pequena: faixaM(M, 100), varias_pequenas: faixaM(130, 200), uma_divisao: faixaM(250, 550), remodelacao: PROPOSTA_M },
  electricidade: { uma_pequena: faixaM(M, 75), varias_pequenas: faixaM(110, 160), uma_divisao: PROPOSTA_M, remodelacao: PROPOSTA_M },
  pintura: { uma_pequena: faixaM(80, 130), varias_pequenas: faixaM(160, 240), uma_divisao: faixaM(230, 350), remodelacao: PROPOSTA_M },
  carpintaria: { uma_pequena: faixaM(M, 90), varias_pequenas: faixaM(120, 180), uma_divisao: PROPOSTA_M, remodelacao: PROPOSTA_M },
  pequenas_reparacoes: {
    uma_pequena: faixaM(M, 75),
    varias_pequenas: faixaM(90, 140),
    uma_divisao: PROPOSTA_M,
    remodelacao: { tipo: "comoSe", trabalho: "remodelacao", quanto: "remodelacao" },
  },
  remodelacao: {
    uma_pequena: { tipo: "comoSe", trabalho: "pequenas_reparacoes", quanto: "uma_pequena" },
    varias_pequenas: { tipo: "comoSe", trabalho: "pequenas_reparacoes", quanto: "varias_pequenas" },
    uma_divisao: PROPOSTA_M,
    remodelacao: { tipo: "desde", de: 2000, porDivisao: true },
  },
  outro: { uma_pequena: DESDE_O_MINIMO, varias_pequenas: DESDE_O_MINIMO, uma_divisao: DESDE_O_MINIMO, remodelacao: DESDE_O_MINIMO },
};

/** As notas dos materiais — sem número: a faixa diz o que inclui. */
export const NOTA_DOS_MATERIAIS: Readonly<{ pintura: string; remodelacao: string; outros: string }> = {
  pintura: "A faixa inclui a tinta; com material seu, o parceiro ajusta na proposta.",
  remodelacao: "O valor inclui os materiais; com material seu, o parceiro ajusta na proposta.",
  outros: "A faixa é só mão de obra; as peças vão à parte, pelo talão.",
};

/**
 * A célula da grelha para este trabalho, já com o «conta como» resolvido, e o
 * trabalho a que ela pertence (para a nota dos materiais). `null` sem as duas
 * respostas.
 */
export function celulaDaManutencao(
  trabalho: string | null | undefined,
  quanto: string | null | undefined,
): { trabalho: string; quanto: QuantoDaManutencao; celula: Exclude<CelulaDaManutencao, { tipo: "comoSe" }> } | null {
  let t = trabalho ?? "";
  let q = (quanto ?? "") as QuantoDaManutencao;
  for (let saltos = 0; saltos < 3; saltos++) {
    const c = MANUTENCAO_POR_TIPO[t]?.[q];
    if (!c) return null;
    if (c.tipo !== "comoSe") return { trabalho: t, quanto: q, celula: c };
    t = c.trabalho;
    q = c.quanto;
  }
  return null;
}

/** A nota dos materiais do trabalho (pintura, remodelação ou os outros); `null` em «Outro trabalho». */
export function notaDosMateriais(trabalho: string): string | null {
  if (trabalho === "outro") return null;
  return trabalho === "pintura" ? NOTA_DOS_MATERIAIS.pintura : trabalho === "remodelacao" ? NOTA_DOS_MATERIAIS.remodelacao : NOTA_DOS_MATERIAIS.outros;
}

/*
 * OS ANDARES NO ENTULHO E NOS MÓVEIS, POR TRABALHO — 03-11-2026 (decisão d4,
 * aprovada pelo dono; nos móveis por peça desde a d6, no mesmo dia). Substitui a regra da d1 v2 do mesmo dia (+15 € por m³ e por andar sem
 * elevador). Agora conta-se o trabalho, e não os m³:
 *   · +5 € sem IVA por andar com elevador (também o pequeno);
 *   · +15 € sem IVA por andar sem elevador;
 *   · o estacionamento a mais de 30 m ou difícil conta como mais um andar sem
 *     elevador (+15 €);
 *   · no rés-do-chão, nada; com «não sei» se há elevador, não se soma e o
 *     parceiro confirma na proposta.
 * Exemplo do dono: 50 sacos num 2.º andar com elevador pequeno, estacionamento
 * até 20 m → 200–240 € + 10 € = 210–250 € + IVA. Somam-no a referência (R12 e
 * simulador do site), a calculadora, o motor e o texto ao modelo —
 * `suplementoDoEntulho` em quanto-custa.ts.
 */
export const RECOLHA_POR_ANDAR_COM_ELEVADOR = 5;
export const RECOLHA_POR_ANDAR_SEM_ELEVADOR = 15;

/*
 * SEM ELEVADOR, POR ANDAR E POR PEÇA GRANDE — 16-11-2026 (decisão d60). Nos
 * móveis e nos monos com as peças contadas, cada andar a pé conta 8 € por peça
 * grande, nunca menos de 15 € por andar (`RECOLHA_POR_ANDAR_SEM_ELEVADOR`, o
 * mínimo — e o valor de sempre no entulho, que não tem peças grandes). Uma peça
 * grande que não cabe no elevador desce pela escada: os andares contam-se como
 * sem elevador. Com elevador, +5 € por andar por trabalho (igual). Sem IVA.
 */
export const RECOLHA_POR_ANDAR_E_PECA_GRANDE = 8;

/** Um andar a pé, com estas peças grandes: 8 € por peça grande, nunca menos de 15 €. */
export function valorDeUmAndarAPe(pecasGrandes = 0): number {
  return Math.max(RECOLHA_POR_ANDAR_SEM_ELEVADOR, RECOLHA_POR_ANDAR_E_PECA_GRANDE * Math.max(0, Math.floor(pecasGrandes)));
}


/*
 * O PREÇO DE REFERÊNCIA NUNCA SAI SOZINHO — 14-10-2026.
 *
 * «Deixe o preço sem IVA mas com a informação» — o dono, a confirmar a
 * decisão de 03-10-2026: os números ficam sem IVA, e onde aparece um diz-se
 * que é sem IVA e que a proposta já vem com ele. Os títulos de 48 páginas,
 * três descrições e várias frases mostravam o número nu — e na proposta o
 * cliente via 23 % a mais.
 */

/*
 * O ESVAZIAMENTO POR TIPOLOGIA — 17-10-2026.
 *
 * Estava escrito à mão em três sítios — a grelha e a pergunta de
 * /esvaziamento-de-casas, e a pergunta de /faq —, sempre com os mesmos
 * números. Passa a viver aqui, para a página «quanto custa» dizer o mesmo.
 * Os apartamentos ficam dentro da faixa de `esvaziamento_apartamento`, e a
 * moradia completa começa no tecto dela. Sem IVA.
 */

/*
 * A GARAGEM, O SÓTÃO E A CAVE — 29-10-2026 (preços aprovados pelo dono).
 *
 * Por faixas e não por m³: o m³ é só do entulho. As três faixas são as do
 * seletor de volume do simulador (`VolumeQuantitySelector`): enche uma
 * carrinha, a caixa de um camião, um camião. «Não sei» não tem número: a
 * proposta sai das fotografias. O sótão leva cerca de 20 % mais do que a
 * garagem (tudo desce à mão, por escada estreita ou alçapão) e a cave cerca de
 * 12 % (tudo sobe degraus). Sem IVA.
 *
 * Estes três NÃO são carga completa automática: só a faixa «cheio» recebe o
 * mínimo de zona do motor (`pricing-helper.ts`). Senão a garagem pequena saía
 * a 220 €.
 */
export type FaixaDoVolume = "carrinha" | "camiao_caixa" | "camiao_lixo";

export const ESVAZIAMENTO_POR_ESPACO: ReadonlyArray<{
  servico: string;
  espaco: string;
  faixas: Readonly<Record<FaixaDoVolume, { de: number; ate: number }>>;
}> = [
  {
    servico: "esvaziamento_garagem",
    espaco: "Garagem",
    faixas: { carrinha: { de: 120, ate: 180 }, camiao_caixa: { de: 200, ate: 280 }, camiao_lixo: { de: 300, ate: 420 } },
  },
  {
    servico: "esvaziamento_sotao",
    espaco: "Sótão",
    faixas: { carrinha: { de: 150, ate: 220 }, camiao_caixa: { de: 250, ate: 340 }, camiao_lixo: { de: 360, ate: 480 } },
  },
  {
    servico: "esvaziamento_cave",
    espaco: "Cave",
    faixas: { carrinha: { de: 140, ate: 200 }, camiao_caixa: { de: 230, ate: 320 }, camiao_lixo: { de: 340, ate: 450 } },
  },
];

/** Os nomes das faixas, como o simulador os diz. */
export const NOMES_DAS_FAIXAS: Readonly<Record<FaixaDoVolume, string>> = {
  carrinha: "Pouca coisa (enche uma carrinha)",
  camiao_caixa: "Volume médio (enche a caixa de um camião)",
  camiao_lixo: "Cheio (enche um camião)",
};

/** É garagem, sótão ou cave? */
export function eEsvaziamentoDeEspaco(servico: string | null | undefined): boolean {
  return ESVAZIAMENTO_POR_ESPACO.some((e) => e.servico === servico);
}

/**
 * A estimativa de um espaço: a faixa do volume escolhido, e o valor — o meio
 * da faixa, ou o TOPO com acesso difícil (nunca acima dele). `null` sem volume
 * ou com «não sei»: a proposta sai das fotografias.
 */
export function estimativaDoEspaco(
  servico: string | null | undefined,
  volume: string | null | undefined,
  acessoDificil = false,
): { de: number; ate: number; valor: number; faixa: FaixaDoVolume } | null {
  const e = ESVAZIAMENTO_POR_ESPACO.find((x) => x.servico === servico);
  if (!e || (volume !== "carrinha" && volume !== "camiao_caixa" && volume !== "camiao_lixo")) return null;
  const f = e.faixas[volume];
  return { de: f.de, ate: f.ate, valor: acessoDificil ? f.ate : Math.round((f.de + f.ate) / 2), faixa: volume };
}


/** «400 – 600 €», «desde 900 €», «900 – 1 300 €» — a etiqueta de uma linha do esvaziamento. */
export function etiquetaDoEsvaziamento(chave: string): string {
  const t = ESVAZIAMENTO_POR_TIPOLOGIA.find((x) => x.chave === chave);
  if (!t) throw new Error(`Tipologia de esvaziamento desconhecida: ${chave}`);
  return t.maximo != null ? `${milhares(t.minimo)} – ${milhares(t.maximo)} €` : `desde ${milhares(t.minimo)} €`;
}

/*
 * A GRELHA DO ENTULHO — 17-10-2026, os números do dono, e o que mudou depois:
 *
 *   · até 10 sacos, em sacos de 25 a 30 kg: 40 a 50 € sem IVA (40 a 48 € desde
 *     03-11-2026, pelo preço de cada saco — `PRECO_POR_SACO`, acima);
 *   · 1 m³ (WC ou cozinha), 3 m³ (obra de um T1/T2) e 5 m³ (demolições e
 *     renovações): eram «desde 120 / 432 / 720 €»; desde 04-11-2026 (d7) são
 *     os sacos que fazem, 40 por m³ — 160–192, 480–576 e 800–960 €;
 *   · acima de 5 m³, proposta com fotografias.
 * Sem IVA.
 */

const DEZ_SACOS = precoDosSacos(MINIMO_DE_SACOS);

export const ENTULHO_ATE_10_SACOS: { readonly minimo: number; readonly maximo: number; readonly descricao: string } = {
  minimo: DEZ_SACOS.de,
  maximo: DEZ_SACOS.ate,
  descricao: `Pequenas quantidades, em sacos de ${PESO_DO_SACO}`,
};

/** As linhas da grelha por volume: os m³, os sacos que fazem e a faixa deles (d7). */
export const ENTULHO_POR_VOLUME: ReadonlyArray<{ m3: number; sacos: number; de: number; ate: number }> = [1, 3, 5].map((m3) => {
  const sacos = m3 * SACOS_POR_METRO_CUBICO;
  return { m3, sacos, ...precoDosSacos(sacos) };
});

/** A faixa de um volume da grelha — `ENTULHO_POR_VOLUME`, e mais nenhuma. */
export function faixaDoVolume(m3: number): { de: number; ate: number } {
  const linha = ENTULHO_POR_VOLUME.find((v) => v.m3 === m3);
  if (!linha) throw new Error(`Volume de entulho fora da grelha: ${m3} m³`);
  return { de: linha.de, ate: linha.ate };
}

/** Logo a seguir ao número, onde há pouco espaço: «40 – 120 € + IVA». */
export function maisIva(etiqueta: string): string {
  return /IVA/.test(etiqueta) ? etiqueta : `${etiqueta} + IVA`;
}

/**
 * A etiqueta no início de uma frase ou sozinha num título: «Desde 57 €».
 * As etiquetas guardam-se em minúscula para irem a meio de uma frase, e
 * apareciam assim depois de um ponto (15-10-2026, pente fino).
 */
export function comMaiuscula(etiqueta: string): string {
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
}

/** Numa frase, depois do número: «40 – 120 €, sem IVA (na proposta, …)». */
export const SEM_IVA_NA_FRASE = "sem IVA (na proposta, o preço já é o total a pagar: com IVA incluído ou isento, conforme o regime do parceiro)";

/*
 * AS PEÇAS SOLTAS, DENTRO DA FAIXA DA RECOLHA DE MÓVEIS — 14-10-2026.
 *
 * Estavam escritas à mão no modelo das páginas de cidade. Passam a viver aqui
 * para o artigo «Quanto custa retirar um sofá em Lisboa» dizer os mesmos
 * números.
 *
 * PELA TABELA DAS PEÇAS DESDE 04-11-2026 (d7, o dono): eram faixas próprias
 * (sofá 40–70, cama 40–65, armário 55–95, mesa 40–65 €) ao lado da tabela por
 * peça, e chocavam com ela. Agora cada exemplo é um tamanho, e o preço é o de
 * `PRECO_POR_ITEM`: o sofá, a cama e o armário grande são peças grandes
 * (50 €), a mesa com cadeiras uma peça média (30 €). Sem IVA.
 */
export type PecaDeReferencia = { peca: string; tamanho: keyof typeof PRECO_POR_ITEM };

export const PECAS_DE_REFERENCIA: ReadonlyArray<PecaDeReferencia> = [
  { peca: "Sofá de 2 a 3 lugares", tamanho: "grande" },
  { peca: "Cama de casal com estrado", tamanho: "grande" },
  { peca: "Armário grande", tamanho: "grande" },
  { peca: "Mesa com cadeiras", tamanho: "medio" },
];

/** «peça grande», «peça média», «peça pequena». */
export const NOME_DO_TAMANHO: Readonly<Record<keyof typeof PRECO_POR_ITEM, string>> = {
  pequeno: "peça pequena",
  medio: "peça média",
  grande: "peça grande",
};

/** O preço de uma peça de referência sozinha, sem IVA — o do seu tamanho (a grande é a primeira, d60). */
export const precoDaPeca = (p: PecaDeReferencia): number => (p.tamanho === "grande" ? PRECO_DA_PRIMEIRA_GRANDE : PRECO_POR_ITEM[p.tamanho]);

/** «Sofá de 2 a 3 lugares: peça grande, 50 €» (sem IVA — para o texto ao modelo, com «s/IVA» a seguir). */
export function pecaEmLinha(p: PecaDeReferencia): string {
  return `${p.peca}: ${NOME_DO_TAMANHO[p.tamanho]}, ${precoDaPeca(p)} €`;
}

/** A etiqueta de um serviço, ou nada se ele não publicar preço. */
export function precoDe(servico: string): string | null {
  return PRECOS[servico]?.etiqueta ?? null;
}

/**
 * O piso de um serviço, para dados estruturados.
 *
 * Devolve `null` quando o serviço não publica preço — e nesse caso o bloco
 * `offers` do JSON-LD não deve ser emitido de todo. Declarar um preço ao
 * Google numa página que não o mostra é a divergência que ele penaliza.
 */
export function minimoDe(servico: string): number | null {
  return PRECOS[servico]?.minimo ?? null;
}

/**
 * O menor preço publicado em todo o site.
 *
 * Serve para a frase "recolha desde X €" nos metadados globais, que antes
 * dizia "preços desde 120EUR" — um número que não era o mínimo de nada.
 */
export const MENOR_PRECO_PUBLICADO = Math.min(
  ...Object.values(PRECOS)
    .map((p) => p.minimo)
    .filter((n): n is number => n != null),
);
