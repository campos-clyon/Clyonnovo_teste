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

import { PESO_DO_SACO } from "./sacos-de-entulho";
import { PRECO_POR_HORA, MINIMO_DE_HORAS } from "./tabela-das-mudancas";

export type PrecoPublico = {
  /** O que aparece no cartão e no texto: "40 – 120 €", "desde 250 €". */
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

/** «por peça: pequena 15 €, média 30 €, grande 55 €» — a etiqueta da recolha de móveis (d6). */
export const ETIQUETA_DOS_MOVEIS = `por peça: pequena ${PRECO_POR_ITEM.pequeno} €, média ${PRECO_POR_ITEM.medio} €, grande ${PRECO_POR_ITEM.grande} €`;

/** O mínimo da manutenção da casa, sem IVA — o «desde» publicado e o piso da grelha por tipo (03-11-2026). */
export const MINIMO_DA_MANUTENCAO = 57;

export const PRECOS: Record<string, PrecoPublico> = {
  /*
   * POR PEÇA DESDE 03-11-2026 (d6): era «40 – 120 €» pelo trabalho. O piso é a
   * peça pequena e o tecto a grande, POR PEÇA (a unidade vai escrita): a conta
   * de um pedido é peça a peça, `PRECO_POR_ITEM`, mais os andares.
   */
  recolha_moveis: { etiqueta: ETIQUETA_DOS_MOVEIS, minimo: PRECO_POR_ITEM.pequeno, maximo: PRECO_POR_ITEM.grande, unidade: "peça" },
  recolha_monos: { etiqueta: "30 – 100 €", minimo: 30, maximo: 100 },

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
   * não só aqui mas em todo o site»* (o dono). Era 110 desde 01-10-2026. A
   * grelha por volume está em `ENTULHO_POR_VOLUME`, e os sacos soltos em
   * `ENTULHO_ATE_10_SACOS`.
   */
  recolha_entulho: { etiqueta: "desde 120 €/m³", minimo: 120, unidade: "m³" },

  esvaziamento_casa: { etiqueta: "desde 250 €", minimo: 250 },
  esvaziamento_apartamento: { etiqueta: "260 – 450 €", minimo: 260, maximo: 450 },
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
   */
  mudanca: { etiqueta: `${PRECO_POR_HORA} €/hora + IVA`, minimo: PRECO_POR_HORA * MINIMO_DE_HORAS },

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
export const ESVAZIAMENTO_POR_TIPOLOGIA: ReadonlyArray<{ chave: string; tipo: string; minimo: number; maximo?: number }> = [
  { chave: "T0/T1", tipo: "Apartamento T0/T1", minimo: 260, maximo: 350 },
  { chave: "T2", tipo: "Apartamento T2", minimo: 320, maximo: 420 },
  { chave: "T3/T4", tipo: "Apartamento T3/T4", minimo: 380, maximo: 450 },
  { chave: "moradia", tipo: "Moradia completa", minimo: 450 },
];

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


/** «320 – 420 €», «desde 450 €» — a etiqueta de uma linha do esvaziamento. */
export function etiquetaDoEsvaziamento(chave: string): string {
  const t = ESVAZIAMENTO_POR_TIPOLOGIA.find((x) => x.chave === chave);
  if (!t) throw new Error(`Tipologia de esvaziamento desconhecida: ${chave}`);
  return t.maximo != null ? `${t.minimo} – ${t.maximo} €` : `desde ${t.minimo} €`;
}

/*
 * A GRELHA DO ENTULHO — 17-10-2026, os números do dono:
 *
 *   · até 10 sacos, em sacos de 25 a 30 kg: 40 a 50 € sem IVA (40 a 48 € desde
 *     03-11-2026, pelo preço de cada saco — abaixo);
 *   · até 1 m³ (WC ou cozinha): desde 120 €;
 *   · até 3 m³ (obra de um T1/T2): desde 432 €;
 *   · até 5 m³ (demolições e renovações): desde 720 €;
 *   · acima disso, proposta com fotografias.
 *
 * Já não é linear: até 1 m³ são 120 €/m³, e daí para cima 144 €/m³ (432 ÷ 3
 * e 720 ÷ 5 — um teste confere que as duas dão o mesmo). Antes, cada linha
 * era 110 € vezes o volume, e os 10 sacos iam de 110 a 120 €. Sem IVA.
 */

/*
 * O SACO PEQUENO A 4,00–4,80 € — 03-11-2026 (decisão d4, aprovada pelo dono).
 *
 * O saco de obra de 25 a 30 kg («como os do Leroy Merlin») conta-se um a um:
 * 4,00 a 4,80 € sem IVA cada. 10 sacos passam de 40–50 € a 40–48 €; 50 sacos
 * são 200–240 €; um big bag conta como 38 sacos (`SACOS_POR_BIG_BAG`), ou seja
 * 152–182,40 €. Até 10 sacos conta o mínimo de 10 — o mínimo de uma recolha (a
 * deslocação é a mesma para dois ou para dez). O entulho solto, a granel,
 * continua pela grelha por m³ (`ENTULHO_POR_VOLUME`). Sem IVA.
 */
export const PRECO_POR_SACO = { minimo: 4, maximo: 4.8 } as const;

/** Até aqui conta-se o mínimo de uma recolha: 10 sacos. */
export const MINIMO_DE_SACOS = 10;

const emCentimos = (v: number) => Math.round(v * 100) / 100;

/** Estes sacos, um a um, sem IVA — até 10, o mínimo de 10. */
export function precoDosSacos(sacos: number): { de: number; ate: number } {
  const n = Math.max(MINIMO_DE_SACOS, Math.round(sacos));
  return { de: emCentimos(n * PRECO_POR_SACO.minimo), ate: emCentimos(n * PRECO_POR_SACO.maximo) };
}

const DEZ_SACOS = precoDosSacos(MINIMO_DE_SACOS);

export const ENTULHO_ATE_10_SACOS: { readonly minimo: number; readonly maximo: number; readonly descricao: string } = {
  minimo: DEZ_SACOS.de,
  maximo: DEZ_SACOS.ate,
  descricao: `Pequenas quantidades, em sacos de ${PESO_DO_SACO}`,
};

export const ENTULHO_POR_VOLUME: ReadonlyArray<{ m3: number; desde: number }> = [
  { m3: 1, desde: 120 },
  { m3: 3, desde: 432 },
  { m3: 5, desde: 720 },
];

/** O «desde» de um volume da grelha — `ENTULHO_POR_VOLUME`, e mais nenhum. */
export function desdeDoVolume(m3: number): number {
  const linha = ENTULHO_POR_VOLUME.find((v) => v.m3 === m3);
  if (!linha) throw new Error(`Volume de entulho fora da grelha: ${m3} m³`);
  return linha.desde;
}

/** O preço por m³ acima de 1 m³ — o da linha dos 3 m³ (144 €/m³). */
export const ENTULHO_POR_M3_ACIMA_DE_1 = desdeDoVolume(3) / 3;

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
export const SEM_IVA_NA_FRASE = "sem IVA (na proposta, o preço já vem com IVA incluído)";

/*
 * AS PEÇAS SOLTAS, DENTRO DA FAIXA DA RECOLHA DE MÓVEIS — 14-10-2026.
 *
 * Estavam escritas à mão no modelo das páginas de cidade. Passam a viver aqui
 * para o artigo «Quanto custa retirar um sofá em Lisboa» dizer os mesmos
 * números. Nenhuma abre abaixo do mínimo nem fecha acima do máximo da
 * recolha de móveis (um teste confere). Sem IVA.
 */
export const PECAS_DE_REFERENCIA: ReadonlyArray<{ peca: string; minimo: number; maximo: number }> = [
  { peca: "Sofá de 2 a 3 lugares", minimo: 40, maximo: 70 },
  { peca: "Cama de casal com estrado", minimo: 40, maximo: 65 },
  { peca: "Armário grande", minimo: 55, maximo: 95 },
  { peca: "Mesa com cadeiras", minimo: 40, maximo: 65 },
];

/** «Sofá de 2 a 3 lugares: 40 – 70 €» */
export function pecaEmLinha(p: { peca: string; minimo: number; maximo: number }): string {
  return `${p.peca}: ${p.minimo} – ${p.maximo} €`;
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
