import { DIAS_DE_RETENCAO_DOS_PEDIDOS } from "@/lib/retencao";

/**
 * OS PEDIDOS QUE FICARAM PARA TRÁS DE QUEM CHEGOU DEPOIS.
 *
 * "Os trabalhos colocados antes da conta ser criada continua a não aparecer
 * para eles mas devia. O Revolution por ex só recebeu 1 trabalho mas cumpre
 * todos os requisitos para receber todos." — 14-09-2026.
 *
 * A distribuição corre UMA VEZ, no instante em que o pedido é promovido, e
 * nunca mais. Quem se inscreve depois nasce para um mercado vazio: os pedidos
 * abertos existem, ele cumpre os requisitos deles, e não os vê — não porque
 * alguma regra o exclua, mas porque ninguém voltou a perguntar.
 *
 * O painel já sabia disto e dizia-o em voz alta. No #316: «4 profissionais · 1
 * proposta» e, ao lado, «Hoje chegaria a 5 de 9». O quinto era o Revolution.
 * O sistema tinha a resposta escrita no ecrã e não agia sobre ela.
 *
 * A DISTRIBUIÇÃO PASSA A SER UMA CONTA QUE SE REFAZ, e não um disparo. Não é
 * preciso apanhar o evento certo — conta nova, aprovação, raio corrigido,
 * categoria acrescentada, coordenadas que só apareceram à segunda: qualquer
 * uma delas muda quem é elegível, e todas ficam cobertas por voltar a
 * perguntar. Apanhar eventos um a um seria esquecer-se de um.
 *
 * `distribuirPedido` já é seguro de repetir: quem tem negociação é saltado, e
 * quem não é elegível não entra. Faltava alguém a chamá-la outra vez.
 */

/**
 * Até quando vale a pena ressuscitar um pedido.
 *
 * É o prazo da retenção porque depois dele o pedido já nem existe: a purga
 * apaga-o. Um limite mais curto seria uma segunda regra a decidir o que está
 * vivo, a discordar da primeira no dia em que uma das duas mudasse.
 */
export const DIAS_PARA_ALCANCAR = DIAS_DE_RETENCAO_DOS_PEDIDOS;

/**
 * Quantas negociações uma passagem pode criar.
 *
 * Cada uma é um email no telemóvel de um profissional. Sem tecto, o dia em que
 * isto ligar pela primeira vez — ou o dia em que alguém alargar um raio para
 * 300 km — despeja a mesa inteira em cima de toda a gente de uma vez. O que
 * sobra fica para a passagem seguinte, e a passagem diz quanto sobrou: um
 * limite silencioso lê-se como «estava tudo feito».
 */
export const NOVAS_POR_PASSAGEM = 120;

export type PedidoParaAlcancar = {
  id: number;
  status: string | null;
  /** Já há alguém contratado neste pedido. */
  temAcordo: boolean;
  criadoEm: Date | string;
};

const ARRUMADOS = ["cancelado", "concluido", "arquivado"];

/**
 * Este pedido ainda merece chegar a mais alguém?
 *
 * É a mesma definição de «aberto» que a mesa usa, e de propósito: se o dono o
 * vê na mesa à espera de propostas, ele está aberto. Uma segunda definição
 * acabaria com o ecrã a dizer uma coisa e a distribuição a fazer outra.
 */
export function aindaValeAPenaAlcancar(
  p: PedidoParaAlcancar,
  agora: Date,
  dias: number = DIAS_PARA_ALCANCAR,
): boolean {
  if (p.status != null && ARRUMADOS.includes(p.status)) return false;

  /*
   * UM PEDIDO FECHADO NÃO SE MANDA A MAIS NINGUÉM.
   *
   * Depois de o cliente contratar, o trabalho é de alguém. Mandá-lo a um
   * profissional novo seria pô-lo a orçamentar uma coisa que já não está à
   * venda — e a fazer-lhe perder a manhã.
   */
  if (p.temAcordo) return false;

  const nasceu = p.criadoEm instanceof Date ? p.criadoEm : new Date(p.criadoEm);
  if (Number.isNaN(nasceu.getTime())) return false;
  const idadeEmDias = (agora.getTime() - nasceu.getTime()) / 86_400_000;
  return idadeEmDias <= dias;
}

/** O que a passagem fez, em números. */
export type ResultadoDoAlcance = {
  /** Pedidos olhados. */
  vistos: number;
  /** Negociações criadas — trabalho que chegou a quem não o tinha. */
  novas: number;
  /** Pedidos onde alguma coisa chegou a alguém. */
  pedidosComNovidade: number;
  /** Ficaram por olhar por causa do tecto. */
  porOlhar: number;
  falhados: number;
};

/** O resumo em palavras, para o registo e para quem o lê no painel. */
export function resumoDoAlcance(r: ResultadoDoAlcance): string {
  if (r.novas === 0) {
    return `${r.vistos} pedido(s) abertos revistos — ninguém novo era elegível.`;
  }
  return (
    `${r.novas} negociação(ões) nova(s) em ${r.pedidosComNovidade} pedido(s), ` +
    `de ${r.vistos} revistos.` +
    (r.porOlhar > 0 ? ` Ficaram ${r.porOlhar} para a passagem seguinte (tecto da passagem).` : "") +
    (r.falhados > 0 ? ` ${r.falhados} falharam.` : "")
  );
}
