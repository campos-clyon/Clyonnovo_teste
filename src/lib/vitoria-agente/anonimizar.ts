/**
 * A CONVERSA SEM DADOS DE PESSOAS — d85, fase 0. PURO.
 *
 * O que vai para o modelo no ensaio e no script de medição: sem nomes, sem
 * telefones, sem emails, sem NIF nem IBAN, sem códigos postais e sem a rua.
 * Os contactos e os códigos postais ficam marcados («[contacto recebido]»,
 * «[código postal recebido]») para o modelo saber que foram dados; o nome e a rua do pedido
 * saem por `semDadosPessoais`, a mesma guarda da descrição do pedido.
 */

import { semDadosPessoais } from "../descricao-pelo-modelo";

/** Telefones, NIF, IBAN e números compridos; emails; endereços na internet. */
const CONTACTO = /(?:\+|00)?\d(?:[\s.-]?\d){8,}|\S+@\S+\.\S+|\bhttps?:\/\/\S+|\bwww\.\S+/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:[\s]?[A-Z0-9]{4}){3,8}\b/g;
// Com o hífen, com espaços à volta dele, ou só com um espaço («2800 - 123», «2800 123»); nunca um valor em euros.
const CODIGO_POSTAL = /(?<!\d)\d{4}(?:\s?-\s?|\s)\d{3}(?![\d,.]?\d)(?!\s?€)/g;

/**
 * d92 (23-11-2026, conversa …366): a marca antiga «[código postal]» fez o agente
 * pedir outra vez o código postal («chegou-me sem os números»). A marca diz que
 * o dado foi DADO e ficou recebido — o agente nunca o volta a pedir; o que está
 * no pedido vê-se em ler_pedido (temCodigoPostal, temMorada) e o_que_falta.
 */
export const MARCA_DO_CODIGO_POSTAL = "[código postal recebido]";
export const MARCA_DO_CONTACTO = "[contacto recebido]";

/** O que se sabe de quem escreve, para lhe tirar o nome e a rua. */
export type QuemEscreve = { contactName?: string | null; address?: string | null };

/** Um texto sem dados de pessoas. */
export function textoAnonimizado(texto: string, quem: readonly QuemEscreve[] = []): string {
  let t = String(texto ?? "")
    .replace(IBAN, MARCA_DO_CONTACTO)
    .replace(CONTACTO, MARCA_DO_CONTACTO)
    .replace(CODIGO_POSTAL, MARCA_DO_CODIGO_POSTAL);
  for (const q of quem) t = semDadosPessoais(t, { contactName: q.contactName ?? null, address: q.address ?? null });
  return t;
}

export type LinhaDaConversa = { direccao: string; texto: string; criadoEm?: string | null };

/** A conversa inteira, linha a linha, sem dados de pessoas. */
export function conversaAnonimizada<T extends LinhaDaConversa>(linhas: readonly T[], quem: readonly QuemEscreve[] = []): T[] {
  return linhas.map((l) => ({ ...l, texto: textoAnonimizado(l.texto, quem) }));
}

/** Só os últimos dígitos de um telefone, para mostrar. */
export function ultimosDigitos(telefone: string | null | undefined, quantos = 3): string {
  const d = String(telefone ?? "").replace(/\D/g, "");
  return d.length > quantos ? `…${d.slice(-quantos)}` : "…";
}
