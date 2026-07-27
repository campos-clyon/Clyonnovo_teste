/**
 * Colunas jsonb que o painel mostra como texto.
 *
 * `service_requests.details` é jsonb: o motor da app grava lá um objecto, não
 * uma frase. Se esse objecto chegar ao JSX como filho directo, o React atira
 * o erro #31 ("objects are not valid as a React child") e leva o ecrã inteiro
 * com ele — foi assim que a agenda deixou de abrir em produção.
 *
 * A regra é sanear na fronteira: nenhuma rota do painel devolve um objecto
 * num campo que a interface vai imprimir. O objecto original, quando é útil,
 * viaja à parte (`details_meta`) e é formatado por quem o sabe ler.
 */
export function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ") || null;
  }
  // Objecto: não há texto honesto a inventar aqui. Quem precisa do conteúdo
  // usa o campo _meta; quem só quer imprimir recebe null e mostra o fallback.
  if (typeof value === "object") return null;
  return String(value);
}

/** O objecto por trás de um campo de texto, quando existe. */
export function metaOf(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
