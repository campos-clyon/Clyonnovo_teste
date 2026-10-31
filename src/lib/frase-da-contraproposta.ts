import { MINIMO_DE_HORAS } from "./tabela-das-mudancas";

/**
 * A LEGENDA DA CONTRAPROPOSTA DO CLIENTE — 31-10-2026 (decisão d8).
 *
 * Estava escrita dentro de PropostasRecebidas.tsx («…, com IVA incluído.») e a
 * app, sem a receber da R5, dizia outra («…, com tudo incluído.»). Passa a
 * viver aqui: o site lê-a, e a R5 manda-a em cada negociação (`proporAjuda`).
 */
export function legendaDaContraproposta(n: { porHora?: boolean; ivaIncluido?: boolean | null }): string {
  if (n.porHora) {
    return n.ivaIncluido
      ? `É o que paga por hora se ele aceitar, com IVA incluído (mínimo ${MINIMO_DE_HORAS} horas).`
      : `É o que paga por hora se ele aceitar, mais IVA (mínimo ${MINIMO_DE_HORAS} horas).`;
  }
  return n.ivaIncluido ? "É o que paga se ele aceitar, com IVA incluído." : "É o que paga se ele aceitar, sem IVA.";
}
