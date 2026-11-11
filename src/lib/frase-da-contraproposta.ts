import { minimoDeHorasEmPalavras } from "./horas-do-trabalho";

/**
 * A LEGENDA DA CONTRAPROPOSTA DO CLIENTE — 31-10-2026 (decisão d8).
 *
 * Estava escrita dentro de PropostasRecebidas.tsx («…, com IVA incluído.») e a
 * app, sem a receber da R5, dizia outra («…, com tudo incluído.»). Passa a
 * viver aqui: o site lê-a, e a R5 manda-a em cada negociação (`proporAjuda`).
 */
export function legendaDaContraproposta(n: {
  porHora?: boolean;
  ivaIncluido?: boolean | null;
  /** Numa mudança da lista, o mínimo de horas do parceiro (d7, 11-11-2026); sem ele, o da casa. */
  minimoHoras?: number | null;
}): string {
  if (n.porHora) {
    const minimo = `mínimo ${minimoDeHorasEmPalavras(n.minimoHoras)}`;
    return n.ivaIncluido
      ? `É o que paga por hora se ele aceitar, com IVA incluído (${minimo}).`
      : `É o que paga por hora se ele aceitar, mais IVA (${minimo}).`;
  }
  return n.ivaIncluido ? "É o que paga se ele aceitar, com IVA incluído." : "É o que paga se ele aceitar, sem IVA.";
}
