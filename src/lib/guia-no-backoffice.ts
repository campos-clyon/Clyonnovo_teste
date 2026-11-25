/**
 * O ENTULHO SEM GUIA NO BACKOFFICE — 25-11-2026 (decisão d121). A d118 abriu o
 * fecho sem guia só no caminho da Vitória; no backoffice o dono não conseguia
 * atribuir o #679 (entulho, valor fixo) a um parceiro sem guia verificada.
 *
 * Agora um admin ou assistente PODE escolher, atribuir, trocar ou aceitar em
 * nome do cliente um parceiro sem guia verificada — com um sim explícito:
 *
 *   · o botão fica activo, com o aviso `AVISO_SEM_GUIA_NO_BACKOFFICE`;
 *   · sem a marca (`semGuiaConfirmado: true`) o servidor continua a recusar
 *     (409), com a frase nova e `pedeConfirmacaoDaGuia` — para não haver fecho
 *     sem querer; o painel pergunta (`fetchComAConfirmacaoDaGuia`) e repete;
 *   · com a marca, segue, e o histórico do pedido diz-o (`notaSemGuia`).
 *
 * O cliente (no link do pedido ou na app) vê a frase do Jurídico da d118 antes
 * de aceitar, e aceitar vale como a confirmação. A verificação da guia no
 * perfil do parceiro não muda. Este ficheiro é lido pelo painel: sem a base.
 */

export const AVISO_SEM_GUIA_NO_BACKOFFICE = "Este parceiro não emite guia de resíduos (e-GAR). Confirme que o cliente sabe.";

/** O selo da Mesa: informação, já não impedimento. */
export const SELO_SEM_GUIA = "Sem guia (e-GAR)";

/** O corpo do pedido traz o sim explícito? */
export function confirmouSemGuia(corpo: unknown): boolean {
  return Boolean(corpo && typeof corpo === "object" && (corpo as { semGuiaConfirmado?: unknown }).semGuiaConfirmado === true);
}

/** A recusa sem a marca — 409, com a frase nova e o pedido de confirmação. */
export const RECUSA_SEM_A_CONFIRMACAO_DA_GUIA = {
  error: AVISO_SEM_GUIA_NO_BACKOFFICE,
  guiaPorVerificar: true,
  pedeConfirmacaoDaGuia: true,
} as const;

/** O que fica no histórico do pedido. */
export function notaSemGuia(por: string | null | undefined): string {
  const quem = String(por ?? "").trim() || "a equipa";
  return `Atribuído sem guia de resíduos — o cliente foi avisado (por ${quem})`;
}

/**
 * O PEDIDO, COM A CONFIRMAÇÃO SE O SERVIDOR A PEDIR — no painel. Se a resposta
 * for a recusa por falta de guia (`pedeConfirmacaoDaGuia`), pergunta com a
 * frase e repete com `semGuiaConfirmado: true`; sem o sim, devolve a recusa
 * (o painel mostra a frase).
 */
export async function fetchComAConfirmacaoDaGuia(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 409) return res;
  const dados = (await res.clone().json().catch(() => null)) as { pedeConfirmacaoDaGuia?: unknown; error?: unknown } | null;
  if (!dados?.pedeConfirmacaoDaGuia) return res;
  if (typeof window === "undefined" || !window.confirm(String(dados.error ?? AVISO_SEM_GUIA_NO_BACKOFFICE))) return res;
  let corpo: Record<string, unknown> = {};
  try {
    corpo = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  } catch {
    corpo = {};
  }
  return fetch(url, { ...init, body: JSON.stringify({ ...corpo, semGuiaConfirmado: true }) });
}
