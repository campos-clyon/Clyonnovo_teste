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

/*
 * ── A TRANSIÇÃO DE 7 DIAS — 04-11-2026 (d10 v2, escolha do dono: «7 dias de
 * transição») ───────────────────────────────────────────────────────────────
 *
 * Com 0 de 13 guias verificadas, a regra parou toda a contratação de entulho
 * (em 60 dias o #11, o #6 e o #9 fizeram 16 trabalhos de entulho). Até
 * `TRANSICAO_DA_GUIA_ATE`, um parceiro APROVADO ANTES de 04-11-2026 com a guia
 * por verificar pode ser contratado e escolhido, em todas as portas; a Mesa e
 * os Trabalhos CLYON mostram-lhe o aviso âmbar (`AVISO_DA_TRANSICAO`) e o
 * cliente não vê aviso nenhum. Quem for aprovado a 04-11 ou depois precisa da
 * guia verificada desde já.
 *
 * O INTERRUPTOR É SÓ ESTA DATA. Passada ela, a regra volta a valer para todos
 * sem deploy nenhum: a hora compara-se a cada pedido. Em Novembro Lisboa está
 * em UTC, por isso «23:59:59Z» é o fim do dia 18 em Lisboa (10-11-2026: o dono
 * prolongou a transição 7 dias, de 11/11 para 18/11).
 *
 * «Aprovado antes» lê `providers.aprovadoEm`, que nasceu a 04-11-2026 (d10.2):
 * vazio é um aprovado de antes; uma data é de quando foi aprovado. Uma linha
 * que nem traz a coluna não ganha a transição — na dúvida, a regra.
 */
export const TRANSICAO_DA_GUIA_ATE = "2026-11-18T23:59:59Z";
/** Os aprovados antes deste instante (00:00 de 04-11-2026 em Lisboa, = UTC) têm a transição. */
export const APROVADOS_ANTES_DE = "2026-11-04T00:00:00Z";

/** «18/11» — o último dia da transição, em Lisboa (era 11/11; o dono prolongou-a 7 dias a 10-11-2026). */
export const ULTIMO_DIA_DA_TRANSICAO = new Date(TRANSICAO_DA_GUIA_ATE).toLocaleDateString("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
});

/** O aviso âmbar da Mesa e dos Trabalhos CLYON durante a transição. */
export const AVISO_DA_TRANSICAO = `guia por verificar — pode ser contratado até ${ULTIMO_DIA_DA_TRANSICAO}`;

/** Este parceiro está na transição (aprovado antes de 04-11, e ainda não passou o prazo)? */
export function emTransicao(
  profissional: { estado?: unknown; aprovadoEm?: unknown },
  agora: Date = new Date(),
): boolean {
  if (agora.getTime() > new Date(TRANSICAO_DA_GUIA_ATE).getTime()) return false;
  // A linha tem de dizer o estado e trazer a coluna: sem isso, a regra.
  if (profissional.estado !== "aprovado") return false;
  if (profissional.aprovadoEm === undefined) return false;
  if (profissional.aprovadoEm === null || profissional.aprovadoEm === "") return true;
  const d = profissional.aprovadoEm instanceof Date ? profissional.aprovadoEm : new Date(String(profissional.aprovadoEm));
  return !Number.isNaN(d.getTime()) && d.getTime() < new Date(APROVADOS_ANTES_DE).getTime();
}

type ProfissionalDaGuia = {
  emiteGuiaTransporte?: unknown;
  guiaVerificadaEm?: unknown;
  /** O estado da conta e quando foi aprovado — para a transição (d10 v2). */
  estado?: unknown;
  aprovadoEm?: unknown;
};

/** O cliente, a Mesa ou a escolha de um Trabalho CLYON têm de parar aqui? */
export function guiaImpedeContratar(
  pedido: { serviceType?: unknown; precisaGuiaTransporte?: unknown },
  profissional: ProfissionalDaGuia,
  agora: Date = new Date(),
): boolean {
  return trabalhoExigeGuia(pedido) && !guiaVerificada(profissional) && !emTransicao(profissional, agora);
}

/** Passa só por causa da transição: a Mesa e os Trabalhos CLYON mostram o aviso âmbar. */
export function guiaPassaPelaTransicao(
  pedido: { serviceType?: unknown; precisaGuiaTransporte?: unknown },
  profissional: ProfissionalDaGuia,
  agora: Date = new Date(),
): boolean {
  return trabalhoExigeGuia(pedido) && !guiaVerificada(profissional) && emTransicao(profissional, agora);
}
