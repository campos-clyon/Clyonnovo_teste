/**
 * O PEDIDO NOVO COMPLETO SEGUE SOZINHO — d3, 23-11-2026. O simulador, o
 * formulário da página inicial e a app de cliente chamam isto logo depois de
 * gravar o pedido (fora do pedido do cliente, em `after()`), em vez de esperar
 * pela rotina de 15 em 15 minutos. É a MESMA função da Mesa, da Vitória e da
 * rotina (`seguirSozinhoParaOsParceiros`, com as condições da d87, da d2 e da
 * d88): um pedido incompleto fica de fora sem barulho (a Mesa diz o que falta);
 * completo, espera os 10 minutos da d88; e fora das 9h–20h de Lisboa fica na
 * fila e sai às 9h00. Nunca lança: o pedido já está gravado.
 */
export async function seguirOPedidoNovo(pedidoId: number): Promise<void> {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return;
  try {
    const { seguirSozinhoParaOsParceiros, ORIGEM_DOS_ORCAMENTOS_NOVOS } = await import("./envio-automatico-aos-parceiros-na-base");
    await seguirSozinhoParaOsParceiros(pedidoId, { origem: ORIGEM_DOS_ORCAMENTOS_NOVOS, todasAsOrigens: true });
  } catch (e) {
    console.error(`[seguir-o-pedido-novo] o pedido #${pedidoId} fica nos «por enviar»:`, e instanceof Error ? e.message : e);
  }
}
