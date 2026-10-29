/**
 * O histórico diz que o pedido foi juntado a uma conta pela app de cliente —
 * para os pedidos ligados entre 28 e 29-10-2026, antes da coluna
 * `contaJuntadaEm` (Segurança, R13). Puro: a Mesa usa-o no browser.
 */
export function foiJuntadoPelaApp(historyJson: unknown): boolean {
  try {
    const h = JSON.parse(String(historyJson ?? "[]"));
    return Array.isArray(h) && h.some((e) => /^Pedido juntado à conta .* pela app de cliente\.$/.test(String(e?.message ?? "")));
  } catch {
    return false;
  }
}
