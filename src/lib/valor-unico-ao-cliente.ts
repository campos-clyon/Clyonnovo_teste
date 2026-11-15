import { precoDoCliente, semEComIva } from "./preco-do-cliente";
import { unidadeDaBase, type BaseDoPreco } from "./base-do-preco";

/**
 * O VALOR ÚNICO, DO LADO DO CLIENTE — 15-11-2026 (d39). A parte leve de
 * `valor-unico.ts`, para as páginas do cliente não levarem a Vitória no
 * pacote: o número com o IVA ao lado e a frase de quem faz.
 *
 * Do lado do cliente o valor único não leva taxa (como num Trabalho CLYON): é
 * o preço dele, sem IVA.
 */
const SEM_TAXA_DO_CLIENTE = { cliente: 0, profissional: 0 };

/** «140,00 € + IVA = 172,20 €» — nunca o sem IVA sozinho. */
export function valorUnicoComIva(valorSemIva: number): string {
  return semEComIva(precoDoCliente(valorSemIva, SEM_TAXA_DO_CLIENTE, "iva_incluido"));
}

/** O total com IVA do valor único — o que o cliente paga. */
export function totalDoValorUnico(valorSemIva: number): number {
  return precoDoCliente(valorSemIva, SEM_TAXA_DO_CLIENTE, "iva_incluido").total;
}

export const QUEM_FAZ_NO_VALOR_UNICO =
  "Quem faz é um parceiro verificado da sua zona — quando aceitar, dizemos-lhe quem é, o dia e como pagar.";

/** Encurtado, para a mensagem curta do orçamento (d47, 15-11-2026). */
export const QUEM_FAZ_NO_VALOR_UNICO_CURTO = "Quem faz é um parceiro verificado da sua zona.";

/** Uma coluna DECIMAL da base (texto ou número) como valor único, ou null. */
export function valorUnicoDaLinha(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** O que o cliente vê na página do pedido, enquanto a CLYON não escolheu. */
export function valorUnicoParaOCliente(
  valorSemIva: number,
  base: BaseDoPreco | null | undefined,
): { titulo: string; valor: string; quemFaz: string } {
  return {
    titulo: "O seu orçamento",
    valor: `${valorUnicoComIva(valorSemIva)}${unidadeDaBase(base ?? "total")}`,
    quemFaz: QUEM_FAZ_NO_VALOR_UNICO,
  };
}
