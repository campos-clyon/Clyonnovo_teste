/**
 * O MOTIVO AO APAGAR — d94 (dono, 23-11-2026).
 *
 * Apagar um pedido deixa a cada profissional que o tinha (no feed, a negociar
 * ou contratado) uma notificação: «Pedido #N apagado — motivo». O motivo é
 * opcional, mas pede-se sempre: sem ele, o profissional só fica a saber que o
 * pedido saiu.
 *
 * Devolve o texto (vazio = sem motivo) ou `null` se quem carregou desistiu de
 * apagar.
 */
export const PERGUNTA_DO_MOTIVO_AO_APAGAR =
  "Motivo (opcional) — vai na notificação a cada profissional que tinha o pedido. Ex.: repetido, pedido de teste.";

export function pedirMotivoAoApagar(): string | null {
  if (typeof window === "undefined") return "";
  const r = window.prompt(PERGUNTA_DO_MOTIVO_AO_APAGAR, "");
  return r === null ? null : r.trim().slice(0, 160);
}
