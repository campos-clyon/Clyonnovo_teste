/**
 * O LINK QUE CHEGOU SEM SESSÃO — 29-10-2026 (A12 da especificação v3).
 *
 * Quando um link de clyon.pt abre a app e ele não tem sessão, o ecrã que o
 * link pedia está fechado e a app mostra o «Entrar». O caminho fica aqui, em
 * memória, e abre-se logo a seguir a entrar: um link de pedido aberto sem
 * sessão acaba nesse pedido. Não se guarda no telemóvel: fechar a app é
 * desistir do link, e um destino de ontem a abrir-se amanhã seria um susto.
 *
 * Vale 30 minutos — o tempo de repor a palavra-passe, se for preciso. Puro de
 * propósito: os testes do site importam-no.
 */

export const VALIDADE_DO_DESTINO_MS = 30 * 60_000;

let pendente: { caminho: string; em: number } | null = null;

export function guardarDestino(caminho: string, agora: number = Date.now()): void {
  pendente = { caminho, em: agora };
}

/** Tira o destino guardado (uma vez só). Passados 30 minutos, já não há. */
export function tirarDestino(agora: number = Date.now()): string | null {
  const p = pendente;
  pendente = null;
  if (!p || agora - p.em > VALIDADE_DO_DESTINO_MS) return null;
  return p.caminho;
}

/** Sair esquece o destino: o próximo a entrar neste telemóvel não herda o link de outro. */
export function esquecerDestino(): void {
  pendente = null;
}
