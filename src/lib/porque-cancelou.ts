/**
 * DEPOIS DE CANCELAR, O PORQUÊ — d126 (CEO e dono, 25-11-2026).
 *
 * O cliente que cancela pela conversa ouve UMA mensagem: os pedidos que se
 * cancelaram, o que acontece aos dados, e uma pergunta delicada sobre o
 * porquê, com quatro respostas simples (1 o valor, 2 a data, 3 já resolveu de
 * outra forma, 4 outro motivo) — e, se foi o valor ou a data, a oferta de um
 * parceiro voltar a ver. A resposta dele grava-se no pedido (o motivo do fecho
 * da d54, e uma linha no histórico). Depois disso manda o «não contactar»
 * (d93): a resposta ao porquê é a única excepção, e não há seguimentos.
 *
 * PURO. A base está em `porque-cancelou-na-base.ts`.
 */

import { semAcentos } from "./leitor-da-recolha";
import type { ChaveDoMotivo } from "./motivo-do-fecho";

/** Quanto tempo a resposta ao porquê ainda se lê como resposta (depois, é uma conversa nova). */
export const HORAS_PARA_O_PORQUE = 48;

/** «#684», «#684 e #685», «#683, #684 e #685». */
export function listaDePedidos(ids: readonly number[]): string {
  const l = ids.map((id) => `#${id}`);
  if (l.length <= 1) return l.join("");
  return `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`;
}

/**
 * A MENSAGEM DEPOIS DE CANCELAR — uma só. `dados`: «apagados» quando o pedido
 * se anonimizou na hora (d93/d102), «a_apagar» quando sai pela purga (os
 * lembretes, 7 dias depois).
 */
export function mensagemDepoisDeCancelar(
  ids: readonly number[],
  opcoes: {
    dados: "apagados" | "a_apagar";
    /** false quando outro pedido dele ficou com a equipa (vai haver conversa): não se promete o silêncio. */
    semMaisContacto?: boolean;
  },
): string {
  const varios = ids.length > 1;
  const feito = varios
    ? `Está feito: os seus pedidos ${listaDePedidos(ids)} foram cancelados.`
    : `Está feito: o seu pedido ${listaDePedidos(ids)} foi cancelado.`;
  const deste = varios ? "destes pedidos" : "deste pedido";
  const silencio = opcoes.semMaisContacto === false ? "" : " e não voltamos a escrever-lhe";
  const dados =
    opcoes.dados === "apagados"
      ? `Os seus dados ${deste} foram apagados${silencio}.`
      : `Os dados que nos deu ${deste} serão apagados, como diz a nossa Política de Privacidade${silencio}.`;
  return [
    `${feito} ${dados}`,
    "Se puder, diga-nos só porquê, para melhorarmos. Basta responder com o número:\n1. o valor\n2. a data\n3. já resolvi de outra forma\n4. outro motivo",
    "Se foi o valor ou a data, diga-nos o que lhe serve: um parceiro pode voltar a ver, sem compromisso.",
  ].join("\n\n");
}

export type PorqueCancelou = "valor" | "data" | "resolvido" | "outro";

/** O motivo do fecho (d54) que cada resposta grava. */
export const MOTIVO_DO_FECHO_DO_PORQUE: Record<PorqueCancelou, ChaveDoMotivo> = {
  valor: "preco",
  data: "sem_parceiro",
  resolvido: "ja_nao_precisa",
  outro: "outro",
};

/** Como fica escrito no histórico do pedido. */
export const ROTULO_DO_PORQUE: Record<PorqueCancelou, string> = {
  valor: "o valor",
  data: "a data",
  resolvido: "já resolveu de outra forma",
  outro: "outro motivo",
};

const POR_NUMERO: Record<string, PorqueCancelou> = { "1": "valor", "2": "data", "3": "resolvido", "4": "outro" };

const limpar = (texto: string) =>
  semAcentos(texto)
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}]/gu, " ")
    .replace(/[.,;:!()«»"'’º°ª-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * O PORQUÊ NA RESPOSTA DELE — o número (1 a 4, sozinho ou à frente) ou as
 * palavras («estava caro», «a data não dava», «já tratei com outra empresa»).
 * null quando não se lê nenhum (quem chama decide se é «outro motivo»). Pura.
 */
export function lerOPorque(texto: string | null | undefined): PorqueCancelou | null {
  const t = limpar(String(texto ?? ""));
  if (!t) return null;
  const n = /^(?:(?:a |e a )?(?:opcao|op|numero|n|resposta) )?([1-4])(?: |$)/.exec(t);
  if (n) return POR_NUMERO[n[1]];
  if (/\b(o valor|valor|preco|precos|caro|cara|caros|barato|barata|orcamento|dinheiro|custo|pagar)\b/.test(t)) return "valor";
  if (
    /\b(resolvi|resolvido|resolvida|tratei|tratado|ja fiz|ja esta feito|outra empresa|outra pessoa|outro sitio|arranjei|consegui|ja nao preciso|ja tenho|ja contratei|ja foi feito)\b/.test(
      t,
    )
  )
    return "resolvido";
  // Sem «dia», «hora» nem «tarde»: «bom dia» e «boa tarde» não são a data.
  if (/\b(data|datas|horario|disponibilidade|demora|demorava|demoram|prazo|marcacao)\b/.test(t)) return "data";
  if (/\b(outro motivo|outro|outra razao|motivo pessoal|pessoal)\b/.test(t)) return "outro";
  return null;
}

/** O que se lhe responde ao porquê (uma vez, e acabou). */
export function respostaAoPorque(p: PorqueCancelou): string {
  if (p === "valor" || p === "data") {
    return `Obrigada por nos dizer. Passo a uma pessoa da equipa, que vê consigo, por aqui, se um parceiro consegue ${
      p === "valor" ? "outro valor" : "outra data"
    }.`;
  }
  return "Obrigada por nos dizer, fica registado. Se um dia precisar, estamos por aqui.";
}

/** O motivo à vista no cartão da conversa, quando o porquê passa à equipa. */
export function motivoDoPorqueParaAEquipa(ids: readonly number[], p: PorqueCancelou): string {
  return `Cancelou ${ids.length > 1 ? "os pedidos" : "o pedido"} ${listaDePedidos(ids)} (motivo: ${ROTULO_DO_PORQUE[p]}) — ver se um parceiro consegue ${
    p === "valor" ? "outro valor" : "outra data"
  }`;
}
