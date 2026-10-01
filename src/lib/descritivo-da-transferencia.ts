/**
 * O DESCRITIVO DA TRANSFERÊNCIA — os números dos pedidos que ela paga.
 *
 * *«Não consigo ver de qual trabalho se trata os valores.»* — 01-10-2026, no
 * ecrã das Carteiras.
 *
 * Uma transferência de 1 522,80 € sem descritivo é um número no extracto do
 * profissional, e ele não tem como saber que trabalhos paga. Com «CLYON pedidos
 * 361 358 330» sabe — e quem confere o banco do lado da CLYON também.
 *
 * Os bancos aceitam 140 caracteres no descritivo de uma transferência SEPA.
 * Passando disso, diz-se quantos trabalhos são e o primeiro e o último número —
 * cortar a meio da lista deixava de fora pedidos que ela também paga, sem
 * ninguém dar por isso.
 */
export const MAXIMO_DO_DESCRITIVO = 140;

export function descritivoDaTransferencia(pedidos: readonly number[]): string {
  if (pedidos.length === 0) return "CLYON";
  const completo = `CLYON pedidos ${pedidos.join(" ")}`;
  if (completo.length <= MAXIMO_DO_DESCRITIVO) return completo;
  return `CLYON ${pedidos.length} trabalhos, pedidos ${pedidos[0]} a ${pedidos[pedidos.length - 1]}`;
}
