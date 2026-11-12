/**
 * AS DUAS FATURAS DE CADA TRABALHO — d10, desde 15-11-2026 (dono, 12-11-2026).
 *
 *   · «clyon» — a da taxa da plataforma, emitida pela empresa parceira da CLYON.
 *     Por agora feita à mão pela equipa e anexada ao pedido no backoffice.
 *   · «parceiro» — a do trabalho, emitida pelo parceiro, que a carrega no painel
 *     ou na app.
 *
 * As duas ficam juntas ao pedido; o cliente vê-as na página do pedido, na conta
 * e na app. Uma nova substitui a anterior da mesma parte (a anterior fica na
 * base, inactiva — nada se apaga).
 *
 * Puro: as rotas e os ecrãs lêem isto. A base está em `faturas-do-trabalho-na-base.ts`.
 */

export type DeQuemEAFatura = "clyon" | "parceiro";

export const PARTES_DAS_FATURAS: DeQuemEAFatura[] = ["clyon", "parceiro"];

export function deQuemValido(v: unknown): v is DeQuemEAFatura {
  return v === "clyon" || v === "parceiro";
}

export const NOME_DA_FATURA: Record<DeQuemEAFatura, string> = {
  clyon: "Fatura da taxa da plataforma",
  parceiro: "Fatura do trabalho",
};

/** Imagem ou PDF, até 6 MB. */
export const TAMANHO_MAXIMO_DA_FATURA = 6 * 1024 * 1024;

export function tipoDaFaturaAceite(tipo: string): boolean {
  return tipo === "application/pdf" || tipo === "image/jpeg" || tipo === "image/png" || tipo === "image/webp";
}

export const MENSAGENS_DA_FATURA = {
  semFicheiro: "Escolha o ficheiro da fatura.",
  grande: "O ficheiro passa de 6 MB.",
  tipo: "A fatura tem de ser um PDF ou uma imagem (JPG, PNG ou WebP).",
  falhou: "Não foi possível guardar a fatura. Tente novamente.",
  naoE: "Este trabalho não é do modelo em que o cliente paga ao parceiro.",
  porContratar: "Só se junta a fatura a um trabalho contratado.",
} as const;

export type FaturaDoTrabalho = {
  id: number;
  negociacaoId: number;
  pedidoId: number;
  deQuem: DeQuemEAFatura;
  url: string;
  nome: string | null;
  carregadaEm: string | null;
};

/** As duas, para o ecrã: a activa de cada parte, ou `null`. */
export function asDuasFaturas(faturas: ReadonlyArray<FaturaDoTrabalho>): Record<DeQuemEAFatura, FaturaDoTrabalho | null> {
  return {
    clyon: faturas.find((f) => f.deQuem === "clyon") ?? null,
    parceiro: faturas.find((f) => f.deQuem === "parceiro") ?? null,
  };
}
