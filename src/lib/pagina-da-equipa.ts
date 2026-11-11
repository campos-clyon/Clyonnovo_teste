/**
 * AS PÁGINAS DA EQUIPA NÃO CONTAM NAS MÉTRICAS — 11-11-2026.
 *
 * Um clique no WhatsApp dentro do backoffice (/admin), do painel do parceiro
 * (/painel, /profissionais/…) ou da página de quem se candidata é da equipa
 * ou de um parceiro, não de um cliente: contava como lead e enchia os
 * números (e o Google Ads) com cliques nossos. Não se mede no browser, não se
 * grava na rota e não se conta no quadro (para os que já lá estão).
 */
export const PREFIXOS_DA_EQUIPA = ["/admin", "/painel", "/profissionais"] as const;

/** O caminho é de uma página da equipa ou dos parceiros? (com ou sem o resto do endereço) */
export function paginaDaEquipa(caminho: string | null | undefined): boolean {
  if (!caminho) return false;
  let p = String(caminho).trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    /* fica o texto */
  }
  p = p.split(/[?#]/)[0].toLowerCase();
  return PREFIXOS_DA_EQUIPA.some((x) => p === x || p.startsWith(`${x}/`));
}

/** A mesma regra em SQL, para os eventos já gravados: `AND <isto>`. */
export const FORA_DAS_PAGINAS_DA_EQUIPA_SQL =
  "(pagePath IS NULL OR NOT (" +
  PREFIXOS_DA_EQUIPA.map((x) => `pagePath = '${x}' OR pagePath LIKE '${x}/%'`).join(" OR ") +
  "))";
