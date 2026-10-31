import { sendPushToUser } from "./webpush";
import { urlDeAccao } from "./url-do-site";
import { quandoEmLisboa } from "./pedido-para-a-app";

/**
 * OS AVISOS AO CLIENTE, NO TELEMÓVEL — d8 fase 2, S10 (28-10-2026; R6).
 *
 * Cada aviso leva nos dados o pedido (`pedidoId`), o tipo e, quando há, a
 * negociação: a app de cliente abre ESSE pedido quando ele toca no aviso
 * (`caminhoDoAviso`). O `url` continua, para o navegador.
 *
 * A lista é a da R6: proposta nova, o profissional aceitou o valor dele, dia
 * combinado ou mudado, a caminho, chegou, ajuste pedido, trabalho feito por
 * confirmar (com e sem fotografias), confirmado pela CLYON, referência de
 * pagamento criada, pagamento recebido, preço da CLYON enviado, e quem faz um
 * Trabalho CLYON. Voz de plataforma: o nome do profissional quando é ele que
 * age, e nunca «a CLYON vai / leva». Todos saem para a app «cliente» — nunca
 * tocam na CLYON Pro do mesmo email.
 *
 * As frases são puras (`avisoAoCliente`) para se poderem testar; o envio
 * nunca lança — o que o provocou já está gravado.
 */

export type TipoDeAvisoAoCliente =
  | "proposta"
  | "aceitou"
  | "dia"
  | "a_caminho"
  | "proximo"
  | "chegou"
  // As horas de um trabalho por hora, marcadas pelo parceiro (31-10-2026).
  | "horas"
  | "ajuste"
  | "feito"
  | "feito_sem_fotografias"
  | "confirmado"
  | "referencia"
  | "pago"
  | "preco_clyon"
  | "escolhido"
  // S18/S19 (29-10-2026): o pedido de mais detalhes, uma mensagem da CLYON, o cancelamento.
  | "detalhes"
  | "mensagem"
  | "cancelado"
  // S19: o dia marcado ou mudado pela CLYON (na Agenda).
  | "dia_pela_clyon"
  // S17: a alteração que pediu foi aplicada ou não.
  | "alteracao_aplicada"
  | "alteracao_recusada"
  // S19, o resto da B3 (29-10-2026): o que a equipa faz no backoffice.
  | "editado"
  | "tipo"
  | "enviado"
  | "preco_mudou"
  | "ajuste_respondido"
  | "proposta_pela_clyon"
  | "reaberto"
  | "trocado";

/** Num Trabalho CLYON a app não mostra a linha do tempo nem o pagamento (v1): só estes. */
const NUM_TRABALHO_CLYON: ReadonlySet<TipoDeAvisoAoCliente> = new Set(["preco_clyon", "escolhido", "detalhes", "mensagem", "cancelado", "dia_pela_clyon", "alteracao_aplicada", "alteracao_recusada", "editado", "tipo", "preco_mudou", "reaberto", "trocado"]);

const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] || "O parceiro";

export function avisoAoCliente(
  tipo: TipoDeAvisoAoCliente,
  d: { pedidoId: number; nome?: string | null; dia?: Date | string | null; motivo?: string | null },
): { title: string; body: string } {
  const nome = primeiroNome(d.nome);
  const id = d.pedidoId;
  switch (tipo) {
    case "proposta":
      return { title: `Proposta de ${nome}`, body: `Chegou uma proposta para o pedido #${id}. Toque para ver e responder.` };
    case "aceitou":
      return { title: `${nome} aceitou o seu valor`, body: `Pedido #${id}: falta confirmar que contrata ${nome}.` };
    case "dia": {
      const dia = quandoEmLisboa(d.dia ?? null);
      return dia
        ? { title: "Dia combinado", body: `${nome} marcou o trabalho do pedido #${id} para ${dia}.` }
        : { title: "O dia mudou", body: `${nome} desmarcou o dia do trabalho do pedido #${id}. Vai combinar outro consigo.` };
    }
    case "a_caminho":
      return { title: `${nome} vai a caminho`, body: `Para o trabalho do pedido #${id}.` };
    case "proximo":
      return { title: `${nome} está próximo`, body: `Quase a chegar ao local do trabalho do pedido #${id}.` };
    case "chegou":
      return { title: `${nome} chegou`, body: `Ao local do trabalho do pedido #${id}. Confirme no pedido que chegou.` };
    case "horas":
      return { title: `${nome} marcou as horas`, body: `Pedido #${id}: veja as horas do trabalho e confirme.` };
    case "ajuste":
      return { title: `${nome} pediu para mudar o valor`, body: `Pedido #${id}: veja o valor novo e responda.` };
    case "feito":
      return {
        title: "O trabalho está feito",
        body: `${nome} marcou o trabalho do pedido #${id} como feito. Confirme que ficou feito.`,
      };
    case "feito_sem_fotografias":
      return {
        title: "O trabalho está feito",
        body: `${nome} marcou o trabalho do pedido #${id} como feito. Confirme que ficou feito.`,
      };
    case "confirmado":
      return { title: "Trabalho confirmado", body: `O trabalho do pedido #${id} ficou confirmado. Pode avaliar ${nome}.` };
    case "referencia":
      return { title: "Referência de pagamento", body: `A referência do pedido #${id} está pronta. Toque para a ver.` };
    case "pago":
      return { title: "Pagamento recebido", body: `A CLYON recebeu o pagamento do pedido #${id}.` };
    case "preco_clyon":
      return { title: "O preço do seu pedido", body: `A CLYON enviou o preço do pedido #${id}. Toque para ver e responder.` };
    case "dia_pela_clyon": {
      const dia = quandoEmLisboa(d.dia ?? null);
      return dia
        ? { title: "Dia combinado", body: `Dia combinado para o pedido #${id}: ${dia}.` }
        : { title: "O dia mudou", body: `O dia do trabalho do pedido #${id} foi desmarcado. A CLYON combina outro consigo.` };
    }
    case "editado":
      return { title: "O seu pedido foi actualizado", body: `A CLYON actualizou o pedido #${id}. Toque para ver.` };
    case "tipo":
      return { title: "Preço fechado pela CLYON", body: `O pedido #${id} passou a ter preço fechado pela CLYON. O valor chega aqui.` };
    case "enviado":
      return { title: "Pedido enviado", body: `O pedido #${id} foi enviado aos parceiros da sua zona. As propostas chegam aqui.` };
    case "preco_mudou":
      return { title: "O preço mudou", body: `O preço do pedido #${id} mudou. Toque para ver.` };
    case "ajuste_respondido":
      return { title: "Ajuste respondido", body: `A CLYON respondeu ao ajuste do valor do pedido #${id}. Toque para ver.` };
    case "proposta_pela_clyon":
      return { title: "Resposta a uma proposta", body: `A CLYON respondeu a uma proposta do pedido #${id} em seu nome. Toque para ver.` };
    case "reaberto":
      return { title: "Pedido reaberto", body: `O pedido #${id} voltou a estar aberto. Toque para ver.` };
    case "trocado":
      return { title: "Mudou o parceiro", body: `O parceiro do pedido #${id} mudou. Toque para ver quem faz o trabalho.` };
    case "alteracao_aplicada":
      return { title: "Alteração aplicada", body: `A alteração ao pedido #${id} foi aplicada.` };
    case "alteracao_recusada":
      return { title: "Alteração não aplicada", body: `A CLYON não aplicou a alteração ao pedido #${id}. Toque para ver porquê.` };
    case "detalhes":
      return {
        title: `Mais detalhes sobre o pedido #${id}`,
        body: "A CLYON precisa de mais detalhes para enviar o pedido aos parceiros. Toque para responder.",
      };
    case "mensagem":
      return { title: `Mensagem da CLYON`, body: `A CLYON respondeu sobre o pedido #${id}. Toque para ler.` };
    case "cancelado": {
      const motivo = (d.motivo ?? "").trim();
      return { title: "Pedido cancelado", body: `O pedido #${id} foi cancelado.${motivo ? ` ${motivo}` : ""}` };
    }
    case "escolhido":
      return { title: "Quem faz o trabalho", body: `${d.nome?.trim() || "Um parceiro verificado"} vai fazer o trabalho do pedido #${id}.` };
  }
}

function ligacao(caminho: string): string {
  try {
    return new URL(caminho, urlDeAccao()).toString();
  } catch {
    return caminho;
  }
}

/**
 * AVISA O CLIENTE DE UM PEDIDO — pelo email do pedido (sem email, não há
 * conta nem app a avisar). Nunca lança.
 */
export async function avisarOClienteDoPedido(
  pedidoId: number,
  tipo: TipoDeAvisoAoCliente,
  extra: { nome?: string | null; dia?: Date | string | null; negociacaoId?: number | null; motivo?: string | null } = {},
): Promise<void> {
  try {
    const { getSimulatorOrderById, negociacoesDoPedido } = await import("./db");
    const pedido = await getSimulatorOrderById(pedidoId);
    const email = (pedido?.contactEmail ?? "").trim().toLowerCase();
    if (!pedido || !email) return;
    const trabalhoClyon = pedido.valorFixoClyon != null;
    if (trabalhoClyon && !NUM_TRABALHO_CLYON.has(tipo)) return;

    /*
     * O DINHEIRO DO PROFISSIONAL NÃO É AVISO DO CLIENTE (d10): em dinheiro com
     * IVA incluído, a referência e o «pago» são a dívida dele à CLYON.
     */
    if ((tipo === "referencia" || tipo === "pago") && extra.negociacaoId) {
      const [{ temDividaDoProfissional }, { lerForma }, { modeloDaLinha }] = await Promise.all([
        import("./divida-do-profissional"),
        import("./forma-de-pagamento"),
        import("./sem-factura"),
      ]);
      const n = (await negociacoesDoPedido(pedidoId)).find((x) => x.id === extra.negociacaoId);
      if (!n) return;
      if (temDividaDoProfissional(lerForma(n.formaDePagamento), modeloDaLinha(n, n.createdAt))) return;
    }

    const aviso = avisoAoCliente(tipo, { pedidoId, nome: extra.nome, dia: extra.dia, motivo: extra.motivo });
    await sendPushToUser(
      email,
      {
        title: aviso.title,
        body: aviso.body,
        url: ligacao("/conta"),
        tag: `${tipo}-${pedidoId}`,
        pedidoId,
        tipo,
        negociacaoId: extra.negociacaoId ?? undefined,
      },
      "cliente",
    );
  } catch (err) {
    console.error("[avisos-ao-cliente]", tipo, err instanceof Error ? err.message : err);
  }
}
