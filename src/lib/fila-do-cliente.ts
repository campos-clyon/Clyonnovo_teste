/**
 * AS MENSAGENS AO CLIENTE TÊM PRAZO NA FILA — 27-10-2026 (decisão d7).
 *
 * A ponte vem buscar a fila de poucos em poucos segundos. Se ela parar umas
 * horas (Railway em baixo, telemóvel desemparelhado), tudo o que ficou para
 * trás saía de rajada quando voltasse — respostas velhas, fora de contexto, à
 * noite, e todas do mesmo número (o padrão que faz a Meta banir um número).
 * Os avisos ao profissional já tinham 24 h de validade; as do cliente não
 * tinham nenhuma.
 *
 * A REGRA, pura (o «teste da conversa» corre-a sem base):
 *
 *   · mais de 2 h na fila → «atrasada»: não sai sozinha. Fica na Mesa das
 *     conversas, com selo, para a equipa decidir — enviar ou descartar;
 *   · fora da hora de falar (21h–9h de Lisboa) → espera, a não ser que o
 *     cliente esteja a falar AGORA (escreveu há menos de meia hora): a
 *     Vitória continua a responder a quem lhe escreve de noite, mas nada
 *     que ficou para trás sai sozinho a essa hora;
 *   · a equipa carregou em «Enviar» → sai (a decisão foi de uma pessoa).
 *
 * `db.ts` (`filaWhatsAppParaAPonte`) lê a idade e a última mensagem do
 * cliente no relógio da base, e pergunta aqui o que fazer a cada linha.
 */
import { horaDeFalar } from "./assistente-interruptores";

/** Duas horas na fila e já não sai sozinha. */
export const PRAZO_DA_FILA_S = 2 * 3600;

/** O cliente escreveu há menos disto: a conversa está viva, e a Vitória responde. */
export const CONVERSA_VIVA_S = 30 * 60;

export type DestinoNaFila = "sai" | "espera" | "atrasada";

export type LinhaDaFila = {
  /** Há quantos segundos entrou na fila (ou foi solta pela equipa). */
  idadeS: number;
  /** A equipa carregou em «Enviar» numa atrasada. */
  soltaPelaEquipa?: boolean;
  /** Há quantos segundos o cliente escreveu pela última vez — `null` = nunca, ou não se sabe. */
  clienteEscreveuHaS: number | null;
};

export function oQueFazerNaFila(linha: LinhaDaFila, agora: Date): DestinoNaFila {
  if (linha.idadeS > PRAZO_DA_FILA_S) return "atrasada";
  if (linha.soltaPelaEquipa) return "sai";
  if (horaDeFalar(agora)) return "sai";
  const viva = linha.clienteEscreveuHaS != null && linha.clienteEscreveuHaS <= CONVERSA_VIVA_S;
  return viva ? "sai" : "espera";
}
