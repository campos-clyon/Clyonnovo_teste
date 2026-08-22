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
  recolha_entulho: { etiqueta: "desde 110 €/m³", minimo: 110, unidade: "m³" },

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
  mudanca: { etiqueta: "orçamento personalizado", minimo: null },

  montagem_moveis: { etiqueta: "desde 49 €", minimo: 49 },
  jardinagem: { etiqueta: "desde 64 €", minimo: 64 },
  manutencao_casa: { etiqueta: "desde 57 €", minimo: 57 },
};

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
