import type { Taxas } from "./taxas-plataforma";

/**
 * A PARTE DA CLYON, CONTADA SOBRE O QUE O CLIENTE PAGA — 29-09-2026.
 *
 * "Vamos apresentar o valor proposto já com a taxa: o pro propôs 350, para o
 *  cliente vai aparecer 367,5, para o pro 327,08 — assim a CLYON mantém-se a
 *  ganhar os 11 %."
 *
 * Os 11 % deixaram de ser «5 ao cliente mais 6 ao profissional», somados sobre
 * o valor do profissional: são 11 % do que SAI DA CARTEIRA DO CLIENTE. Com o
 * cliente a pagar mais 5 %, isso dá 6,55 % descontados ao profissional —
 * 350 € → 367,50 € → 327,08 €, e 40,42 € para a CLYON.
 *
 * A base continua a guardar as duas taxas de sempre (`taxaCliente`,
 * `taxaProfissional`) e as contas continuam em `taxas-plataforma.ts`. Isto é
 * só a tradução entre a forma como o dono pensa («fico com 11 % do que o
 * cliente paga») e a forma como as taxas se guardam.
 */

/** A fracção do que o cliente paga (sem IVA) que fica na CLYON. */
export function quotaDaClyon(t: Taxas): number {
  return (t.cliente + t.profissional) / (1 + t.cliente);
}

/**
 * A taxa do profissional que dá esta quota, com este acréscimo ao cliente.
 *
 * Arredondada a quatro casas — é assim que `guardarTaxas` a guarda, e o ecrã
 * tem de mostrar o número que vai mesmo ficar. Pode dar negativa (uma quota
 * mais pequena do que o próprio acréscimo): quem chama decide o que dizer,
 * e a rota das taxas recusa-a com uma frase que se lê.
 */
export function taxaDoProfissionalParaAQuota(cliente: number, quota: number): number {
  return Math.round((quota * (1 + cliente) - cliente) * 10000) / 10000;
}
