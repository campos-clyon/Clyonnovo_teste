/**
 * QUEM ACEITA UM TRABALHO CLYON TEM RESPOSTA EM 72 HORAS — 28-10-2026 (d12).
 *
 * Num Trabalho CLYON oferecido a vários («distribuida»), os profissionais
 * aceitam, a CLYON manda o preço ao cliente e, quando ele diz que sim, escolhe
 * quem o faz. Se o cliente não responde, quem aceitou ficava à espera sem
 * prazo — havia pedidos com o preço no cliente há uma semana e quatro ou cinco
 * profissionais a guardar o dia.
 *
 * A regra: 72 horas depois de o preço ir ao cliente (`propostaEnviadaEm`), sem
 * a CLYON ter escolhido ninguém, o pedido vai para os Arquivados e quem
 * aceitou é avisado. Corre na rotina `trabalhos-clyon-sem-resposta`.
 *
 * Puro e sem imports: a app importa as frases tal e qual.
 */

/** As horas que o cliente tem para responder ao preço. */
export const HORAS_PARA_O_CLIENTE_RESPONDER = 72;

/** O que se diz a quem aceita — no email da oferta, no painel e na app. */
export const SE_O_CLIENTE_NAO_RESPONDER = "Se o cliente não responder em 3 dias, avisamo-lo.";

/** O aviso a quem aceitou, quando o pedido vai para os Arquivados. */
export const TRABALHO_SEM_EFEITO =
  "O cliente não respondeu — este trabalho ficou sem efeito. Obrigado por ter aceitado.";

/**
 * SÓ OS PREÇOS ENVIADOS A PARTIR DE 24-10-2026. Os que já esperavam há mais de
 * 5 dias quando a regra entrou ficam para a equipa decidir, à mão (decisão do
 * CEO, 28-10-2026): a rotina não os arquiva. Meia-noite de Lisboa.
 */
export const PRAZO_DO_CLIENTE_DESDE = new Date("2026-10-24T00:00:00+01:00");

/** Os estados de um pedido que já saiu da mesa — a rotina não lhes toca. */
const JA_SAIU = new Set(["arquivado", "cancelado", "concluido", "rejeitado"]);

export type TrabalhoClyonAEspera = {
  /** O preço ao cliente — só os Trabalhos CLYON o têm. */
  valorFixoClyon: unknown;
  estadoDoPedido: string | null;
  propostaEnviadaEm: Date | string | null;
  negociacoes: Array<{ estado: string }>;
  /** O «Aceito este preço» do cliente (31-10-2026, d2). */
  precoAceiteEm?: Date | string | null;
  /** A última mensagem do cliente no WhatsApp (31-10-2026, d2). */
  ultimaMensagemDoClienteEm?: Date | string | null;
  /** Quando a conversa dele passou a uma pessoa (31-10-2026, d2). */
  passadaAUmaPessoaEm?: Date | string | null;
  /** A última vez que esta rotina o arquivou e avisou quem aceitou (31-10-2026, d2). */
  semEfeitoAvisadoEm?: Date | string | null;
};

/**
 * O SELO DE UM TRABALHO CLYON EM QUE O CLIENTE RESPONDEU — 31-10-2026 (d2).
 * Na Mesa, no «Por decidir».
 */
export const O_CLIENTE_RESPONDEU = "O cliente respondeu — escolher parceiro";

function comoData(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * O CLIENTE RESPONDEU AO PREÇO? Pura. — 31-10-2026 (d2).
 *
 * A d12 foi escrita antes de o «Aceito este preço» existir, e a rotina
 * arquivava quem tinha dito que sim. Conta como resposta, depois de o preço
 * ir ao cliente (`propostaEnviadaEm`):
 *
 *   · o «Aceito este preço» (`precoAceiteEm`) — esse, a qualquer hora;
 *   · uma mensagem dele no WhatsApp;
 *   · ou a conversa dele passada a uma pessoa.
 */
export function clienteRespondeu(t: TrabalhoClyonAEspera): boolean {
  if (comoData(t.precoAceiteEm)) return true;
  const enviada = comoData(t.propostaEnviadaEm);
  if (!enviada) return false;
  const depois = (v: Date | string | null | undefined) => {
    const d = comoData(v);
    return d != null && d.getTime() > enviada.getTime();
  };
  return depois(t.ultimaMensagemDoClienteEm) || depois(t.passadaAUmaPessoaEm);
}

/**
 * VAI AO «POR DECIDIR» DA MESA, COM O SELO `O_CLIENTE_RESPONDEU`? Pura. —
 * 31-10-2026 (d2). Um Trabalho CLYON ainda na mesa, com o preço no cliente,
 * em que o cliente respondeu e a CLYON ainda não deu o trabalho a ninguém.
 */
export function vaiAoPorDecidir(t: TrabalhoClyonAEspera): boolean {
  if (t.valorFixoClyon == null) return false;
  if (t.estadoDoPedido && JA_SAIU.has(t.estadoDoPedido)) return false;
  if (!comoData(t.propostaEnviadaEm)) return false;
  if ((t.negociacoes ?? []).some((n) => n.estado === "acordada")) return false;
  return clienteRespondeu(t);
}

/**
 * ESTE TRABALHO FICA SEM EFEITO? Pura.
 *
 *   · é um Trabalho CLYON, e o pedido ainda está na mesa;
 *   · o preço foi ao cliente a partir de `PRAZO_DO_CLIENTE_DESDE`, e há 72 h
 *     ou mais;
 *   · a CLYON ainda não deu o trabalho a ninguém (nenhuma negociação
 *     «acordada») — dar-lho é a resposta do cliente;
 *   · e há quem tenha aceitado («aguarda_contratacao»). Sem ninguém, não há a
 *     quem responder, e a rotina não toca no pedido.
 *
 * E desde 31-10-2026 (d2): nunca quando o cliente respondeu
 * (`clienteRespondeu` — vai ao «Por decidir»), nem num pedido que esta
 * rotina já arquivou uma vez e a equipa restaurou: quem aceitou já ouviu o
 * «sem efeito», e um segundo seria mentira — a equipa decide à mão.
 */
export function ficaSemEfeito(t: TrabalhoClyonAEspera, agora: Date): boolean {
  if (t.valorFixoClyon == null) return false;
  if (clienteRespondeu(t)) return false;
  if (comoData(t.semEfeitoAvisadoEm)) return false;
  if (t.estadoDoPedido && JA_SAIU.has(t.estadoDoPedido)) return false;
  const enviada = comoData(t.propostaEnviadaEm);
  if (!enviada || enviada.getTime() < PRAZO_DO_CLIENTE_DESDE.getTime()) return false;
  if (agora.getTime() - enviada.getTime() < HORAS_PARA_O_CLIENTE_RESPONDER * 3_600_000) return false;
  const negs = t.negociacoes ?? [];
  if (negs.some((n) => n.estado === "acordada")) return false;
  return negs.some((n) => n.estado === "aguarda_contratacao");
}
