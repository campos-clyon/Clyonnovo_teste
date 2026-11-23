/**
 * O «O QUE TERIA FEITO» DO PAINEL «ENSAIO DA VITÓRIA» — d92 (23-11-2026). PURO.
 *
 * Cada linha do painel ganha uma frase legível com o que o agente teria feito
 * (no ensaio) ou fez (a sério, com a «conversa livre» ligada): «teria proposto
 * o fecho do #663 com … por 86,96 € (à espera do SIM)», «teria perguntado a …
 * se consegue: «até quinta-feira»», «teria passado à equipa: …». E se AGIRIA
 * (fazer alguma coisa além de responder), para o filtro «só as que agiriam».
 */

/** Os estados das linhas a sério (o que saiu para o cliente). */
/** d97: «vivo_parceiro» — a resposta do parceiro à pergunta da Vitória (ou o prazo dela) chegou ao cliente ou à equipa. */
export const ESTADOS_A_SERIO = ["vivo_ok", "vivo_equipa", "vivo_codigo", "vivo_regras", "vivo_a_correr", "vivo_parceiro"] as const;

export function eASerio(estado: string): boolean {
  return estado.startsWith("vivo_");
}

export function oQueTeriaFeito(estado: string, motivo: string | null, teriaFeito: readonly string[]): { frase: string; agiria: boolean } {
  // d99: a recolha em ensaio («recolha_ok», «recolha_equipa»…) lê-se como as outras.
  const base = estado.replace(/^vivo_/, "").replace(/^recolha_/, "");
  const feito = teriaFeito.filter((l) => l.trim());
  const doEstado =
    base === "equipa"
      ? [`${eASerio(estado) ? "passou" : "teria passado"} à equipa${motivo ? `: ${motivo}` : ""}`]
      : base === "regras"
        ? [`deixou às regras${motivo ? ` (${motivo})` : ""}`]
        : [];
  // «passaria à equipa: …» já vem nas acções quando o modelo a chamou; não se repete.
  const linhas = [...feito.filter((l) => !(base === "equipa" && /^passaria à equipa/.test(l))), ...doEstado];
  if (linhas.length > 0) return { frase: linhas.join(" · "), agiria: feito.length > 0 || base === "equipa" || base === "codigo" };
  if (base === "ok") return { frase: eASerio(estado) ? "respondeu, sem outra acção" : "só teria respondido", agiria: false };
  return { frase: `não agiria${motivo ? ` (${motivo})` : ""}`, agiria: false };
}
