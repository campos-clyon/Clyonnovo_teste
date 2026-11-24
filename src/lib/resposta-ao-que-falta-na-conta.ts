import { appendOrderHistory, getSimulatorOrderById, negociacoesDoPedido } from "./db";
import { ABERTURA_DO_QUE_FALTA } from "./mensagem-do-que-falta";
import type { PedidoDaBase } from "./pedido-aberto-na-conversa";

/**
 * A RESPOSTA AO «PEDIR O QUE FALTA» DADA NA CONTA DO SITE OU NA APP — d3,
 * 23-11-2026. Faz o mesmo que no WhatsApp (d86): o que o cliente respondeu
 * entra nos campos que estavam vazios (andar, elevador, estacionamento, dia,
 * descrição, notas), conta-se outra vez o que falta e, completo, o pedido sai
 * de «precisa info» e segue sozinho para os parceiros (d87, com todas as
 * condições e o horário das 9h às 20h). Pela MESMA função
 * (`gravarARespostaAoQueFalta`).
 *
 * O que o cliente lê: uma mensagem na conversa do pedido, da «CLYON» (nunca o
 * nome de uma pessoa da equipa), com o que ficou anotado, o que falta e o
 * passo seguinte.
 *
 * Só se aplica a um pedido em «precisa info» cuja última mensagem é o «Pedir o
 * que falta» (começa pela abertura da lista). Um «Pedir info» escrito à mão
 * continua à espera de uma pessoa. Nunca lança: a resposta do cliente já está
 * gravada, e isto é o que a Vitória faz a mais.
 */
export async function aplicarARespostaAoQueFalta(
  pedidoId: number,
  mensagem: string,
  fotografias: number,
  agora: Date = new Date(),
): Promise<{ aplicada: boolean }> {
  try {
    const pedido = (await getSimulatorOrderById(pedidoId)) as (PedidoDaBase & { mensagemCliente?: string | null }) | undefined;
    if (!pedido) return { aplicada: false };
    if (String(pedido.status ?? "").trim() !== "precisa_info") return { aplicada: false };
    if (!String(pedido.mensagemCliente ?? "").trim().startsWith(ABERTURA_DO_QUE_FALTA)) return { aplicada: false };

    const pa = await import("./pedido-aberto-na-conversa");
    const { gravarARespostaAoQueFalta } = await import("./gravar-a-resposta-ao-que-falta");
    const doPedido = pa.dadosDoPedido(pedido);
    let dados = pa.dadosDaConversaNoPedido(pedido, null, null);
    if (fotografias > 0) dados = { ...dados, fotosRecebidas: (dados.fotosRecebidas ?? 0) + fotografias };
    const contratado = (await negociacoesDoPedido(pedidoId).catch(() => [])).some((n) => n.estado === "acordada");

    const g = await gravarARespostaAoQueFalta({
      canal: "conta",
      pedido,
      doPedido,
      dados,
      texto: mensagem,
      imagens: fotografias,
      contratado,
      apresentar: false,
      agora,
    });
    if (!g) return { aplicada: false };

    // A resposta da CLYON, na conversa do pedido: `message_to_client` não muda o estado do pedido.
    await appendOrderHistory(pedidoId, {
      type: "message_to_client",
      by: { id: 0, nome: "CLYON", role: "sistema" },
      message: g.resposta,
    });
    const { avisarDaRespostaDaClyon } = await import("./conversa-com-a-clyon");
    await avisarDaRespostaDaClyon(pedidoId).catch(() => {});
    if (g.fontesMudaram) {
      const nb = await import("./descricao-do-pedido-na-base");
      await nb.depoisDaResposta(() => nb.reescreverADescricao(pedidoId));
    }
    return { aplicada: true };
  } catch (e) {
    console.error("[conta/o-que-falta] a resposta ficou só no histórico:", e instanceof Error ? e.message : e);
    return { aplicada: false };
  }
}
