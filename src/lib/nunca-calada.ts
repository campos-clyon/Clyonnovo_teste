import { jaFoiDito, MINUTOS_SEM_REPETIR_A_MESMA, type SaidaGravada } from "./nao-repetir";
import { paraTeclado } from "./whatsapp-cloud";
import { soPedeOPreco } from "./orcamento-a-meio";
import type { PassoDaRecolha, RespostaDaRecolha } from "./whatsapp-recolha";

/*
 * A VITÓRIA NUNCA FICA CALADA — 16-11-2026 (decisão d48).
 *
 *   10:52  CLIENTE: Orçamento
 *   10:53  VITÓRIA: Peço desculpa, não apanhei bem. Qual é a morada…
 *   10:53  CLIENTE: Orçamento
 *          (nada — a resposta era a mesma frase, e o envio engoliu-a)
 *
 * O envio cala uma mensagem igual a outra dos últimos 10 minutos
 * (`jaFoiDito`, em `enviarTextoWhatsApp`): é a rede contra o «Qual é a
 * morada?» três vezes seguidas. Mas calar só é certo quando a mensagem dele
 * tem outra resposta a caminho; quando a Vitória não tem mais nada a dizer, o
 * silêncio deixa um cliente sem resposta. Por isso, ANTES de enviar: se o que
 * ia sair já saiu há pouco (ou não ia sair nada), a conversa passa a uma
 * pessoa, com o motivo, e ele ouve com delicadeza que um colega responde já.
 *
 * A regra: nenhum turno do cliente fica sem resposta nem sem passagem à
 * equipa. Puro: chama-o a recolha do WhatsApp, e os testes.
 */

export const UM_COLEGA_RESPONDE =
  "Peço desculpa, não o quero fazer repetir. Vou passar a nossa conversa a um colega da CLYON, que lhe responde já por aqui.";

const PERGUNTAS: Partial<Record<PassoDaRecolha, string>> = {
  servico: "o serviço",
  nome: "o nome",
  morada: "a morada",
  codigoPostal: "o código postal",
  moradaDestino: "a morada do destino",
  codigoPostalDestino: "o código postal do destino",
  andar: "o andar",
  elevador: "o elevador",
  estacionamento: "o estacionamento",
  andarDestino: "o andar no destino",
  elevadorDestino: "o elevador no destino",
  estacionamentoDestino: "o estacionamento no destino",
  entulhoQuantidade: "a quantidade de entulho",
  quando: "a data",
  descricao: "o que é para levar",
  fatura: "a fatura",
  nif: "o NIF",
  confirmar: "o resumo",
};

/** Porque passou à equipa — o que o painel mostra. Sem as palavras dele (os registos não são sítio para isso). */
export function motivoDoSilencio(passo: PassoDaRecolha, texto: string): string {
  if (soPedeOPreco(texto)) {
    return passo === "morada" || passo === "codigoPostal"
      ? "Cliente pede orçamento sem morada — a Vitória não conseguiu avançar; responder"
      : "Cliente pede orçamento — a Vitória não conseguiu avançar; responder";
  }
  return `A Vitória não percebeu a resposta (${PERGUNTAS[passo] ?? passo}) depois de reformular — responder`;
}

/**
 * A resposta, ou — se ela ia ser engolida por repetida, ou não ia sair nada —
 * a passagem a uma pessoa. O que regista, desiste ou já passa a uma pessoa
 * segue como está.
 */
export function semFicarCalada(
  r: RespostaDaRecolha,
  fio: SaidaGravada[] | null | undefined,
  agora: Date,
  contexto: { passo: PassoDaRecolha; texto: string },
): RespostaDaRecolha {
  if (r.registar || r.desistir || r.pedirPessoa) return r;
  const vazia = !r.resposta.trim();
  const repetida =
    !vazia && jaFoiDito(paraTeclado(r.resposta), Array.isArray(fio) ? fio : [], agora, MINUTOS_SEM_REPETIR_A_MESMA / 60);
  if (!vazia && !repetida) return r;
  return {
    ...r,
    pedirPessoa: true,
    motivoDaEntrega: motivoDoSilencio(contexto.passo, contexto.texto),
    resposta: UM_COLEGA_RESPONDE,
  };
}
