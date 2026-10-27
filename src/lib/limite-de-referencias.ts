/**
 * O LIMITE POR ASSISTENTE — 27-10-2026 (d14). Desde que quem tem a Mesa gera
 * referências no «Enviar adjudicação», cada assistente pode pedir ao euPago
 * até este número nas últimas 24 horas. O administrador não tem limite.
 */
export const MAXIMO_DE_REFERENCIAS_POR_ASSISTENTE = 20;

/** A recusa, dita como se diz a uma pessoa. `null` quando ainda pode. */
export function porqueNaoPodeGerarMais(papel: string | null | undefined, geradasEm24h: number): string | null {
  if (papel !== "assistente") return null;
  if (geradasEm24h < MAXIMO_DE_REFERENCIAS_POR_ASSISTENTE) return null;
  return (
    `Já gerou ${geradasEm24h} referências nas últimas 24 horas — o limite por assistente é de ` +
    `${MAXIMO_DE_REFERENCIAS_POR_ASSISTENTE}. Peça ao administrador para gerar esta.`
  );
}
