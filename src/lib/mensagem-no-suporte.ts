import { diaEmLisboa, instanteDaBase, instanteEmLisboa, pecasEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { haQuanto } from "./mesa-das-conversas";

/**
 * UMA MENSAGEM NO SUPORTE NUNCA FICA CALADA — d140 (aprovada pelo dono, 27-11-2026).
 *
 * O caso: uma cliente escreveu DENTRO do pedido dela (Suporte › «No pedido») a
 * pedir trabalho a mais; a Vitória não respondeu (só tratava o WhatsApp) e a
 * equipa só a viu no dia seguinte (só havia o selo do menu Suporte). Agora:
 *
 *   1. a equipa é avisada no momento (o canal dos avisos da equipa, o push do
 *      backoffice), e o pedido entra em «Precisa de si» na Mesa com
 *      «Mensagem no pedido por responder há N»;
 *   2. a Vitória responde no pedido, com o mesmo cérebro do WhatsApp (d129);
 *      o que é da equipa (trabalho a mais, mudar o valor, queixas, cancelar,
 *      ou o que ela não souber) diz que a equipa confirma e passa-o, com o
 *      motivo; quem tem WhatsApp recebe um aviso curto, um por pedido e por
 *      dia, das 9h às 20h (fora disso, às 9h);
 *   3. trabalho hoje ou amanhã e a mensagem pede uma alteração: o parceiro
 *      atribuído também é avisado.
 *
 * PURO: as regras e as frases. A base está em `mensagem-no-suporte-na-base.ts`.
 */

/** Quem responde, no histórico do pedido. O cliente vê «CLYON» (`historico-para-o-cliente.ts`). */
export const VITORIA_NO_HISTORICO = { id: 0, nome: "Vitória", role: "assistente_online" } as const;

/** Uma entrada do histórico de um pedido, como `appendOrderHistory` a grava. */
type Entrada = { type?: unknown; createdAt?: unknown; passaAEquipa?: unknown; motivo?: unknown };

const DA_CLYON = new Set(["info_requested", "message_to_client"]);

/**
 * DESDE QUANDO HÁ UMA MENSAGEM DELE POR RESPONDER — ou `null`.
 *
 * A primeira mensagem do cliente depois da última resposta da CLYON. Uma
 * resposta da Vitória que PASSA À EQUIPA (`passaAEquipa`) não conta como
 * resposta: disse ao cliente que a equipa confirma, e a bola continua do
 * nosso lado. Um histórico estragado não é «por responder».
 */
export function mensagemPorResponder(historyJson: unknown): { desde: string; motivo: string | null } | null {
  if (typeof historyJson !== "string" || !historyJson.trim()) return null;
  let lista: unknown;
  try {
    lista = JSON.parse(historyJson);
  } catch {
    return null;
  }
  if (!Array.isArray(lista)) return null;
  let desde: string | null = null;
  let motivo: string | null = null;
  for (const e of lista as Entrada[]) {
    if (!e || typeof e !== "object") continue;
    if (e.type === "client_reply") {
      if (desde == null) desde = typeof e.createdAt === "string" ? e.createdAt : "";
      continue;
    }
    if (typeof e.type === "string" && DA_CLYON.has(e.type)) {
      if (e.passaAEquipa === true) {
        if (desde != null && typeof e.motivo === "string" && e.motivo.trim()) motivo = e.motivo.trim();
        continue;
      }
      desde = null;
      motivo = null;
    }
  }
  return desde == null ? null : { desde, motivo };
}

/** A linha da Mesa: «Mensagem no pedido por responder há 3 h». */
export function linhaDaMensagemNoPedido(desde: string | Date | null | undefined, agora: Date): string {
  const d = instanteDaBase(desde ?? null);
  const s = d ? Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 1000)) : null;
  const ha = s == null ? "" : ` ${haQuanto(s)}`;
  return `Mensagem no pedido por responder${ha}`;
}

/* ── O que é da equipa ──────────────────────────────────────────────────── */

const TRABALHO_A_MAIS =
  /(trabalho\s+a\s+mais|\bacrescent\w*|\badicion\w*|\bjunt(?:ar|em|e)\s+(?:mais|tamb[ée]m)|\bmais\s+(?:um|uma|uns|umas|dois|duas|tr[eê]s|coisas|m[óo]veis|sacos|pe[çc]as|objetos|objectos|caixas|divis[õo]es)\b|\btamb[ée]m\s+(?:levar|recolher|montar|desmontar|tirar|retirar|pintar|arranjar|reparar|mudar|carregar|transportar|tratar)|\b(?:levar|recolher|montar|tirar|retirar)\s+(?:tamb[ée]m|ainda|mais)\b|\bextra\b)/i;
const ALTERACAO =
  /(\b(?:adiar|antecipar|remarcar|reagendar)\w*|\b(?:mudar|alterar|trocar|passar|mud[aá]-?l[oa]|alter[aá]-?l[oa])\b[^.?!\n]{0,40}\b(?:dia|data|hora|hor[áa]rio|morada|endere[çc]o|andar|local|sitio|s[íi]tio|para\s+(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|amanh[ãa]))\b|\boutro\s+dia\b|\boutra\s+(?:hora|data|morada)\b)/i;
const VALOR =
  /(\bdesconto\b|\bmais\s+barato\b|\bmuito\s+caro\b|\bcaro\s+demais\b|\bbaixar\s+o\s+(?:pre[çc]o|valor)|\bpagar\s+menos\b|\breembols\w*|\bdevolu[çc][ãa]o\b|\bdevolver\s+o\s+dinheiro\b|\bcobr\w*\s+a\s+mais\b|\b(?:mudar|alterar|rever|corrigir|negociar|baixar)\s+o\s+(?:pre[çc]o|valor|or[çc]amento)\b|\bo\s+(?:pre[çc]o|valor)\s+(?:est[áa]|n[ãa]o\s+est[áa])\s+(?:errado|mal)\b)/i;
const QUEIXA =
  /(\bqueix\w*|\breclama[çc]\w*|\blivro\s+de\s+reclama|\binsatisfeit\w*|\bp[ée]ssim\w*|\bvergonha\b|\bpartir(?:am|am-?me)?\b|\bpartiu\b|\bestrag\w*|\bdanific\w*|\briscou\b|\briscaram\b|\bn[ãa]o\s+(?:apareceu|apareceram|vieram|veio)\b|\bmal\s+feito\b|\bburla\b|\benganad\w*|\bdesrespeit\w*|\bmal[\s-]educad\w*)/i;
const CANCELAR = /(\bcancel\w*|\bdesist\w*|\banul(?:ar|em|e)\b|\bj[áa]\s+n[ãa]o\s+(?:quero|preciso)\b)/i;
const UMA_PESSOA = /(\bfalar\s+com\s+(?:uma\s+pessoa|algu[ée]m|um\s+humano|a\s+equipa|o\s+respons[áa]vel)|\bliguem[- ]?me\b|\bligar[- ]?me\b|\btelefonem[- ]?me\b|\bhumano\b)/i;

/** As perguntas que nunca são da Vitória sozinha, pela ordem em que se dizem. */
const DA_EQUIPA: ReadonlyArray<readonly [RegExp, string]> = [
  [QUEIXA, "Queixa do cliente"],
  [CANCELAR, "Quer cancelar"],
  [VALOR, "Fala de mudar o valor"],
  [TRABALHO_A_MAIS, "Pede trabalho a mais"],
  [ALTERACAO, "Pede uma alteração ao pedido (dia, hora ou morada)"],
  [UMA_PESSOA, "Pede para falar com uma pessoa"],
];

/**
 * É DA EQUIPA? O motivo (para o cartão e para o aviso), ou `null` se a
 * Vitória pode responder sozinha. É o código que decide, não o modelo: um
 * pedido de trabalho a mais passa sempre, diga o modelo o que disser.
 */
export function motivoDaEquipa(texto: string | null | undefined): string | null {
  const t = String(texto ?? "");
  for (const [re, motivo] of DA_EQUIPA) if (re.test(t)) return motivo;
  return null;
}

/** A mensagem pede uma alteração ao trabalho (o parceiro tem de saber)? Trabalho a mais, outro dia ou morada, outro valor. */
export function pedeAlteracao(texto: string | null | undefined): boolean {
  const t = String(texto ?? "");
  return TRABALHO_A_MAIS.test(t) || ALTERACAO.test(t) || VALOR.test(t);
}

/** O trabalho é hoje ou amanhã, em Lisboa? */
export function eHojeOuAmanha(dia: string | Date | null | undefined, agora: Date): boolean {
  const d = instanteDaBase(dia ?? null);
  if (!d) return false;
  const hoje = diaEmLisboa(agora);
  const doTrabalho = diaEmLisboa(d);
  return doTrabalho === hoje || doTrabalho === somarDiasAoDia(hoje, 1);
}

/* ── O aviso ao cliente ─────────────────────────────────────────────────── */

/** Das 9h (inclusive) às 20h (exclusive), em Lisboa. */
export const HORA_DO_PRIMEIRO_AVISO = 9;
export const HORA_DO_ULTIMO_AVISO = 20;

/** O aviso curto no WhatsApp: a resposta está no pedido, onde ele escreveu. */
export function avisoAoClienteDaResposta(pedidoId: number, ligacao: string): string {
  return `Respondemos à sua mensagem no pedido #${pedidoId}: ${ligacao}`;
}

/** Quando sai o aviso: já, das 9h às 20h; senão, às 9h seguintes (em Lisboa). */
export function quandoAvisarOCliente(agora: Date): Date {
  const h = pecasEmLisboa(agora).hora;
  if (h >= HORA_DO_PRIMEIRO_AVISO && h < HORA_DO_ULTIMO_AVISO) return agora;
  const hoje = diaEmLisboa(agora);
  const dia = h < HORA_DO_PRIMEIRO_AVISO ? hoje : somarDiasAoDia(hoje, 1);
  return instanteEmLisboa(`${dia}T0${HORA_DO_PRIMEIRO_AVISO}:00`) ?? agora;
}

/** Um por pedido e por dia: a chave do dia em que sai. */
export function chaveDoAvisoAoCliente(pedidoId: number, enviarEm: Date): string {
  return `cliente:p${pedidoId}:${diaEmLisboa(enviarEm)}`;
}

/* ── O aviso ao parceiro ────────────────────────────────────────────────── */

/** O que o cliente pediu, curto e sem contactos (vai para o telemóvel do parceiro). */
export function resumoDoPedidoDeAlteracao(texto: string, maximo = 140): string {
  const limpo = String(texto ?? "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(?:\+?\d[\s-]?){9,}/g, "[contacto]")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.length > maximo ? `${limpo.slice(0, maximo - 1).trimEnd()}…` : limpo;
}

/** «CLYON · O cliente do #N pediu uma alteração: … A equipa confirma consigo.» */
export function avisoAoParceiroDaAlteracao(pedidoId: number, texto: string): string {
  return `CLYON · O cliente do #${pedidoId} pediu uma alteração: «${resumoDoPedidoDeAlteracao(texto)}» A equipa confirma consigo.`;
}

/** Um por pedido e por dia, também ao parceiro. */
export function chaveDoAvisoAoParceiro(pedidoId: number, agora: Date): string {
  return `parceiro:p${pedidoId}:${diaEmLisboa(agora)}`;
}

/* ── O aviso à equipa ───────────────────────────────────────────────────── */

/** O título e o corpo do aviso à equipa — só o n.º e o motivo (vai para o ecrã de bloqueio). */
export function avisoAEquipaDaMensagem(d: {
  origem: "pedido" | "plataforma";
  id: number;
  quem: "cliente" | "parceiro";
  passouAEquipa: boolean;
  motivo: string | null;
}): { titulo: string; corpo: string } {
  if (d.origem === "plataforma") {
    return {
      titulo: `${d.quem === "parceiro" ? "Um parceiro" : "Um cliente"} escreveu no Suporte`,
      corpo: `Pedido de ajuda #${d.id}, da plataforma. Responda no Suporte.`,
    };
  }
  const motivo = (d.motivo ?? "").trim();
  return {
    titulo: `Mensagem no pedido #${d.id}`,
    corpo: d.passouAEquipa
      ? `O cliente escreveu no pedido${motivo ? `: ${motivo.slice(0, 120)}` : ""}. A Vitória disse que a equipa confirma — responda no Suporte.`
      : `O cliente escreveu no pedido e a Vitória respondeu. Veja no Suporte se está certo.`,
  };
}
