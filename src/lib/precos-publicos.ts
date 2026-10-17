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

export const PRECOS: Record<string, PrecoPublico> = {
  recolha_moveis: { etiqueta: "40 – 120 €", minimo: 40, maximo: 120 },
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
   */
  mudanca: { etiqueta: "50 €/hora + IVA", minimo: 150 },

  montagem_moveis: { etiqueta: "desde 49 €", minimo: 49 },
  jardinagem: { etiqueta: "desde 64 €", minimo: 64 },
  manutencao_casa: { etiqueta: "desde 57 €", minimo: 57 },
};

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

/** «320 – 420 €», «desde 450 €» — a etiqueta de uma linha do esvaziamento. */
export function etiquetaDoEsvaziamento(chave: string): string {
  const t = ESVAZIAMENTO_POR_TIPOLOGIA.find((x) => x.chave === chave);
  if (!t) throw new Error(`Tipologia de esvaziamento desconhecida: ${chave}`);
  return t.maximo != null ? `${t.minimo} – ${t.maximo} €` : `desde ${t.minimo} €`;
}

/*
 * A GRELHA DO ENTULHO — 17-10-2026, os números do dono:
 *
 *   · até 10 sacos, em sacos de 25 a 30 kg: 40 a 50 € sem IVA;
 *   · até 1 m³ (WC ou cozinha): desde 120 €;
 *   · até 3 m³ (obra de um T1/T2): desde 432 €;
 *   · até 5 m³ (demolições e renovações): desde 720 €;
 *   · acima disso, proposta com fotografias.
 *
 * Já não é linear: até 1 m³ são 120 €/m³, e daí para cima 144 €/m³ (432 ÷ 3
 * e 720 ÷ 5 — um teste confere que as duas dão o mesmo). Antes, cada linha
 * era 110 € vezes o volume, e os 10 sacos iam de 110 a 120 €. Sem IVA.
 */
export const ENTULHO_ATE_10_SACOS = {
  minimo: 40,
  maximo: 50,
  descricao: `Pequenas quantidades, em sacos de ${PESO_DO_SACO}`,
} as const;

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
