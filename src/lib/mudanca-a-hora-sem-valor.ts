/**
 * A MUDANÇA À HORA SEM O VALOR ENVIADO, ÀS 3 H — d14 (CEO e dono, 27-11-2026).
 *
 * Um pedido de mudança à hora a que ninguém mandou o valor (`propostaEnviadaEm`
 * vazio) e que está aberto há 3 horas ou mais passa a ter selo na Mesa («Do
 * nosso lado»), com um texto-modelo para a equipa mandar o valor. Só diz o que
 * falta: nada sai sozinho para o cliente. O preço não se decide aqui — o texto
 * lê a referência da tabela das mudanças (`tabela-das-mudancas.ts`).
 *
 * PURO: quem chama dá a lista e o relógio. O relógio é o instante (3 h são 3 h
 * em qualquer fuso); a hora escrita é a de Lisboa. A leitura da base está em
 * `mudanca-a-hora-sem-valor-na-base.ts`.
 */

import { lerBase } from "./base-do-preco";
import { instanteDaBase } from "./hora-de-lisboa";
import { pedidoFechado } from "./pedido-arrumado";
import { MINIMO_DE_HORAS, PESSOAS_NA_EQUIPA, PRECO_POR_HORA } from "./tabela-das-mudancas";
import { TAXA_IVA } from "./taxas-plataforma";

/** Passadas estas horas sem o valor enviado, o pedido pede a equipa. */
export const HORAS_ATE_O_SELO_DA_MUDANCA = 3;

export type PedidoDeMudancaParaOSelo = {
  id: number;
  serviceType: string | null | undefined;
  baseDoPreco: string | null | undefined;
  status: string | null | undefined;
  /** Quando o valor foi ao cliente — vazio = ainda não foi. */
  propostaEnviadaEm: string | Date | null | undefined;
  /** Quando o pedido entrou (da base, em UTC). */
  createdAt: string | Date | null | undefined;
};

export type MudancaSemValor = { pedidoId: number; desde: Date; esperaS: number };

/**
 * Este pedido pede o selo? Mudança, à hora, aberta, sem valor enviado e com 3 h
 * ou mais desde que entrou. `null` quando não.
 */
export function mudancaAHoraSemValor(p: PedidoDeMudancaParaOSelo, agora: Date): MudancaSemValor | null {
  if (p.serviceType !== "mudanca") return null;
  if (lerBase(p.baseDoPreco) !== "hora") return null;
  if (pedidoFechado(p.status)) return null;
  if (instanteDaBase(p.propostaEnviadaEm ?? null)) return null;
  const desde = instanteDaBase(p.createdAt ?? null);
  if (!desde) return null;
  const esperaS = Math.floor((agora.getTime() - desde.getTime()) / 1000);
  if (esperaS < HORAS_ATE_O_SELO_DA_MUDANCA * 3600) return null;
  return { pedidoId: p.id, desde, esperaS };
}

/** O que a rota da Mesa devolve — só o n.º do pedido e a data de entrada. */
export type MudancaSemValorParaOLado = { pedidoId: number; desde: string };

const euros = (v: number) => `${String(Math.round(v * 100) / 100).replace(".", ",")} €`;

/**
 * O texto-modelo para a equipa mandar o valor: de pessoa, a falar de um
 * parceiro da zona (nunca da CLYON a fazer o trabalho), com o preço sempre
 * com o IVA ao lado e sem promessas de data. A equipa muda o valor se o do
 * parceiro for outro e põe o nome onde está «[nome]».
 */
export function textoModeloDoValorDaMudanca(pedidoId: number): string {
  const ref = PRECO_POR_HORA;
  const refComIva = ref * (1 + TAXA_IVA);
  return (
    `Olá, [nome]. Sobre o seu pedido #${pedidoId}: a mudança faz-se à hora, com uma equipa de ${PESSOAS_NA_EQUIPA} pessoas ` +
    `de um parceiro da zona, e o mínimo são ${MINIMO_DE_HORAS} horas. ` +
    `O valor é de ${euros(ref)} + IVA por hora (${euros(refComIva)} com IVA) e paga-se só as horas feitas. ` +
    `Se lhe servir, diga-nos a data que prefere e confirmamos o parceiro.`
  );
}

/** A linha do selo, em poucas palavras. */
export const O_QUE_DA_MUDANCA_SEM_VALOR = `mudança à hora sem o valor enviado há mais de ${HORAS_ATE_O_SELO_DA_MUDANCA} h — mande o valor ao cliente`;
