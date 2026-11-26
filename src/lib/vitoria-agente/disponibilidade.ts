/**
 * AS DATAS PERGUNTADAS A TODOS OS PARCEIROS — d136 (26-11-2026). PURO.
 *
 * *«E datas para executar o serviço?»*, *«esta semana termina amanhã, ainda
 * assim conseguem?»* — o cliente pergunta pela data ANTES de escolher, e a
 * Vitória respondia «depende de cada parceiro, escolha primeiro». Agora a
 * pergunta da d97 sai logo para os parceiros com proposta aberta no pedido
 * (até 4), e o cliente lê «Vou perguntar já aos parceiros e digo-lhe quem pode
 * e quando.». Quando todos responderam — ou ao fim de 2 h, contadas na janela
 * de contacto —, a Vitória diz-lhe numa mensagem curta quem pode e quando, e pergunta
 * qual prefere. O dia que ele escolher fica gravado no fecho (d131).
 *
 * O mesmo canal, o mesmo registo (`vitoriaPerguntasAoParceiro`, com a
 * `ronda`), o mesmo histórico e a mesma Mesa da d97.
 */

import { JANELA_DE_CONTACTO } from "../janela-de-contacto";
import { lerARespostaDoParceiro, quandoNaResposta } from "./pergunta-ao-parceiro";
import { diaCombinadoNaCondicao, type DiaCombinado } from "./dia-combinado";

/** Quantos parceiros, no máximo, numa ronda. */
export const PARCEIROS_POR_RONDA = 4;
/**
 * As 2 h da ronda contam na janela de contacto (d7) — a mesma da d97. O CEO
 * pediu uma janela mais larga; a janela única do dono (`janela-de-contacto.ts`) manda, e o
 * teste dela chumba outra.
 */
export const JANELA_DA_RONDA = JANELA_DE_CONTACTO;

/** O que a Vitória diz ao cliente, tal e qual, quando a pergunta sai. */
export const VOU_PERGUNTAR_AOS_PARCEIROS = "Vou perguntar já aos parceiros e digo-lhe quem pode e quando.";

const limpo = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, " ").trim().replace(/[?.!]+$/, "");

/** A identificação da ronda: o pedido e o instante em que saiu. */
export function rondaDe(pedidoId: number, propostoEm: string): string {
  return `${pedidoId}@${propostoEm}`.slice(0, 60);
}

/**
 * A MENSAGEM AO PARCEIRO: «O cliente do pedido #N pergunta se consegue amanhã
 * (sexta) ou sábado. Consegue? Responda com o dia que pode.» Sem o dia dito,
 * pergunta-se quando pode.
 */
export function mensagemDeDisponibilidade(pedidoId: number, quando: string | null | undefined): string {
  const q = limpo(quando).slice(0, 160);
  return q
    ? `O cliente do pedido #${pedidoId} pergunta se consegue ${q}. Consegue? Responda com o dia que pode.`
    : `O cliente do pedido #${pedidoId} pergunta quando pode fazer o serviço. Responda com o dia que pode.`;
}

/** A mensagem da ronda reconhece-se pelo texto: o n.º do pedido, ou null. */
export function pedidoDaPerguntaDeDisponibilidade(texto: string | null | undefined): number | null {
  const t = String(texto ?? "");
  if (!/pergunta (?:se consegue|quando pode)/i.test(t) || !/Responda com o dia que pode/i.test(t)) return null;
  const m = t.match(/pedido #(\d{1,9})/);
  return m ? Number(m[1]) : null;
}

/**
 * O QUE O PARCEIRO DISSE, EM POUCAS PALAVRAS — para a mensagem ao cliente.
 * Só o dia e a hora (nunca o texto dele tal e qual: pode trazer um valor ou um
 * contacto). Sem resposta: «(sem resposta)».
 */
export function oQueOParceiroDisse(resposta: string | null | undefined): string {
  if (resposta == null) return "(sem resposta)";
  const quando = quandoNaResposta(resposta);
  const l = lerARespostaDoParceiro(resposta);
  if (l.tipo === "nao" && !quando) return "não consegue";
  if (quando) return quando;
  if (l.tipo === "sim") return "consegue";
  return "(resposta por confirmar)";
}

export type RespostaNaRonda = { parceiro: string; resposta: string | null };

/**
 * A MENSAGEM AO CLIENTE: «Já perguntei aos parceiros do pedido #N: X: amanhã
 * de manhã · Y: sábado · Z: (sem resposta). Qual prefere?» Ninguém com dia:
 * diz-se, e pergunta-se se quer escolher mesmo assim ou outro dia.
 */
export function respostaAoClienteDaRonda(pedidoId: number, respostas: readonly RespostaNaRonda[]): string {
  const linhas = respostas.map((r) => `${limpo(r.parceiro)}: ${oQueOParceiroDisse(r.resposta)}`);
  const algum = respostas.some((r) => {
    const d = oQueOParceiroDisse(r.resposta);
    return d !== "(sem resposta)" && d !== "não consegue" && d !== "(resposta por confirmar)";
  });
  const fim = algum
    ? "Qual prefere?"
    : "Por agora nenhum confirmou essa data. Quer escolher uma das propostas mesmo assim, ou prefere outro dia?";
  return `Já perguntei aos parceiros do pedido #${pedidoId}: ${linhas.join(" · ")}. ${fim}`;
}

/** O dia que o parceiro ofereceu, lido no instante em que respondeu (o «amanhã» dele é o de então). */
export function diaOferecido(resposta: string | null | undefined, respondidoEm: Date): DiaCombinado | null {
  const q = quandoNaResposta(resposta);
  return q ? diaCombinadoNaCondicao(q, null, respondidoEm) : null;
}

/**
 * O DIA DA ESCOLHA: se o cliente, ao escolher, disse o dia («a do X, no
 * sábado»), é esse; senão, o que o parceiro escolhido ofereceu (se ainda está
 * para vir). Nenhum: null — o fecho sai como sempre.
 */
export function diaDaEscolha(textoDoCliente: string | null | undefined, oferecido: DiaCombinado | null, agora: Date): DiaCombinado | null {
  const doCliente = diaCombinadoNaCondicao(textoDoCliente, null, agora);
  if (doCliente) return doCliente;
  if (oferecido && new Date(oferecido.em).getTime() > agora.getTime()) return oferecido;
  return null;
}
