import { appendOrderHistory, updateSimulatorOrder } from "./db";
import type { DadosDaRecolha } from "./whatsapp-recolha";
import type { PedidoDaBase } from "./pedido-aberto-na-conversa";
import type { AnotadoNoPedido } from "./resposta-ao-que-falta";
import type { ChaveDaFalta } from "./mensagem-do-que-falta";

/**
 * A RESPOSTA AO «PEDIR O QUE FALTA», GRAVADA NO PEDIDO — UMA SÓ FUNÇÃO PARA
 * TODOS OS CANAIS (d3, 23-11-2026; nasceu na d86 dentro do WhatsApp).
 *
 * O que o cliente respondeu, lido parte a parte (`lerARespostaAoQueFalta`),
 * entra nos campos que estavam vazios (`camposParaOPedido` e o dia,
 * `oDiaParaOPedido`) e nas fontes da descrição (`juntarAConversaNaDescricao`);
 * conta-se outra vez o que falta; completo, o pedido sai de «precisa info»
 * (`oPedidoFicouCompleto`) e segue sozinho para os parceiros
 * (`seguirSozinhoParaOsParceiros`, com todas as condições). Devolve a
 * mensagem para o cliente (uma só, curta). Quem chama decide como a entrega:
 * a Vitória, por WhatsApp (guarda também a conversa), ou a CLYON, na conta do
 * site e na app (uma mensagem na conversa do pedido).
 *
 * Devolve `null` quando não havia nada a gravar nem pergunta a responder:
 * quem chama segue o caminho de sempre.
 */
export type CanalDaResposta = "whatsapp" | "conta";

export type RespostaGravada = {
  /** A mensagem para o cliente. */
  resposta: string;
  /** Os dados do pedido depois da leitura (a conversa do WhatsApp guarda-os). */
  depois: DadosDaRecolha;
  anotado: AnotadoNoPedido[];
  faltas: ChaveDaFalta[];
  /** O envio automático aos parceiros foi feito (d87). */
  jaSeguiu: boolean;
  /** As fontes da descrição mudaram: depois da resposta, o modelo reescreve-a. */
  fontesMudaram: boolean;
};

const ONDE: Record<CanalDaResposta, { onde: string; etiqueta: string }> = {
  whatsapp: { onde: "no WhatsApp", etiqueta: "whatsapp/o-que-falta" },
  conta: { onde: "na conta ou na app", etiqueta: "conta/o-que-falta" },
};

const NOMES_DO_QUE_FICOU: Record<string, string> = {
  descricao: "descrição",
  fotografias: "fotografias",
  estacionamento: "estacionamento",
  andar: "andar",
  elevador: "elevador",
  data: "dia",
  notas: "notas",
};

export async function gravarARespostaAoQueFalta(x: {
  canal: CanalDaResposta;
  pedido: PedidoDaBase;
  /** O pedido como o cliente o via antes da resposta (`dadosDoPedido`). */
  doPedido: DadosDaRecolha;
  /** Os dados da conversa (`dadosDaConversaNoPedido`), com as fotografias novas já contadas. */
  dados: DadosDaRecolha;
  texto: string;
  /** Fotografias que vieram com a resposta. */
  imagens: number;
  contratado: boolean;
  /** A Vitória ainda não se apresentou (só conta no WhatsApp). */
  apresentar: boolean;
  agora?: Date;
}): Promise<RespostaGravada | null> {
  const pa = await import("./pedido-aberto-na-conversa");
  const rq = await import("./resposta-ao-que-falta");
  const nb = await import("./descricao-do-pedido-na-base");
  const { onde, etiqueta } = ONDE[x.canal];
  const id = Number(x.pedido.id);
  const agora = x.agora ?? new Date();

  const lido = rq.lerARespostaAoQueFalta(x.dados, x.texto, agora, { imagens: x.imagens });
  if (lido.anotado.length === 0 && lido.perguntas.length === 0) return null;
  const depois = lido.dados;

  // Os campos que estavam vazios — nunca por cima do que lá está.
  const campos = {
    ...pa.camposParaOPedido(x.pedido, depois),
    ...rq.oDiaParaOPedido(x.pedido as { dataAgendada?: Date | string | null; urgency?: string | null }, depois, agora),
  };
  if (Object.keys(campos).length > 0) {
    try {
      await updateSimulatorOrder(id, campos as unknown as Parameters<typeof updateSimulatorOrder>[1]);
    } catch (e) {
      console.error(`[${etiqueta}] não actualizei os campos do pedido:`, e);
    }
  }
  // A descrição, a partir das fontes: o que ela contou do trabalho e as notas (o estacionamento, a flexibilidade).
  let fontesMudaram = false;
  let porTraduzir = false;
  try {
    const novos = { ...pa.oQueEDaConversa(x.doPedido, depois), fotosRecebidas: depois.fotosRecebidas };
    const escrita = await nb.juntarAConversaNaDescricao(id, novos);
    fontesMudaram = escrita?.fontesMudaram === true;
    porTraduzir = escrita?.porTraduzir === true;
  } catch (e) {
    console.error(`[${etiqueta}] não actualizei a descrição:`, e);
  }
  if (lido.anotado.length > 0) {
    await appendOrderHistory(id, {
      type: "created",
      by: null,
      message:
        x.canal === "whatsapp"
          ? `A Vitória juntou ao pedido o que o cliente respondeu ao «Pedir o que falta» no WhatsApp: ${lido.anotado.map((a) => NOMES_DO_QUE_FICOU[a] ?? a).join(", ")}.`
          : `O cliente respondeu ao «Pedir o que falta» ${onde} e ficou junto ao pedido: ${lido.anotado.map((a) => NOMES_DO_QUE_FICOU[a] ?? a).join(", ")}.`,
    }).catch(() => {});
  }

  // As perguntas: o que o site responde, responde-se; o resto fica para a equipa, como sempre.
  const respostas: string[] = [];
  let paraAEquipa = false;
  for (const q of lido.perguntas) {
    const a = pa.respostaAPerguntaNoPedido(q, { compreensao: null, contratado: x.contratado });
    if (a.paraAEquipa) {
      paraAEquipa = true;
      await appendOrderHistory(id, {
        type: "created",
        by: null,
        message: `Pergunta do cliente ${onde}, por responder: «${q.replace(/\s+/g, " ").slice(0, 200)}»`,
      }).catch(() => {});
    } else if (!respostas.includes(a.resposta)) {
      respostas.push(a.resposta);
    }
  }

  // O que ainda falta, com o pedido como ficou; completo, sai de «precisa info».
  const { oPedidoFicouCompleto } = await import("./resposta-ao-que-falta-na-base");
  const { oQueFaltaNoPedido } = await import("./o-que-falta-no-pedido");
  const fim = await oPedidoFicouCompleto(id, x.canal).catch((e) => {
    console.error(`[${etiqueta}] não contei o que falta:`, e);
    return {
      faltas: oQueFaltaNoPedido({ ...(x.pedido as object), ...campos } as unknown as Parameters<typeof oQueFaltaNoPedido>[0]),
      saiu: false,
    };
  });

  /*
   * O PEDIDO COMPLETO SEGUE SOZINHO PARA OS PARCEIROS (d87/d2). Antes de
   * responder, para a mensagem dizer a verdade: feito o envio, «já seguiu…»;
   * nos «por enviar» ou na fila das 8h00, «a equipa confere-o e segue…».
   * Pela MESMA função da Mesa.
   */
  let jaSeguiu = false;
  const { arrumarAsFaltas } = await import("./mensagem-do-que-falta");
  if (arrumarAsFaltas(fim.faltas).length === 0) {
    const { seguirSozinhoParaOsParceiros } = await import("./envio-automatico-aos-parceiros-na-base");
    const envio = await seguirSozinhoParaOsParceiros(id, { origem: "pedir_o_que_falta", porTraduzir }).catch(() => null);
    jaSeguiu = envio?.estado === "enviado";
  }

  const { PERGUNTA_ANOTADA } = await import("./voz-da-vitoria");
  const principal = rq.respostaAoQueFalta({
    pedidoId: id,
    nome: pa.pedidoNaConversa(x.pedido).nome,
    servico: x.pedido.serviceType,
    anotado: lido.anotado,
    quando: lido.anotado.includes("data") ? rq.oQuandoParaAResposta(depois) : null,
    faltam: fim.faltas,
    apresentar: x.apresentar,
    jaSeguiu,
  });
  const resposta = [principal, ...respostas, ...(paraAEquipa ? [PERGUNTA_ANOTADA] : [])].join("\n");
  return { resposta, depois, anotado: lido.anotado, faltas: fim.faltas, jaSeguiu, fontesMudaram };
}
