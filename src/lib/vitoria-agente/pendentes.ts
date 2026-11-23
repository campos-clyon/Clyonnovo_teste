/**
 * O QUE O AGENTE DEIXOU À ESPERA DO CLIENTE — d92 (23-11-2026). PURO.
 *
 * O modelo nunca fecha nem cancela: PROPÕE. A proposta fica num «pendente»
 * (no registo `vitoriaAccoes`, ferramenta «pendente») e é o CÓDIGO que lê a
 * resposta seguinte do cliente:
 *
 *   · fecho  — «SIM» (ou «1», ou o sim da língua dele: yes, oui, sí…) dentro
 *              de 30 minutos fecha pelo caminho de sempre; outra coisa não;
 *   · cancelar — só o CANCELAR (`eConfirmacaoDoCancelamento`, a mesma regra da
 *              pergunta de sempre) dentro de 48 horas;
 *   · parceiro — a pergunta ao parceiro (a condição do cliente): fica para a
 *              equipa / o parceiro responder; o cliente não a confirma.
 *
 * Um texto do modelo a dizer «fechado» não fecha nada: só esta leitura.
 */

import { eConfirmacaoDoCancelamento } from "../validade-do-orcamento";
import { HORAS_PARA_O_CANCELAR, MINUTOS_PARA_O_SIM, type FechoProposto } from "./propostas-do-agente";

export type CancelarProposto = { tipo: "cancelar"; pedidoId: number; propostoEm: string };
export type PerguntaAoParceiro = {
  tipo: "parceiro";
  pedidoId: number;
  negociacaoId: number;
  parceiro: string;
  condicao: string;
  /** O que se mandaria (ou mandou) ao parceiro. */
  mensagem: string;
  propostoEm: string;
};
export type Pendente = FechoProposto | CancelarProposto | PerguntaAoParceiro;

const normal = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[!.,;:)(👍🙏😊🙂✅]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Os «sim» que o código aceita — em português e nas línguas do tradutor. */
const SINS = new Set([
  "sim", "1", "s", "sim por favor", "sim pode", "sim pode ser", "sim reserve", "sim reserva", "sim confirmo", "confirmo", "sim obrigado", "sim obrigada",
  "yes", "yes please", "yes thank you", "yes thanks", "ok yes", "yes ok", "y",
  "oui", "oui merci", "oui s'il vous plait", "oui svp",
  "si", "si por favor", "si gracias",
  "ja", "ja bitte", "sì", "da",
]);

/** É o SIM do código? Curto, sem pergunta e sem «não». */
export function eOSimDoCodigo(texto: string | null | undefined): boolean {
  const cru = String(texto ?? "");
  if (/\?/.test(cru)) return false;
  const t = normal(cru);
  if (!t || t.length > 30) return false;
  if (/\b(nao|no|non|nein|not)\b/.test(t)) return false;
  return SINS.has(t);
}

export type RespostaAoPendente =
  /** O cliente confirmou dentro do prazo: o código executa (ou, em ensaio, «teria»). */
  | { tipo: "confirmou" }
  /** O prazo passou: o pendente acaba, a mensagem segue o caminho normal. */
  | { tipo: "expirou" }
  /** Disse outra coisa: o pendente acaba, a mensagem segue o caminho normal (o agente). */
  | { tipo: "outra" }
  /** Não é coisa que o cliente confirme (a pergunta ao parceiro). */
  | { tipo: "nao_se_aplica" };

/** A RESPOSTA DO CLIENTE AO QUE FICOU PENDENTE. Pura. */
export function respostaAoPendente(p: Pendente, texto: string | null | undefined, agora: Date): RespostaAoPendente {
  if (p.tipo === "parceiro") return { tipo: "nao_se_aplica" };
  const desde = (agora.getTime() - new Date(p.propostoEm).getTime()) / 60_000;
  const prazo = p.tipo === "fecho" ? MINUTOS_PARA_O_SIM : HORAS_PARA_O_CANCELAR * 60;
  const confirma = p.tipo === "fecho" ? eOSimDoCodigo(texto) : eConfirmacaoDoCancelamento(texto);
  if (!(desde >= 0 && desde <= prazo)) return confirma ? { tipo: "expirou" } : { tipo: "outra" };
  return confirma ? { tipo: "confirmou" } : { tipo: "outra" };
}

/** Lê um pendente guardado (JSON do registo). null se não for um. */
export function lerPendente(v: unknown): Pendente | null {
  let o: unknown = v;
  if (typeof v === "string") {
    try {
      o = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object") return null;
  const p = o as Record<string, unknown>;
  const id = Number(p.pedidoId);
  if (!Number.isInteger(id) || id <= 0 || typeof p.propostoEm !== "string") return null;
  if (p.tipo === "fecho" && Number.isInteger(Number(p.negociacaoId)) && Number.isFinite(Number(p.total))) {
    return { tipo: "fecho", pedidoId: id, negociacaoId: Number(p.negociacaoId), parceiro: String(p.parceiro ?? ""), total: Number(p.total), propostoEm: p.propostoEm };
  }
  if (p.tipo === "cancelar") return { tipo: "cancelar", pedidoId: id, propostoEm: p.propostoEm };
  if (p.tipo === "parceiro" && Number.isInteger(Number(p.negociacaoId))) {
    return {
      tipo: "parceiro",
      pedidoId: id,
      negociacaoId: Number(p.negociacaoId),
      parceiro: String(p.parceiro ?? ""),
      condicao: String(p.condicao ?? ""),
      mensagem: String(p.mensagem ?? ""),
      propostoEm: p.propostoEm,
    };
  }
  return null;
}

/** O pendente em palavras, para o painel («o que teria feito»). */
export function pendenteEmPalavras(p: Pendente, emEnsaio: boolean): string {
  const t = emEnsaio ? "teria " : "";
  const e = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
  switch (p.tipo) {
    case "fecho":
      return `${t}proposto o fecho do #${p.pedidoId} com ${p.parceiro} por ${e(p.total)} (à espera do SIM)`;
    case "cancelar":
      return `${t}perguntado se cancela o #${p.pedidoId} (à espera do CANCELAR)`;
    case "parceiro":
      return `${t}perguntado a ${p.parceiro} se consegue: «${p.condicao}» (#${p.pedidoId})`;
  }
}
