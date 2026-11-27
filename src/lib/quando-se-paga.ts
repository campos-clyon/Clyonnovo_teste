/**
 * QUANDO SE PAGA AO PARCEIRO — o modelo de 15-11-2026, numa frase só
 * (d148, 27-11-2026, o CEO e o dono).
 *
 * A mensagem de adjudicação já o dizia («Paga diretamente ao parceiro, no fim
 * do trabalho (salvo se combinarem outra coisa)»), e o Início da app de cliente
 * passa a dizê-lo na confiança. As duas lêem daqui: se um dia mudar, muda nas
 * duas ao mesmo tempo.
 *
 * Sem imports, de propósito.
 */

/** «no fim do trabalho» — a meio de uma frase («Paga diretamente ao parceiro, no fim do trabalho…»). */
export const NO_FIM_DO_TRABALHO = "no fim do trabalho";

/** «salvo se combinarem outra coisa» — a ressalva que vai sempre com o «no fim». */
export const SALVO_SE_COMBINAREM = "salvo se combinarem outra coisa";

/** «Paga ao parceiro no fim do trabalho» — o título curto (o Início da app de cliente). */
export const PAGA_AO_PARCEIRO_NO_FIM = `Paga ao parceiro ${NO_FIM_DO_TRABALHO}`;
