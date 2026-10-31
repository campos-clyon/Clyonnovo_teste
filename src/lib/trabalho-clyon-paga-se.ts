/**
 * UM TRABALHO CLYON PAGA-SE PELA NEGOCIAÇÃO? — d6, 31-10-2026. Puro, sem
 * dependências: lido pelo acesso ao pagamento e pelo fim do Trabalho CLYON.
 */

/**
 * Pagar a negociação é pagar o preço do cliente? Só no modelo com taxa (desde
 * 08-10-2026), e só quando o valor dela é o valor fixo do pedido — o preço ao
 * cliente, sem IVA. Em qualquer outro caso, paga-se pela referência da CLYON.
 */
export function sePagaPelaNegociacao(
  pedido: { valorFixoClyon?: unknown; taxaClyon?: unknown },
  linha: { valorAcordado?: unknown },
): boolean {
  if (pedido.valorFixoClyon == null || pedido.taxaClyon == null) return false;
  const fixo = Number(pedido.valorFixoClyon);
  const acordado = Number(linha.valorAcordado);
  return Number.isFinite(fixo) && Number.isFinite(acordado) && fixo > 0 && Math.abs(fixo - acordado) < 0.005;
}
