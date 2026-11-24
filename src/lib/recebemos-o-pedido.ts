/**
 * «RECEBEMOS O SEU PEDIDO #N» — d102 (d) (CEO e dono, 24-11-2026).
 *
 * Quem faz o pedido no simulador ou no formulário da página inicial, com
 * telemóvel português, recebe da Vitória pelo WhatsApp UMA mensagem: que o
 * pedido chegou e, se faltar alguma coisa, já o que falta — o mesmo texto do
 * «Pedir o que falta» da d88 (`mensagemDoQueFalta`), que passa a contar como a
 * 1.ª do ciclo dos lembretes (a 2.ª sai no dia seguinte, como sempre): o
 * lembrete dos 30 minutos não sai outra vez.
 *
 * Das 9h às 20h de Lisboa; fora disso fica à espera e sai às 9h. Nunca a quem
 * está em «não contactar», nem a um número bloqueado, nem a uma conversa
 * entregue a uma pessoa da equipa. Não conta para a regra de uma mensagem
 * automática por dia: é a resposta ao pedido que ele acabou de fazer.
 *
 * PURO. A base está em `recebemos-o-pedido-na-base.ts`.
 */

import { JANELA_DE_CONTACTO, naJanelaDeContacto } from "./janela-de-contacto";

/** A janela do «recebemos»: a de contacto; fora dela, às 9h. */
export const JANELA_DO_RECEBIDO = { das: JANELA_DE_CONTACTO.abre, as: JANELA_DE_CONTACTO.fecha } as const;

export function naJanelaDoRecebido(agora: Date): boolean {
  return naJanelaDeContacto(agora);
}

/** Depois de quantas horas um «recebemos» que ficou à espera já não faz sentido (a manhã seguinte cabe). */
export const HORAS_ATE_O_RECEBIDO_PERDER_A_VEZ = 14;

/** O que se envia. Com o «Pedir o que falta», a frase dele abre por «Recebemos». Pura. */
export function textoDoRecebido(pedidoId: number, oQueFalta: string | null | undefined): string {
  const falta = (oQueFalta ?? "").trim();
  if (!falta) return `Recebemos o seu pedido #${pedidoId}. Assim que houver novidades, digo-lhe por aqui.`;
  const re = new RegExp(`O seu pedido (#${pedidoId}(?: \\([^)]*\\))?) está quase pronto`);
  if (re.test(falta)) return falta.replace(re, "Recebemos o seu pedido $1. Está quase pronto");
  return `Recebemos o seu pedido #${pedidoId}.\n\n${falta}`;
}

export type SituacaoDoRecebido = {
  /** O telemóvel português (351…), ou null. */
  telemovel: string | null;
  naoContactar: boolean;
  bloqueado: boolean;
  comUmaPessoa: boolean;
  /** Já há linha deste pedido (enviado, a enviar, ou à espera). */
  jaTratado: boolean;
};

export type DecisaoDoRecebido = { tipo: "sai" } | { tipo: "espera" } | { tipo: "nao"; porque: string };

/** Sai agora, espera pelas 9h, ou não sai. Pura. */
export function decidirORecebido(s: SituacaoDoRecebido, agora: Date): DecisaoDoRecebido {
  if (s.jaTratado) return { tipo: "nao", porque: "já tratado" };
  if (!s.telemovel) return { tipo: "nao", porque: "sem telemóvel português" };
  if (s.naoContactar) return { tipo: "nao", porque: "não contactar" };
  if (s.bloqueado) return { tipo: "nao", porque: "o número está bloqueado" };
  if (s.comUmaPessoa) return { tipo: "nao", porque: "a conversa está com uma pessoa da equipa" };
  return naJanelaDoRecebido(agora) ? { tipo: "sai" } : { tipo: "espera" };
}
