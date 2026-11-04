/**
 * DE QUE CONTA É UMA LINHA DE `pagamentos` — a coluna `parte`. Puro, sem base:
 * as rotas e os ecrãs lêem-no daqui (e `pagamentos-na-base.ts` reexporta-o).
 *
 *   · «trabalho»  — o pagamento do trabalho (o cliente; ou, combinado em
 *     dinheiro, a dívida do profissional, que é o pagamento da negociação);
 *   · «diferenca» — a diferença das horas confirmadas (31-10-2026);
 *   · «divida»    — 04-11-2026 (d9): a referência com que o profissional paga
 *     à CLYON o IVA e a taxa de um trabalho da plataforma que o cliente lhe
 *     pagou em mão. A negociação já está fechada pelo registo
 *     `ao_profissional`: paga, esta linha não toca em `negociacaoPaga` e fica
 *     com o `trid` da linha à parte (`tridDoAbatimentoAParte`), a mesma porta
 *     de todos os outros caminhos da dívida. Nunca se mostra ao cliente.
 */
export type ParteDoPagamento = "trabalho" | "diferenca" | "divida";

export const lerParte = (v: unknown): ParteDoPagamento =>
  v === "diferenca" ? "diferenca" : v === "divida" ? "divida" : "trabalho";

/** A linha é do cliente (o trabalho, ou a diferença das horas), e não a dívida do profissional? */
export const eDoCliente = (l: { parte?: unknown }): boolean => lerParte(l.parte) !== "divida";

/**
 * As linhas que contam umas com as outras para dizer qual está em vigor: as da
 * dívida do profissional só entre si, as do cliente só entre si (04-11-2026, d9).
 */
export function daMesmaConta<T extends { parte?: unknown }>(p: { parte?: unknown }, todas: T[]): T[] {
  return todas.filter((l) => eDoCliente(l) === eDoCliente(p));
}
