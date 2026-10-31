/**
 * O VALOR QUER DIZER O QUE A BASE DIZ — no backoffice, 31-10-2026 (ordem do
 * CEO com o sim do dono, parte 1).
 *
 * O #536 era uma mudança «Por hora» com «Valor de partida (sem IVA) 270.00»
 * escrito como se fosse o total: o campo chamava-se igual nas três bases, e
 * o número lia-se como 270 € por hora. Agora o rótulo diz o que o número mede,
 * por hora mostra-se o mínimo de 3 horas e o total mínimo, e trocar de base
 * com um número escrito nunca o reinterpreta em silêncio: propõe a conversão
 * e só muda com um clique.
 *
 * Puro: os ecrãs do backoffice e os testes importam-no.
 */

import type { BaseDoPreco } from "./base-do-preco";
import { MINIMO_DE_HORAS_FATURADAS, estimativaDasHoras, horasDaEstimativa, horasEmPalavras } from "./horas-do-trabalho";
import { TAXA_IVA } from "./taxas-plataforma";

const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** O rótulo do campo do valor, pela base. */
export function rotuloDoValorPorBase(b: BaseDoPreco): string {
  return b === "hora" ? "Valor por hora (sem IVA)" : b === "carga" ? "Valor por carga (sem IVA)" : "Valor total (sem IVA)";
}

/** «/hora», «/carga» ou nada — colado a cada valor dos cartões do backoffice. */
export function sufixoDaBase(b: BaseDoPreco): string {
  return b === "hora" ? "/hora" : b === "carga" ? "/carga" : "";
}

/** «72,00 €/hora» — o número e a unidade, juntos. */
export function valorComSufixo(v: number, b: BaseDoPreco): string {
  return `${eur(v)}${sufixoDaBase(b)}`;
}

/** «Mínimo 3 horas · total mínimo 150,00 € + IVA (184,50 € com IVA)» — por baixo do valor por hora. */
export function minimoDasHorasEmPalavras(valorPorHora: number | null): string {
  if (valorPorHora == null || !Number.isFinite(valorPorHora) || valorPorHora <= 0) {
    return `Mínimo ${MINIMO_DE_HORAS_FATURADAS} horas.`;
  }
  const total = estimativaDasHoras(valorPorHora, MINIMO_DE_HORAS_FATURADAS);
  return `Mínimo ${MINIMO_DE_HORAS_FATURADAS} horas · total mínimo ${eur(total)} + IVA (${eur(arred(total * (1 + TAXA_IVA)))} com IVA)`;
}

/** «≈ 200,00 € em 4 h (estimado)» — o total estimado, ao lado de um valor por hora. */
export function totalEstimadoNoBackoffice(valorPorHora: number, horasPrevistas: number | null | undefined): string {
  const horas = horasDaEstimativa(horasPrevistas);
  return `≈ ${eur(estimativaDasHoras(valorPorHora, horas))} em ${horasEmPalavras(horas)} (estimado)`;
}

/**
 * AO TROCAR DE BASE COM UM NÚMERO ESCRITO — a conversão que se propõe, ou
 * `null` quando não há o que perguntar (campo vazio, mesma base). Total ↔ hora
 * divide/multiplica pelas horas previstas (mínimo 3); da carga, ou para ela,
 * não há conversão honesta: pergunta-se só se fica o mesmo número.
 */
export function trocaDeBase(
  valorEscrito: string,
  de: BaseDoPreco,
  para: BaseDoPreco,
  horasPrevistas: number | null | undefined,
): { texto: string; convertido: number | null } | null {
  if (de === para) return null;
  const v = Number(String(valorEscrito ?? "").trim().replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) return null;
  const horas = horasDaEstimativa(horasPrevistas);
  const nome = (b: BaseDoPreco) => (b === "hora" ? "por hora" : b === "carga" ? "por carga" : "total");
  if (de === "total" && para === "hora") {
    const c = arred(v / horas);
    return { texto: `${eur(v)} total ÷ ${horasEmPalavras(horas)} = ${eur(c)}/hora?`, convertido: c };
  }
  if (de === "hora" && para === "total") {
    const c = arred(v * horas);
    return { texto: `${eur(v)}/hora × ${horasEmPalavras(horas)} = ${eur(c)} total?`, convertido: c };
  }
  return { texto: `O valor ${eur(v)} era ${nome(de)}. Passa a ser ${eur(v)} ${nome(para)}?`, convertido: null };
}
