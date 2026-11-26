import { precoComBase, type BaseDoPreco } from "./base-do-preco";
import { tUrgency } from "./translations";
import { TRABALHO_SEM_EFEITO } from "./prazo-do-cliente-clyon";

/**
 * O orçamento tinha validade e o cliente não respondeu (d62, 18-11-2026). d2
 * (18-11-2026): a mesma frase no telemóvel (push e WhatsApp) e no ecrã do
 * trabalho — «fechado: o cliente não respondeu ao orçamento» —, que nunca diz
 * «cancelado».
 */
export const FECHADO_SEM_RESPOSTA = "o cliente não respondeu ao orçamento";

export function textoDoFechoAoParceiro(pedidoId: number): string {
  return `Pedido #${pedidoId} fechado: ${FECHADO_SEM_RESPOSTA}. Saiu da sua lista de pedidos.`;
}

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

/**
 * PEDIDO NOVO — o mesmo aviso curto do WhatsApp (d135, 26-11-2026): o número
 * e o serviço, a localidade, a distância, o ganho estimado. O resto está na
 * ligação.
 *
 *   Negociação:     «CLYON · Pedido novo #668 · Recolha de móveis»
 *                   «Olivais, Lisboa · a 22 km de si. Ganho estimado: 67,50 € (já sem a taxa e sem IVA).»
 *                   (sem valor de partida: «… Sem valor de partida: a proposta é sua.»)
 *   Trabalho CLYON: «CLYON · Trabalho #410 · Recolha de móveis» (d135b, curto como o WhatsApp)
 *                   «Almada · a 12 km de si. Recebe: 120,00 € (valor fixo, já sem a taxa e sem IVA). Dia: 28/11, 09:00. Aceite ou recuse.»
 */
export function avisoDePedidoNovo(p: {
  /** O número do pedido (d135). Sem ele, o título fica sem número. */
  pedidoId?: number | null;
  /** O serviço já em palavras («Recolha de móveis»). */
  servico: string;
  cidade: string | null | undefined;
  urgencia?: string | null;
  distanciaKm?: number | null;
  /** O que ele recebe — o líquido, como no email. Nulo sem valor de partida. */
  recebe?: number | null;
  base?: BaseDoPreco;
  trabalhoClyon?: boolean;
  /** O dia já escrito («28/11, 09:00»), num Trabalho CLYON que o tem (d135b). */
  dia?: string | null;
}): AvisoNoTelemovel {
  const cidade = (p.cidade ?? "").trim();
  const recebe =
    typeof p.recebe === "number" && Number.isFinite(p.recebe) && p.recebe > 0
      ? precoComBase(euros(p.recebe), p.base ?? "total")
      : null;
  const servico = p.servico.trim() || "Trabalho novo";
  const numero = typeof p.pedidoId === "number" && p.pedidoId > 0 ? ` #${p.pedidoId}` : "";
  const km = kmNoAviso(p.distanciaKm);
  const onde = [cidade || null, km ? `a ${km} de si` : null].filter(Boolean).join(" · ");

  if (p.trabalhoClyon) {
    const dia = p.dia?.trim();
    const partes = [
      onde ? `${onde}.` : null,
      recebe ? `Recebe: ${recebe} (valor fixo, já sem a taxa e sem IVA).` : null,
      dia ? `Dia: ${dia}.` : null,
      "Aceite ou recuse.",
    ].filter(Boolean);
    return {
      title: `CLYON · Trabalho${numero} · ${servico}`,
      body: partes.join(" "),
    };
  }
  const ganho = recebe
    ? `Ganho estimado: ${recebe} (já sem a taxa e sem IVA).`
    : "Sem valor de partida: a proposta é sua.";
  return {
    title: `CLYON · Pedido novo${numero} · ${servico}`,
    body: onde ? `${onde}. ${ganho}` : ganho,
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
/*
 * «fechado_sem_resposta» (18-11-2026, d62): o orçamento tinha validade, o
 * cliente não respondeu aos lembretes, e o pedido fechou.
 */
export type PorqueTerminou = "outro" | "desistiu" | "sem_resposta" | "cancelado" | "fechado_sem_resposta";

/**
 * FICOU SEM O TRABALHO — a quem perdeu para outro, ou viu o cliente desistir.
 * Sem preços dos outros, e sem nomes.
 */
export function avisoSemOTrabalho(p: { pedidoId: number; porque: PorqueTerminou; motivo?: string | null }): AvisoNoTelemovel {
  // O pedido foi cancelado (S19, 29-10-2026) — pelo cliente ou pela CLYON, com o motivo quando o há.
  if (p.porque === "cancelado") {
    const motivo = (p.motivo ?? "").trim();
    return {
      title: `Pedido #${p.pedidoId} cancelado`,
      body: `O pedido #${p.pedidoId} foi cancelado.${motivo ? ` Motivo: ${motivo}` : ""}`,
    };
  }
  if (p.porque === "fechado_sem_resposta") {
    return { title: `Pedido #${p.pedidoId} fechado`, body: textoDoFechoAoParceiro(p.pedidoId) };
  }
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

export const PORQUE_A_NEGOCIACAO_TERMINOU: Record<"outro" | "desistida" | "cancelado" | "sem_resposta", string> = {
  outro: "Ficou com outro profissional.",
  desistida: "Um dos lados desistiu da negociação.",
  cancelado: "O pedido foi cancelado.",
  // d2: o fecho pela validade do orçamento não é um cancelamento.
  sem_resposta: `Fechado: ${FECHADO_SEM_RESPOSTA}.`,
};

/** A etiqueta curta do cartão (painel): «fechado: o cliente não respondeu ao orçamento». */
export const ETIQUETA_DO_FECHO_SEM_RESPOSTA = `fechado: ${FECHADO_SEM_RESPOSTA}`;

/**
 * A razão, pelo estado da negociação e do pedido — a mesma regra de
 * `chaveDoGrupo` no painel: morta com o pedido vivo é «outro»; morta com o
 * pedido arquivado ou cancelado é «cancelado».
 */
export function porqueTerminou(p: {
  estado: string;
  pedidoCancelado?: boolean | null;
  /** d2: o pedido fechou pela validade do orçamento (a rota diz-o: `pedidoFechadoSemResposta`). */
  pedidoFechadoSemResposta?: boolean | null;
}): keyof typeof PORQUE_A_NEGOCIACAO_TERMINOU | null {
  if (p.estado === "desistida") return "desistida";
  if (p.estado === "morta") {
    if (p.pedidoCancelado && p.pedidoFechadoSemResposta) return "sem_resposta";
    return p.pedidoCancelado ? "cancelado" : "outro";
  }
  return null;
}

/**
 * O PEDIDO FECHOU PELA VALIDADE DO ORÇAMENTO (d2): arquivado, com o orçamento
 * enviado e o motivo «sem resposta» (`fecharPorFaltaDeResposta`). Um pedido
 * cancelado (pelo cliente ou pela equipa) nunca é isto. Pura.
 */
export function fechadoSemResposta(p: {
  estadoDoPedido: string | null | undefined;
  motivoDoFecho: string | null | undefined;
  propostaEnviada: boolean;
}): boolean {
  return (p.estadoDoPedido ?? "") === "arquivado" && p.motivoDoFecho === "sem_resposta" && p.propostaEnviada;
}
