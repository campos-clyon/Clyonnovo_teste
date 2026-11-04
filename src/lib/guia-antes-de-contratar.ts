/**
 * GUIA DE RESÍDUOS VERIFICADA ANTES DE CONTRATAR — 04-11-2026 (d10.1, decisão
 * do CEO e do dono: «Confiança antes de crescer»).
 *
 * Desde 14-09-2026 a guia só AVISAVA: o parceiro lia a caixa amarela antes de
 * propor, carregava em «continuar», e nada no contratar a conferia. O cliente
 * podia contratar, e a Mesa escolher, alguém que a CLYON nunca confirmou que
 * pode transportar resíduos — e transportá-los sem registo é coima para quem
 * transporta e problema para quem o contratou.
 *
 * A REGRA, agora:
 *
 *   · num trabalho que exige a guia — o ENTULHO, sempre, e o pedido em que o
 *     cliente marcou «preciso de guia de transporte» —, um parceiro com a guia
 *     por verificar PODE PROPOR (continua a ver o pedido e o aviso de sempre);
 *   · mas NÃO PODE SER CONTRATADO pelo cliente (link, conta, app, WhatsApp),
 *     nem pela Mesa em nome do cliente, nem ESCOLHIDO para um Trabalho CLYON,
 *     nem receber um trabalho passado de outro;
 *   · quem tenta vê porquê: `GUIA_POR_VERIFICAR`.
 *
 * Este ficheiro é PURO e sem importações: lêem-no os ecrãs (o cliente e o
 * backoffice) e as rotas, e a pergunta tem de ter a mesma resposta nos dois.
 * A leitura na base vive em `guia-na-base.ts`.
 */

/** O que o cliente e a Mesa lêem quando não se pode contratar. A frase é da ordem do CEO. */
export const GUIA_POR_VERIFICAR = "Este parceiro ainda não tem a guia de resíduos verificada";

/** A mesma, com o ponto final — para as mensagens de erro e as frases soltas. */
export const GUIA_POR_VERIFICAR_FRASE = `${GUIA_POR_VERIFICAR}.`;

/** O entulho é transporte de resíduos de obra: exige sempre a guia. */
export function servicoExigeGuia(serviceType: unknown): boolean {
  return typeof serviceType === "string" && /entulho/i.test(serviceType);
}

function verdadeiro(v: unknown): boolean {
  return v === true || Number(v) === 1;
}

/** Este trabalho exige a guia de transporte de resíduos? */
export function trabalhoExigeGuia(pedido: {
  serviceType?: unknown;
  precisaGuiaTransporte?: unknown;
}): boolean {
  return servicoExigeGuia(pedido.serviceType) || verdadeiro(pedido.precisaGuiaTransporte);
}

/**
 * O parceiro tem a guia VERIFICADA pela CLYON?
 *
 * Declarar não chega: só conta a data da verificação. Quando a linha traz a
 * declaração (`emiteGuiaTransporte`), tem de estar marcada — uma verificação
 * sem declaração é incoerente e não vale. Quando não a traz (algumas consultas
 * do cliente só lêem a data), vale a data: a base apaga-a sempre que ele
 * desmarca a guia ou muda o número (`actualizarProfissional`).
 */
export function guiaVerificada(profissional: {
  emiteGuiaTransporte?: unknown;
  guiaVerificadaEm?: unknown;
}): boolean {
  const declarada = profissional.emiteGuiaTransporte;
  if (declarada !== undefined && declarada !== null && !verdadeiro(declarada)) return false;
  const v = profissional.guiaVerificadaEm;
  if (v == null || v === "") return false;
  const d = v instanceof Date ? v : new Date(String(v));
  return !Number.isNaN(d.getTime());
}

/** O cliente, a Mesa ou a escolha de um Trabalho CLYON têm de parar aqui? */
export function guiaImpedeContratar(
  pedido: { serviceType?: unknown; precisaGuiaTransporte?: unknown },
  profissional: { emiteGuiaTransporte?: unknown; guiaVerificadaEm?: unknown },
): boolean {
  return trabalhoExigeGuia(pedido) && !guiaVerificada(profissional);
}
