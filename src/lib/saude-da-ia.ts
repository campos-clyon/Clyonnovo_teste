/**
 * UM TERMÓMETRO PARA CADA USO DA IA — 27-10-2026 (decisão d7).
 *
 * A compreensão já tinha o dela desde 14-09 (`anotarSaudeDaCompreensao`, a
 * faixa amarela no topo do WhatsApp). Os outros três usos do Gemini falhavam
 * só para a consola da Vercel, que ninguém lê:
 *
 *   · o TRADUTOR cai para português sem aviso — foi assim que esteve morto de
 *     15-09 a 14-10 com um cliente estrangeiro a receber português;
 *   · a LEITURA DAS CONVERSAS só se registava quando fechava alguma, e uma
 *     Vitória que falhava todas parecia uma Vitória sem trabalho;
 *   · a LEITURA DE IMAGENS devolve `null` e a fotografia conta sem a frase.
 *
 * Cada uso anota a última falha (quando, porquê, quantas desde a última que
 * correu bem) e limpa-se à primeira que corra bem. Este ficheiro é PURO (o
 * painel importa-o); a escrita vive em `saude-da-ia-na-base.ts`.
 */

export const USOS_DA_IA = ["tradutor", "leitura", "imagem"] as const;
export type UsoDaIa = (typeof USOS_DA_IA)[number];

export const NOME_DO_USO: Record<UsoDaIa, string> = {
  tradutor: "Tradutor",
  leitura: "Leitura das conversas",
  imagem: "Leitura das fotografias",
};

/** O que acontece enquanto o uso está em baixo — dito para quem lê o painel. */
export const O_QUE_ACONTECE: Record<UsoDaIa, string> = {
  // Desde 28-10-2026 (d35) já não saem em português: tradução fixa, ou a equipa assume.
  tradutor: "as mensagens a clientes estrangeiros saem pelas traduções fixas, ou a conversa passa à equipa",
  leitura: "a Vitória não lê nem fecha as conversas paradas",
  imagem: "as fotografias contam, mas sem a frase do que se vê",
};

export function eUsoDaIa(v: unknown): v is UsoDaIa {
  return typeof v === "string" && (USOS_DA_IA as readonly string[]).includes(v);
}

/** Uma falha anotada, como o painel a recebe. */
export type FalhaDaIa = {
  uso: UsoDaIa;
  motivo: string;
  /** Quantas falharam desde a última que correu bem. */
  falhas: number;
  /** Quando foi a última falha, em ISO (contado no relógio da base). */
  quando: string;
};

/** A linha do painel. Pura. */
export function linhaDaFalha(f: FalhaDaIa): string {
  return `${NOME_DO_USO[f.uso]}: ${f.falhas} falha(s) desde a última que correu bem — ${O_QUE_ACONTECE[f.uso]}.`;
}
