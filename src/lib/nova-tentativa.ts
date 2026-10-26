/**
 * UMA SEGUNDA TENTATIVA PARA AS FALHAS DE REDE — 26-10-2026 (d32, parte G).
 *
 * A primeira ligação de uma instância nova ao MySQL do Railway às vezes não
 * chega a tempo (ETIMEDOUT), e logo a seguir chega. Isto repete o trabalho só
 * nesses casos — tempo esgotado, ligação recusada ou cortada —, com uma pausa
 * que cresce. Um erro de SQL ou de lógica não se repete: atira-se logo.
 */

const CODIGOS_DE_REDE = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "EAI_AGAIN",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_SEQUENCE_TIMEOUT",
]);

/** É uma falha de rede, das que passam sozinhas? */
export function falhaDeRede(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const codigo = String((e as { code?: unknown }).code ?? "");
  if (CODIGOS_DE_REDE.has(codigo)) return true;
  const msg = e instanceof Error ? e.message : "";
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|connect timed out/i.test(msg);
}

export async function comNovaTentativa<T>(
  trabalho: () => Promise<T>,
  opcoes: { tentativas?: number; esperaMs?: number; dormir?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const tentativas = Math.max(1, opcoes.tentativas ?? 3);
  const espera = Math.max(0, opcoes.esperaMs ?? 1500);
  const dormir = opcoes.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let ultimo: unknown;
  for (let i = 1; i <= tentativas; i++) {
    try {
      return await trabalho();
    } catch (e) {
      ultimo = e;
      if (!falhaDeRede(e) || i === tentativas) throw e;
      console.warn(`[nova tentativa] falha de rede (${(e as { code?: string }).code ?? "?"}) — tentativa ${i + 1} de ${tentativas}`);
      await dormir(espera * i);
    }
  }
  throw ultimo;
}
