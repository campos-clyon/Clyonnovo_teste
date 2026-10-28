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
  | "chegou"
  | "ajuste"
  | "feito"
  | "feito_sem_fotografias"
  | "confirmado"
  | "referencia"
  | "pago"
  | "preco_clyon"
  | "escolhido";

/** Num Trabalho CLYON a app não mostra a linha do tempo nem o pagamento (v1): só estes. */
const NUM_TRABALHO_CLYON: ReadonlySet<TipoDeAvisoAoCliente> = new Set(["preco_clyon", "escolhido"]);

const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] || "O profissional";

export function avisoAoCliente(
  tipo: TipoDeAvisoAoCliente,
  d: { pedidoId: number; nome?: string | null; dia?: Date | string | null },
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
    case "chegou":
      return { title: `${nome} chegou`, body: `Ao local do trabalho do pedido #${id}.` };
    case "ajuste":
      return { title: `${nome} pediu para mudar o valor`, body: `Pedido #${id}: veja o valor novo e responda.` };
    case "feito":
      return {
        title: "O trabalho está feito",
        body: `${nome} marcou o trabalho do pedido #${id} como feito. Veja as fotografias e confirme.`,
      };
    case "feito_sem_fotografias":
      return {
        title: "O trabalho está feito",
        body: `${nome} marcou o trabalho do pedido #${id} como feito. A CLYON vai confirmar consigo.`,
      };
    case "confirmado":
      return { title: "Trabalho confirmado", body: `O trabalho do pedido #${id} ficou confirmado. Pode avaliar ${nome}.` };
    case "referencia":
      return { title: "Referência de pagamento", body: `A referência do pedido #${id} está pronta. Toque para a ver.` };
    case "pago":
      return { title: "Pagamento recebido", body: `A CLYON recebeu o pagamento do pedido #${id}.` };
    case "preco_clyon":
      return { title: "O preço do seu pedido", body: `A CLYON enviou o preço do pedido #${id}. Toque para ver e responder.` };
    case "escolhido":
      return { title: "Quem faz o trabalho", body: `${d.nome?.trim() || "Um profissional verificado"} vai fazer o trabalho do pedido #${id}.` };
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
  extra: { nome?: string | null; dia?: Date | string | null; negociacaoId?: number | null } = {},
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

    const aviso = avisoAoCliente(tipo, { pedidoId, nome: extra.nome, dia: extra.dia });
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
