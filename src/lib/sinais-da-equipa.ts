/**
 * OS SINAIS DA EQUIPA, sozinhos — 25-11-2026 (decisão d116). Para o painel os
 * poder ler sem trazer as regras (e as traduções). Ver `pausa-da-vitoria.ts`.
 */

/** O sinal que pausa a Vitória numa conversa. */
export const SINAL_PARA_PAUSAR = "*";
/** O sinal que a faz retomar. */
export const SINAL_PARA_RETOMAR = "»";

/** O motivo da entrega quando a equipa pausa — e o que a Mesa mostra. */
export const MOTIVO_DA_PAUSA = "Pausada pela equipa (*)";

/** A linha do cartão «Assistente automático» do backoffice. */
export const COMO_PAUSAR_A_VITORIA =
  "Para pausar a Vitória numa conversa, escreva * na mensagem; para ela voltar, escreva ».";

/**
 * A LINHA DA ENTREGA NA MESA — «Pausada pela equipa (*)» quando foi a equipa a
 * pausar; «Entregue: <motivo>» nas outras (d116).
 */
export function linhaDaEntrega(motivo: string): string {
  return motivo.trim() === MOTIVO_DA_PAUSA ? MOTIVO_DA_PAUSA : `Entregue: ${motivo}`;
}
