import { pecasEmLisboa } from "./hora-de-lisboa";

/**
 * A JANELA DE CONTACTO — a ÚNICA hora a que a CLYON fala sozinha com alguém
 * (d7, 24-11-2026, o dono): das 9h às 20h de Lisboa.
 *
 * Cliente ou parceiro, WhatsApp ou email, rotina ou Vitória: tudo o que sai
 * sem uma pessoa a carregar no botão lê a janela DAQUI. O que cai fora fica
 * para as 9h seguintes; nunca antes (às 8h ainda é cedo para quem não está à
 * espera de nada), nunca depois das 20h. Antes eram oito janelas, cada uma com
 * a sua constante (8h–21h numas, 9h–21h noutras) — e as promessas diferiam
 * consoante a rotina. Um teste (`janela-de-contacto.test.ts`) varre o código e
 * chumba se aparecer outra.
 *
 * Não é o HORÁRIO DE ATENDIMENTO (`horario-de-atendimento.ts`, 08h–20h, o que
 * se promete ao público: quando uma pessoa responde) nem o dos avisos ao
 * telemóvel da equipa (`avisos-a-equipa.ts`): esses falam com a equipa ou
 * prometem respostas; este é quando a plataforma escreve a quem não pediu.
 *
 * PURO, e sempre na hora de Lisboa (o servidor corre em UTC).
 */
export const JANELA_DE_CONTACTO = Object.freeze({ abre: 9, fecha: 20 });

/** «das 9h às 20h» — para os textos que o dizem (cartões, Configs, mensagens). */
export const JANELA_DE_CONTACTO_POR_EXTENSO = `das ${JANELA_DE_CONTACTO.abre}h às ${JANELA_DE_CONTACTO.fecha}h`;

/** «9h–20h» — a forma curta, para os cartões. */
export const JANELA_DE_CONTACTO_CURTA = `${JANELA_DE_CONTACTO.abre}h–${JANELA_DE_CONTACTO.fecha}h`;

/** Às 9h em ponto, para quem precisa do «a partir das …» («9h00»). */
export const HORA_DE_ABRIR_POR_EXTENSO = `${JANELA_DE_CONTACTO.abre}h00`;

/** Está na janela? 9h00 a 19h59 de Lisboa, seja qual for o fuso do servidor. */
export function naJanelaDeContacto(agora: Date): boolean {
  const h = pecasEmLisboa(agora).hora;
  return h >= JANELA_DE_CONTACTO.abre && h < JANELA_DE_CONTACTO.fecha;
}
