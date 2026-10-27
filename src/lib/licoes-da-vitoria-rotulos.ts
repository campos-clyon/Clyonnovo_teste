/**
 * AS ORIGENS E OS ESTADOS DE UMA LIÇÃO DA VITÓRIA — e como se dizem no ecrã.
 * À parte de `licoes-da-vitoria.ts` para o backoffice os ler sem levar as
 * regras da conversa para o browser. 27-10-2026 (decisão d11).
 */

export const ORIGENS_DA_LICAO = ["equipa_a_mao", "anotada", "repetida", "passagem"] as const;
export type OrigemDaLicao = (typeof ORIGENS_DA_LICAO)[number];

export const ORIGEM_POR_EXTENSO: Record<OrigemDaLicao, string> = {
  equipa_a_mao: "A equipa respondeu à mão",
  anotada: "Anotada para os colegas",
  repetida: "Pergunta repetida",
  passagem: "Passagem a uma pessoa",
};

export const ESTADOS_DA_LICAO = ["por_rever", "aprovada", "corrigida", "recusada"] as const;
export type EstadoDaLicao = (typeof ESTADOS_DA_LICAO)[number];

export const ESTADO_POR_EXTENSO: Record<EstadoDaLicao, string> = {
  por_rever: "Por rever",
  aprovada: "Aprovada",
  corrigida: "Corrigida",
  recusada: "Recusada",
};
