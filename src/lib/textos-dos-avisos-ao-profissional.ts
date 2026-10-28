import { precoComBase, type BaseDoPreco } from "./base-do-preco";
import { tUrgency } from "./translations";
import { TRABALHO_SEM_EFEITO } from "./prazo-do-cliente-clyon";

/**
 * O QUE OS AVISOS AO PROFISSIONAL DIZEM — 28-10-2026 (d5).
 *
 * O aviso de pedido novo no telemóvel dizia só «Recolha de móveis em Almada.»,
 * sem nenhum dos quatro dados que o fazem decidir (quando, a que distância,
 * com fotografias, e quanto recebe) — quando o email os tem todos e o WhatsApp
 * três. A contraproposta do cliente só chegava por email, apesar de a app
 * prometer «Avisamos quando ele responder». E quem ficava sem o trabalho não
 * ouvia nada.
 *
 * As frases vivem aqui, puras e sem imports de servidor, para a app as poder
 * mostrar iguais (o ecrã «Negociação terminada», por exemplo). Quem envia é
 * `avisar-por-push.ts`. Sem preços dos outros profissionais, nunca.
 */

export type AvisoNoTelemovel = { title: string; body: string };

function euros(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

/** «hoje», «amanhã», «esta semana» — ou nada quando não se sabe. */
export function quandoNoAviso(urgencia: string | null | undefined): string | null {
  if (!urgencia) return null;
  const t = tUrgency(urgencia);
  if (!t || t === "Não indicado" || t.length > 24) return null;
  return t.toLowerCase();
}

/** «a 12 km», sem casas decimais — ou nada sem medida. */
export function kmNoAviso(km: number | null | undefined): string | null {
  if (typeof km !== "number" || !Number.isFinite(km) || km < 0) return null;
  return `${Math.round(km)} km`;
}

/** «3 fotografias», «1 fotografia», «sem fotografias» — ou nada sem contagem. */
export function fotografiasNoAviso(n: number | null | undefined): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  if (n === 0) return "sem fotografias";
  return n === 1 ? "1 fotografia" : `${Math.round(n)} fotografias`;
}

/**
 * PEDIDO NOVO — os dados que fazem decidir, com os números do email.
 *
 *   Negociação:     «Pedido novo · Almada»
 *                   «Recolha de móveis · amanhã · 12 km · 3 fotografias. Sugestão CLYON: recebe 89,00 €.»
 *                   (sem valor de partida: «… A proposta é sua.»)
 *   Trabalho CLYON: «Trabalho CLYON · Almada»
 *                   «Recolha de móveis · amanhã · 12 km. Valor fixo: recebe 120,00 €. Aceite ou recuse.»
 */
export function avisoDePedidoNovo(p: {
  /** O serviço já em palavras («Recolha de móveis»). */
  servico: string;
  cidade: string | null | undefined;
  urgencia?: string | null;
  distanciaKm?: number | null;
  fotografias?: number | null;
  /** O que ele recebe — o líquido, como no email. Nulo sem valor de partida. */
  recebe?: number | null;
  base?: BaseDoPreco;
  trabalhoClyon?: boolean;
}): AvisoNoTelemovel {
  const cidade = (p.cidade ?? "").trim();
  const recebe =
    typeof p.recebe === "number" && Number.isFinite(p.recebe) && p.recebe > 0
      ? precoComBase(euros(p.recebe), p.base ?? "total")
      : null;
  const servico = p.servico.trim() || "Trabalho novo";

  if (p.trabalhoClyon) {
    const partes = [servico, quandoNoAviso(p.urgencia), kmNoAviso(p.distanciaKm)].filter(Boolean);
    return {
      title: cidade ? `Trabalho CLYON · ${cidade}` : "Trabalho CLYON",
      body: `${partes.join(" · ")}. ${recebe ? `Valor fixo: recebe ${recebe}. ` : ""}Aceite ou recuse.`,
    };
  }
  const partes = [
    servico,
    quandoNoAviso(p.urgencia),
    kmNoAviso(p.distanciaKm),
    fotografiasNoAviso(p.fotografias),
  ].filter(Boolean);
  return {
    title: cidade ? `Pedido novo · ${cidade}` : "Pedido novo para si",
    body: `${partes.join(" · ")}. ${recebe ? `Sugestão CLYON: recebe ${recebe}.` : "A proposta é sua."}`,
  };
}

/**
 * O CLIENTE RESPONDEU COM OUTRO VALOR — as contas do email da contraproposta
 * (`avisarProfissionalDaProposta`): o valor dele e o que recebe.
 */
export function avisoDaContraproposta(p: {
  pedidoId: number;
  /** O valor proposto, do lado do profissional (sem a taxa da plataforma descontada). */
  valor: number;
  /** O que ele recebe por esse valor. */
  recebe: number;
  base?: BaseDoPreco;
}): AvisoNoTelemovel {
  const b = p.base ?? "total";
  return {
    title: `O cliente respondeu — #${p.pedidoId}`,
    body: `Propõe ${precoComBase(euros(p.valor), b)} — recebe ${precoComBase(euros(p.recebe), b)}. Toque para responder.`,
  };
}

/**
 * Porque é que a negociação acabou para ele. «sem_resposta» (28-10-2026, d12):
 * um Trabalho CLYON que aceitou e que o cliente deixou sem resposta 72 horas.
 */
export type PorqueTerminou = "outro" | "desistiu" | "sem_resposta";

/**
 * FICOU SEM O TRABALHO — a quem perdeu para outro, ou viu o cliente desistir.
 * Sem preços dos outros, e sem nomes.
 */
export function avisoSemOTrabalho(p: { pedidoId: number; porque: PorqueTerminou }): AvisoNoTelemovel {
  if (p.porque === "sem_resposta") {
    return { title: `Trabalho CLYON #${p.pedidoId}`, body: TRABALHO_SEM_EFEITO };
  }
  if (p.porque === "desistiu") {
    return {
      title: NEGOCIACAO_TERMINADA,
      body: `O cliente não seguiu com a sua proposta para o #${p.pedidoId}.`,
    };
  }
  return {
    title: NEGOCIACAO_TERMINADA,
    body:
      `O #${p.pedidoId} ficou com outro profissional. Obrigado por ter respondido — ` +
      "os pedidos novos da sua zona estão em Novos.",
  };
}

/**
 * O ECRÃ «NEGOCIAÇÃO TERMINADA» DA APP — as mesmas razões do painel (os
 * Recusados de `Trabalhos.tsx`): ficou com outro, desistência, cancelado.
 *
 * Na desistência o motor não guarda qual dos lados desistiu (`desistir` em
 * negociacao.ts), e por isso a frase não o inventa.
 */
export const NEGOCIACAO_TERMINADA = "Negociação terminada";

export const PORQUE_A_NEGOCIACAO_TERMINOU: Record<"outro" | "desistida" | "cancelado", string> = {
  outro: "Ficou com outro profissional.",
  desistida: "Um dos lados desistiu da negociação.",
  cancelado: "O pedido foi cancelado.",
};

/**
 * A razão, pelo estado da negociação e do pedido — a mesma regra de
 * `chaveDoGrupo` no painel: morta com o pedido vivo é «outro»; morta com o
 * pedido arquivado ou cancelado é «cancelado».
 */
export function porqueTerminou(p: {
  estado: string;
  pedidoCancelado?: boolean | null;
}): keyof typeof PORQUE_A_NEGOCIACAO_TERMINOU | null {
  if (p.estado === "desistida") return "desistida";
  if (p.estado === "morta") return p.pedidoCancelado ? "cancelado" : "outro";
  return null;
}
