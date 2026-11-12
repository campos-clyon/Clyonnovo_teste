/**
 * O PROFISSIONAL RESPONDEU A ESTA NEGOCIAÇÃO? — 12-11-2026 (d8).
 *
 * A coluna «Respondeu» dos Profissionais contava `JSON_LENGTH(propostasJson) > 1`.
 * Uma negociação nasce vazia (`[]`) — o profissional propõe primeiro —, e por
 * isso a primeira proposta dele, a resposta que interessa, ficava por contar:
 * só a segunda entrava. Quem respondeu uma vez aparecia com zero.
 *
 * Respondeu quando há uma proposta dele (`por: "profissional"`) ou quando
 * aceitou o valor que lhe foi posto (uma proposta `aceite`, ou a negociação já
 * em `aguarda_contratacao`/`acordada`).
 */
export function profissionalRespondeu(propostasJson: unknown, estado: unknown): boolean {
  if (estado === "aguarda_contratacao" || estado === "acordada") return true;
  let propostas: unknown = propostasJson;
  if (typeof propostasJson === "string") {
    try {
      propostas = JSON.parse(propostasJson);
    } catch {
      return false;
    }
  }
  if (!Array.isArray(propostas)) return false;
  return propostas.some(
    (p) =>
      p != null &&
      typeof p === "object" &&
      ((p as { por?: unknown }).por === "profissional" || (p as { estado?: unknown }).estado === "aceite"),
  );
}
