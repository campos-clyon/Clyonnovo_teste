import { contaDoCliente, regimeDeIva } from "@/lib/taxas-plataforma";
import { euros } from "@/lib/texto-da-mesa";

/**
 * O TOTAL DITO AO CLIENTE — E SÓ SE FALA DE IVA QUANDO HÁ IVA.
 *
 * Saía sempre a mesma frase:
 *
 *   «Com o IVA e a taxa CLYON, fica em 315,00 €.»
 *
 * ...e 315 eram 300 mais 5 % de taxa, com ZERO de imposto. O regime é do
 * profissional, não nosso: um isento pelo artigo 53.º não liquida IVA nenhum,
 * e a coluna `providers.regimeIva` nasce em `isento` — ou seja, o caso comum é
 * exactamente aquele em que a frase mentia.
 *
 * Acaba mal das duas maneiras. O cliente de um isento fica à espera de uma
 * factura com 23 % que nunca vai chegar, ou desconfia de quem lho disse. E o
 * cliente de quem liquida IVA mas tem o perfil por preencher lê 315,00 € e
 * recebe uma factura de 384,00 €.
 *
 * O ecrã do site já distingue os dois casos há muito — `contaDoCliente`
 * devolve `temIva` precisamente para isto. O WhatsApp, que é o único canal que
 * fala sozinho e sem ninguém a rever, era o único que não ramificava. A frase
 * passa a estar escrita uma vez só, aqui.
 *
 * NÃO VIVE EM `taxas-plataforma.ts` de propósito: esse ficheiro é o da conta e
 * não se lhe toca. Aqui só se escreve em português o que ele calcula.
 */
export function totalEmPalavras(valor: number, regimeIva: string | null): string {
  const conta = contaDoCliente(valor, regimeDeIva(regimeIva));
  return conta.temIva
    ? `Com o IVA e a taxa CLYON, fica em ${euros(conta.total)}.`
    : `Com a taxa CLYON, fica em ${euros(conta.total)}.`;
}
