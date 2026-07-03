/**
 * Utilitário para leitura/escrita consistente das credenciais do colaborador.
 *
 * - localStorage  → sessão persistente (rememberMe = true, JWT 30d)
 * - sessionStorage → sessão temporária (rememberMe = false, JWT 8h)
 *
 * A leitura tenta localStorage primeiro; se não encontrar, tenta sessionStorage.
 * Isto garante que o dashboard funciona independentemente de qual storage foi usado.
 */

const KEYS = {
  token: "colaborador_token",
  nome: "colaborador_nome",
  id: "colaborador_id",
  isAdmin: "colaborador_isAdmin",
  funcao: "colaborador_funcao",
} as const;

function isBrowser() {
  return typeof window !== "undefined";
}

/** Lê um valor de localStorage ou sessionStorage (nessa ordem). */
export function getColaboradorItem(key: keyof typeof KEYS): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(KEYS[key]) ?? sessionStorage.getItem(KEYS[key]);
}

/** Remove as credenciais de ambos os storages (usado no logout). */
export function clearColaboradorStorage() {
  if (!isBrowser()) return;
  Object.values(KEYS).forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}
