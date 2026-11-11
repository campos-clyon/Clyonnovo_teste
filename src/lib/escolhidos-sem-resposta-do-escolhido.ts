import { diaEmLisboa } from "./hora-de-lisboa";
import { formatarEuros } from "./formatar-euros";
import { diaEMes as diaMes, horaEMinutos as hm, propostasDoProfissional } from "./escolhidos-sem-resposta-regra";

/**
 * OS ESCOLHIDOS SEM RESPOSTA — O QUE O ESCOLHIDO LÊ (d6, 11-11-2026).
 *
 * No painel do profissional e na app Pro: «Confirmo: faço por X/h + IVA» em
 * vez do formulário, «Propor um valor mais baixo», o prazo depois de
 * terminado e os erros da confirmação. Fala COM o profissional; o que o
 * cliente lê está em `escolhidos-sem-resposta.ts`, que é também a porta por
 * onde isto se importa.
 */

const eur = (cent: number) => formatarEuros(cent / 100);

/* ══ D. O ESCOLHIDO — painel do parceiro e app Pro ═══════════════════════ */

/** A acção da rota da negociação: a hora congelada, confirmada num só pedido. */
export const ACCAO_DE_CONFIRMAR_A_HORA = "confirmar_hora";

export const TEXTOS_DO_ESCOLHIDO = Object.freeze({
  proporMaisBaixo: "Propor um valor mais baixo",
  naoEstouInteressado: "Não estou interessado",
  rotuloDoValor: "Valor por hora, sem IVA",
  enviarProposta: "Enviar proposta",
  voltar: "Voltar",
  /** D4, na lista de pedidos, depois do prazo. */
  prazoTerminado: "Prazo terminado",
});

/** D1. «Confirmo: faço por 40,00 €/h + IVA» */
export const botaoConfirmo = (horaCent: number) => `Confirmo: faço por ${eur(horaCent)}/h + IVA`;

/** D3. A regra por baixo do campo de «Propor um valor mais baixo». */
export const regraDoValorMaisBaixo = (horaCent: number) =>
  `Escreva um valor por hora abaixo da sua hora (${eur(horaCent)} sem IVA). Para ficar na sua hora, volte atrás e confirme.`;

const comIva = (cent: number, iva: number) => cent + Math.round(cent * iva);

/** D2. Depois de confirmar (a variante tardia quando confirmou depois do prazo). */
export function textoDepoisDeConfirmar(horaCent: number, iva: number, depoisDoPrazo: boolean): string {
  const valores = `${eur(horaCent)}/h + IVA (${eur(comIva(horaCent, iva))}/h com IVA)`;
  return depoisDoPrazo
    ? `Confirmou depois do prazo: ${valores}. O cliente já tinha sido avisado de que não havia resposta; recebe agora a sua confirmação.`
    : `Confirmou: ${valores}. O cliente está a escolher — avisamos assim que decidir.`;
}

/** D3. Depois de enviar um valor mais baixo. */
export const textoDaPropostaMaisBaixa = (valorCent: number, iva: number) =>
  `A sua proposta de ${eur(valorCent)}/h + IVA (${eur(comIva(valorCent, iva))}/h com IVA) está com o cliente. Avisamos quando ele responder.`;

/** D4. O prazo, depois de terminado e sem resposta dele. */
export function textoDoPrazoTerminado(prazo: Date, agora: Date = new Date()): string {
  const quando = diaEmLisboa(prazo) === diaEmLisboa(agora) ? `às ${hm(prazo)}` : `a ${diaMes(prazo)} às ${hm(prazo)}`;
  return `O prazo terminou ${quando}. Ainda pode responder, mas o cliente já foi avisado.`;
}

/** D5. Os erros da confirmação. */
export const ERROS_DO_ESCOLHIDO = Object.freeze({
  contratouOutro: "O cliente já escolheu outro profissional para esta mudança. Este pedido fechou para si.",
  cancelado: "O cliente cancelou este pedido.",
  fechado: "Este pedido já fechou. Já não pode responder.",
  jaConfirmou: "Já confirmou este pedido. A sua resposta está com o cliente.",
  disseQueNao: "Disse que não estava interessado neste pedido. Já não pode confirmar.",
  rede: "Não foi possível enviar a confirmação. Verifique a ligação e tente outra vez.",
  semHora: "Este pedido não tem uma hora guardada para confirmar.",
});

/**
 * PODE CONFIRMAR? Null quando pode; senão, a frase de D5 e se os botões saem.
 * «Fora do prazo» não é erro: depois do prazo ainda se confirma.
 */
export function erroDaConfirmacao(d: {
  estado: string | null | undefined;
  propostasJson: string | null | undefined;
  /** O estado do pedido (`cancelado`, `arquivado`, …). */
  estadoDoPedido: string | null | undefined;
  pedidoFechado: boolean;
}): { erro: string; semBotoes: boolean } | null {
  if (d.estadoDoPedido === "cancelado") return { erro: ERROS_DO_ESCOLHIDO.cancelado, semBotoes: true };
  if (d.estado === "morta") return { erro: ERROS_DO_ESCOLHIDO.contratouOutro, semBotoes: true };
  if (d.pedidoFechado) return { erro: ERROS_DO_ESCOLHIDO.fechado, semBotoes: true };
  if (d.estado === "desistida") return { erro: ERROS_DO_ESCOLHIDO.disseQueNao, semBotoes: false };
  if (d.estado !== "aberta") return { erro: ERROS_DO_ESCOLHIDO.jaConfirmou, semBotoes: false };
  if (propostasDoProfissional(d.propostasJson) > 0) return { erro: ERROS_DO_ESCOLHIDO.jaConfirmou, semBotoes: false };
  return null;
}
