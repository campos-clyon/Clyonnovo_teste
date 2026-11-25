/**
 * A VITÓRIA RESPONDE SEMPRE; A EQUIPA PAUSA COM «*» E RETOMA COM «»» —
 * 25-11-2026 (decisão d116). PURO.
 *
 * O dono: «Vamos colocar a Vitória para responder sempre mesmo que alguém
 * envie mensagem. Para pausar a Vitória o admin pode usar um sinal como esse
 * * e para ela continuar ele deve usar esse ». Esses sinais podem estar no
 * meio de mensagens ou sozinhos.»
 *
 * Até aqui, escrever à mão a um cliente (no telemóvel ou pelo backoffice)
 * calava a Vitória nessa conversa: a ponte entregava-a à equipa, e a d73
 * calava-a 12 h depois de qualquer palavra da equipa. Agora:
 *
 *   · uma mensagem da equipa sem sinal não cala nada — a Vitória continua a
 *     responder ao cliente, e lê o que a equipa escreveu como parte da
 *     conversa;
 *   · «*» em qualquer sítio da mensagem → a Vitória fica pausada nessa
 *     conversa (uma entrega a uma pessoa, `MOTIVO_DA_PAUSA`);
 *   · «»» em qualquer sítio → a Vitória retoma (o mesmo que «Devolver ao
 *     site»), também nas conversas entregues por um limite dela;
 *   · os dois na mesma mensagem → vale o que aparece por último.
 *
 * Os sinais só contam nas mensagens da equipa escritas à mão. Nas da Vitória e
 * do sistema (que usam «» nas aspas), nas do cliente e nos envios de modelo da
 * d86 nunca contam — quem chama só passa aqui as da equipa, e o envio de
 * modelo cai fora por `eEnvioDeModelo`.
 *
 * O «»» que fecha umas aspas «…» abertas antes, na mesma mensagem, é uma aspa
 * e não um sinal: o colega que cita «o valor final» não devolve a conversa por
 * engano. O «*» conta sempre (até o negrito do WhatsApp, *assim*): na dúvida,
 * pausa — o lado seguro.
 */
import { eEnvioDeModelo } from "./envio-de-modelo";
import { semMarcaDeMao } from "./rajada-do-whatsapp";
import { COMO_PAUSAR_A_VITORIA, MOTIVO_DA_PAUSA, SINAL_PARA_PAUSAR, SINAL_PARA_RETOMAR } from "./sinais-da-equipa";

export { COMO_PAUSAR_A_VITORIA, MOTIVO_DA_PAUSA, SINAL_PARA_PAUSAR, SINAL_PARA_RETOMAR };

export type SinalDaEquipa = "pausar" | "retomar";

const ABRE_ASPAS = "«";

/** As posições dos sinais que contam, pela ordem em que aparecem. */
function sinaisQueContam(texto: string): Array<{ i: number; sinal: SinalDaEquipa }> {
  const achados: Array<{ i: number; sinal: SinalDaEquipa }> = [];
  let aspasAbertas = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === ABRE_ASPAS) aspasAbertas++;
    else if (c === SINAL_PARA_RETOMAR) {
      if (aspasAbertas > 0) aspasAbertas--; // fecha umas aspas: não é sinal
      else achados.push({ i, sinal: "retomar" });
    } else if (c === SINAL_PARA_PAUSAR) achados.push({ i, sinal: "pausar" });
  }
  return achados;
}

/**
 * O SINAL DE UMA MENSAGEM DA EQUIPA — «pausar», «retomar», ou null sem sinal.
 * Com os dois, vale o último. O envio de modelo da d86 nunca tem sinal.
 */
export function sinalDaEquipa(texto: string | null | undefined): SinalDaEquipa | null {
  if (typeof texto !== "string" || !texto.trim()) return null;
  if (eEnvioDeModelo(texto)) return null;
  const achados = sinaisQueContam(semMarcaDeMao(texto));
  return achados.length > 0 ? achados[achados.length - 1].sinal : null;
}

/**
 * A MENSAGEM SEM OS SINAIS — para o backoffice a enviar ao cliente. Tira só os
 * que contam (as aspas «…» ficam), e arruma os espaços que sobram. Vazia
 * quando a mensagem era só o sinal: então não sai nada.
 */
export function semOSinal(texto: string): string {
  const fora = new Set(sinaisQueContam(texto).map((s) => s.i));
  if (fora.size === 0) return texto.trim();
  const limpo = [...texto].map((c, i) => (fora.has(i) ? "" : c)).join("");
  return limpo
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * O QUE FAZ UMA MENSAGEM À MÃO DA EQUIPA, NO TELEMÓVEL:
 *   · «pausar» / «retomar» — o sinal manda;
 *   · «entregar» — sem sinal, a um profissional registado: continua como
 *     antes (a conversa com um parceiro é da equipa, d112);
 *   · «nada» — sem sinal, a um cliente: a Vitória continua a responder.
 * O envio de modelo da d86 é sempre «nada».
 */
export function oQueFazAMensagemDaEquipa(p: {
  texto: string | null | undefined;
  profissional: boolean;
}): SinalDaEquipa | "entregar" | "nada" {
  if (eEnvioDeModelo(p.texto)) return "nada";
  const sinal = sinalDaEquipa(p.texto);
  if (sinal) return sinal;
  return p.profissional ? "entregar" : "nada";
}

/** Sem espaços a mais — para comparar uma mensagem que saiu com a que voltou da ponte. */
export function textoComparavel(texto: string | null | undefined): string {
  return semMarcaDeMao(String(texto ?? "")).replace(/\s+/g, " ").trim();
}
