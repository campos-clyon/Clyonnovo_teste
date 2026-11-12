/**
 * A ORIGEM DA VISITA, LIMPA ANTES DE IR PARA O PEDIDO — 12-11-2026 (d8).
 *
 * O formulário manda a origem da visita (`origem-da-visita.ts`), e o gclid
 * só vai nela com o consentimento de marketing — é o browser que o tira a
 * quem não o deu (Consent Mode avançado). Aqui, no servidor, guarda-se só o
 * que é uma origem: os campos conhecidos, com tamanho, e um gclid que tenha a
 * forma de um gclid (letras, números, «-» e «_»). Um endereço com um email ou
 * um telefone no lugar do gclid não passa para a base.
 */

const CAMPOS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "entrada", "referrer", "quando"] as const;

const FORMA_DO_GCLID = /^[A-Za-z0-9_-]{10,200}$/;

/** O gclid, se tiver a forma de um. */
export function gclidValido(v: unknown): string | null {
  return typeof v === "string" && FORMA_DO_GCLID.test(v.trim()) ? v.trim() : null;
}

export type OrigemGravada = Partial<Record<(typeof CAMPOS)[number] | "gclid", string>>;

/** A origem para o rawOrderJson, ou `null` se não houver nada que seja uma. */
export function origemParaGravar(o: unknown): OrigemGravada | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const cru = o as Record<string, unknown>;
  const fora: OrigemGravada = {};
  for (const c of CAMPOS) {
    const v = cru[c];
    if (typeof v === "string" && v.trim()) fora[c] = v.trim().slice(0, c === "entrada" ? 300 : 200);
  }
  const gclid = gclidValido(cru.gclid);
  if (gclid) fora.gclid = gclid;
  return Object.keys(fora).length > 0 ? fora : null;
}
