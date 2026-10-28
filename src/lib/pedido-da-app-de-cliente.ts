import { diaEmLisboa, somarDiasAoDia, inicioDoDiaEmLisboa } from "./hora-de-lisboa";

/**
 * O PEDIDO QUE CHEGA DA APP DE CLIENTE — o resto da R3 (d8 fase 2, S5,
 * 28-10-2026).
 *
 * A app pede pela mesma porta do simulador (`POST /api/simulador/pedido`),
 * com três coisas a mais: a origem (`origemPedido: "app_cliente"`), o dia que
 * o cliente escolheu (`dataPreferida`, «AAAA-MM-DD») e quantos rascunhos
 * começou antes deste (`rascunhosAntes`, só para a medida do E3).
 *
 * SEM «HOJE» NA APP (regra 4 da especificação; «sem no próprio dia»): o dia
 * conta-se em Lisboa, a partir de amanhã, seja qual for o fuso do telemóvel. O
 * simulador do site continua como está (decisão do dono de 25-10-2026).
 */

export const ORIGEM_DA_APP_DE_CLIENTE = "app_cliente";

/** Até onde se pode escolher o dia (o calendário da app mostra 90 dias). */
const DIAS_PARA_A_FRENTE = 365;

export const DIA_A_PARTIR_DE_AMANHA = "Escolha um dia a partir de amanhã.";
export const SEM_HOJE_NA_APP = "Pela app, o pedido é para amanhã em diante. Escolha outro dia.";

/** O dia preferido, se veio: de amanhã em diante, em Lisboa. */
export function lerDataPreferida(
  v: unknown,
  agora: Date = new Date(),
): { ok: true; dia: string | null; inicio: Date | null } | { ok: false; erro: string } {
  if (v === undefined || v === null || v === "") return { ok: true, dia: null, inicio: null };
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, erro: DIA_A_PARTIR_DE_AMANHA };
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return { ok: false, erro: DIA_A_PARTIR_DE_AMANHA };
  const hoje = diaEmLisboa(agora);
  if (v <= hoje) return { ok: false, erro: DIA_A_PARTIR_DE_AMANHA };
  if (v > somarDiasAoDia(hoje, DIAS_PARA_A_FRENTE)) return { ok: false, erro: DIA_A_PARTIR_DE_AMANHA };
  return { ok: true, dia: v, inicio: inicioDoDiaEmLisboa(v) };
}

/** A urgência que o motor de preços lê, a partir do dia escolhido. */
export function urgenciaDoDia(dia: string, agora: Date = new Date()): "tomorrow" | "this_week" | "flexible" {
  const hoje = diaEmLisboa(agora);
  if (dia <= somarDiasAoDia(hoje, 1)) return "tomorrow";
  if (dia <= somarDiasAoDia(hoje, 7)) return "this_week";
  return "flexible";
}

/** Quantos rascunhos antes deste: um inteiro de 0 a 50, ou nada. */
export function lerRascunhosAntes(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 50 ? n : null;
}
