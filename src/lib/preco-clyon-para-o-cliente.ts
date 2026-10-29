import { precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { textosDaConta, isoOuNulo, quandoEmLisboa, type TextosDoPreco } from "./pedido-para-a-app";
import { notaDoPrecoParaOCliente } from "./itens-a-mais";
import { lerBase } from "./base-do-preco";

/**
 * O PREÇO DE UM TRABALHO CLYON PARA O CLIENTE, NUM SÍTIO SÓ — 29-10-2026
 * (S20, P8 (a): o preço também no site).
 *
 * A app de cliente (R5), o link do pedido e a conta mostram o mesmo preço, com
 * IVA e o sem IVA ao lado, SÓ DEPOIS DE ENVIADO (antes a equipa pode ainda
 * estar a acertá-lo). Nunca o valor que o profissional recebe nem a taxa.
 */
export type PrecoClyonNoEcra = TextosDoPreco & {
  /** A versão do preço (quando foi enviado) — o «Aceito este preço» manda-a de volta. */
  versao: string;
  aceiteEm: string | null;
  aceiteEmTexto: string | null;
};

export function precoClyonParaOCliente(pedido: {
  valorFixoClyon?: unknown;
  taxaClyon?: unknown;
  precoClienteClyon?: unknown;
  propostaEnviadaEm?: Date | string | null;
  precoAceiteEm?: Date | string | null;
  baseDoPreco?: unknown;
}): PrecoClyonNoEcra | null {
  if (pedido.valorFixoClyon == null) return null;
  const versao = isoOuNulo(pedido.propostaEnviadaEm ?? null);
  if (!versao) return null;
  const conta = precoDaPropostaClyon({
    valorFixo: Number(pedido.valorFixoClyon),
    taxa: pedido.taxaClyon == null ? null : Number(pedido.taxaClyon),
    precoAoCliente: pedido.precoClienteClyon == null ? null : Number(pedido.precoClienteClyon),
  });
  if (!conta) return null;
  return {
    ...textosDaConta(conta, notaDoPrecoParaOCliente(lerBase(pedido.baseDoPreco as string | null), "clyon")),
    versao,
    aceiteEm: isoOuNulo(pedido.precoAceiteEm ?? null),
    aceiteEmTexto: quandoEmLisboa(pedido.precoAceiteEm ?? null),
  };
}
