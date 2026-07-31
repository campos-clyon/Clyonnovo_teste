/**
 * Utilitário para leitura/escrita consistente das credenciais do colaborador.
 *
 * A leitura tenta localStorage primeiro; se não encontrar, tenta
 * sessionStorage — sessões antigas ficaram gravadas nos dois sítios.
 *
 * Isto guarda o nome e o id para o painel mostrar quem está a trabalhar. Quem
 * decide se a pessoa entra é o cookie httpOnly que o middleware verifica; o
 * que está aqui é comodidade, não é tranca.
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

/**
 * Termina a sessão: os dois storages e o cookie.
 *
 * O cookie de sessão é httpOnly, portanto não se apaga daqui — pede-se ao
 * servidor. Isto vive dentro desta função de propósito: há sete sítios que a
 * chamam (sair, palavra-passe alterada, 401 numa chamada, conta sem
 * permissão…) e qualquer um deles que se esquecesse do cookie deixava a
 * porta aberta com o painel a dizer que a sessão tinha terminado.
 */
export function clearColaboradorStorage() {
  if (!isBrowser()) return;
  Object.values(KEYS).forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  // keepalive: o pedido chega mesmo que a navegação a seguir seja imediata
  void fetch("/api/admin/sessao/sair", { method: "POST", keepalive: true }).catch(() => {});
}
