import { contaDoCliente, regimeDeIva } from "@/lib/taxas-plataforma";

export interface UserProfile {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  postalCode: string | null;
  addressCity: string | null;
  nif: string | null;
  billingName: string | null;
  billingNif: string | null;
  billingAddress: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  avatarUrl: string | null;
  notifOrderStatus: number;
  notifWeeklyDigest: number;
  notifWhatsapp: number;
  createdAt: string;
}

export interface Order {
  id: number;
  serviceType: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  status: string;
  estimateMin: number | null;
  estimateMax: number | null;
  estimateTotal: number | null;
  precoFinal: number | null;
  precoFinalIva: number | null;
  mensagemCliente: string | null;
  description: string | null;
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  createdAt: string;
  updatedAt: string;
  confirmadoPeloCliente: number;
  canceladoPeloCliente: number;
  recurrenceFrequency: "semanal" | "quinzenal" | null;
  recurringDiscountPercent: number | null;
  clientRating: number | null;
  clientRatingComment: string | null;
  providerId: number | null;
  assignedToId: number | null;
  assignedToName: string | null;
  providerName: string | null;
  providerPhone: string | null;
  historyJson: string | null;
  urgency: string | null;
  floor: string | null;
  hasElevator: string | null;
  parkingDistance: string | null;
  distanceKm: number | null;
  distanceText: string | null;
  filesJson: string | null;
  /** As propostas dos profissionais, quando o pedido está na plataforma. */
  negociacoes?: NegociacaoDoPedido[];
}

export interface NegociacaoDoPedido {
  id: number;
  pedidoId: number;
  estado: string;
  valorAcordado: string | null;
  propostasJson: string | null;
  execucaoEnviadaEm: string | null;
  provaJson: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  profissionalNome: string;
  /** Só depois de o contratar. */
  profissionalTelefone: string | null;
  emiteFatura: number;
  regimeIva: string;
  guiaVerificadaEm: string | null;
  /** A avaliação que o cliente já deu a este trabalho, se deu. */
  estrelas?: number | null;
}

export interface OrderHistoryEntry {
  type: string;
  by?: { id: number; nome: string; role: string } | null;
  message: string;
  createdAt: string;
}

export interface OrderSummary {
  totalOrders: number;
  activeOrders: number;
  lastOrderDate: string | null;
}

export type Section =
  /**
   * A raiz.
   *
   * No telemóvel é o menu de linhas; num ecrã grande não é escolhível — a área
   * da direita mostra os pedidos, que é o que se vem cá ver.
   *
   * Chamava-se "visao-geral" e tinha um ecrã próprio, com métricas, um cartão
   * de boas-vindas e uma lista dos últimos pedidos — a mesma lista que estava
   * na secção ao lado. Duas páginas a mostrar o mesmo, e a pior a ser a
   * primeira que se via.
   */
  | "menu"
  | "pedidos"
  | "carteira"
  | "dados-pessoais"
  | "faturacao"
  | "notificacoes"
  | "seguranca";

// Estados internos do backoffice agrupados em rótulos simples para o cliente —
// o cliente nunca vê termos como "sem_assistente" ou "atribuido".
const NOVO      = { label: "Novo",       bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" };
const ANALISE   = { label: "Em análise", bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" };
const APROVADO  = { label: "Aprovado",   bg: "bg-cyan-50",    text: "text-acao",    dot: "bg-acao" };
const CONFIRM   = { label: "Confirmado", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
const AGENDADO  = { label: "Agendado",   bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500" };
const EM_CURSO  = { label: "Em curso",   bg: "bg-orange-50",  text: "text-orange-700",  dot: "bg-orange-500" };
const CONCLUIDO = { label: "Concluído",  bg: "bg-green-50",   text: "text-green-700",   dot: "bg-green-500" };
const CANCELADO = { label: "Cancelado",  bg: "bg-slate-100",  text: "text-slate-500",   dot: "bg-slate-400" };
const ARQUIVADO = { label: "Arquivado",  bg: "bg-slate-100",  text: "text-slate-500",   dot: "bg-slate-400" };

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  // Bucket "Novo"
  novo:                  NOVO,
  pendente:              NOVO,
  sem_assistente:        NOVO,
  atribuido:             NOVO,
  // Bucket "Em análise"
  em_analise:            ANALISE,
  precisa_info:          ANALISE,
  estimativa_pronta:     ANALISE,
  presencial_recomendado: ANALISE,
  // Bucket "Aprovado"
  aprovado:              APROVADO,
  enviado_cliente:       APROVADO,
  confirmado:            CONFIRM,
  // Bucket "Agendado / Em curso"
  agendado:              AGENDADO,
  em_execucao:           EM_CURSO,
  em_curso:              EM_CURSO,
  // Terminais
  concluido:             CONCLUIDO,
  cancelado:             CANCELADO,
  rejeitado:             CANCELADO,
  arquivado:             ARQUIVADO,
};

export const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis:           "Recolha de Móveis",
  recolha_entulho:          "Recolha de Entulho",
  recolha_monos:            "Recolha de Monos",
  esvaziamento_casa:        "Esvaziamento de Casa",
  esvaziamento_apartamento: "Esvaziamento de Apartamento",
  limpeza_pos_obra:         "Limpeza Pós-Obra",
  limpeza_quintais:         "Limpeza de Quintais",
  mudanca:                  "Mudança",
  recolha_eletrodomesticos: "Recolha de Eletrodomésticos",
  montagem_moveis:          "Montagem e Desmontagem de Móveis",
  jardinagem:               "Jardinagem",
  manutencao_casa:          "Manutenção da Casa",
};

/**
 * Quantas propostas estão à espera de resposta DELE.
 *
 * Só conta a proposta pendente feita pelo profissional: uma proposta sua à
 * espera de resposta não é trabalho seu, e contá-la faria o distintivo dizer
 * que há algo a fazer quando não há — que é a forma mais rápida de o tornar
 * ignorável.
 */
export function propostasAEsperaDoCliente(order: Order): number {
  return (order.negociacoes ?? []).filter((n) => {
    if (n.estado === "aguarda_contratacao") return true;
    if (n.estado !== "aberta") return false;
    try {
      const l = JSON.parse(n.propostasJson ?? "[]") as Array<{
        por: string;
        estado: string;
      }>;
      return l.some((p) => p.por === "profissional" && p.estado === "pendente");
    } catch {
      return false;
    }
  }).length;
}

/**
 * O que este pedido está mesmo a fazer, do ponto de vista do cliente.
 *
 * O cartão mostrava a estimativa e o estado interno da equipa — "Novo" — e
 * ignorava tudo o que se passava na plataforma. Um pedido já contratado por
 * 600 € continuava a dizer "Novo · 741,99 €": os dois números errados e nenhum
 * sinal de que havia alguém do outro lado.
 *
 * A negociação é a fonte quando existe. O estado interno continua a valer para
 * os pedidos que a equipa trata à mão, que são a maioria dos antigos.
 */
export type EstadoNaPlataforma = {
  /** O que se mostra no cartão, ou null quando não há nada a dizer. */
  etiqueta: string | null;
  /** Destaque forte: há algo à espera dele. */
  urgente: boolean;
  /** O valor a mostrar, quando a negociação manda nele. */
  valor: number | null;
  /** O que esse valor é, para a legenda não mentir. */
  legenda: "acordado" | null;
};

export function estadoNaPlataforma(order: Order): EstadoNaPlataforma {
  const negs = order.negociacoes ?? [];
  if (negs.length === 0) {
    return { etiqueta: null, urgente: false, valor: null, legenda: null };
  }

  const fechada = negs.find((n) => n.estado === "acordada");
  if (fechada) {
    const acordado = fechada.valorAcordado != null ? Number(fechada.valorAcordado) : null;
    // O que ele paga, não o que o profissional recebe: é o número que sai da
    // carteira dele, e é o mesmo que o detalhe mostra em "Total a pagar".
    //
    // A conta vem de contaDoCliente e não de um 1.06 escrito aqui: a taxa e o
    // IVA mudam num sítio só, e uma cópia à mão passaria a mentir no dia
    // seguinte. O valor acordado é SEM IVA — o imposto de quem factura soma-se.
    const paga =
      acordado != null
        ? contaDoCliente(acordado, regimeDeIva(fechada.regimeIva)).total
        : null;

    if (fechada.confirmadoEm || fechada.pagoEm) {
      return {
        etiqueta: "Concluído",
        urgente: false,
        valor: paga,
        legenda: "acordado",
      };
    }
    if (fechada.execucaoEnviadaEm) {
      // A única coisa nesta lista que espera uma acção dele com prazo a correr.
      return {
        etiqueta: "Confirmar trabalho",
        urgente: true,
        valor: paga,
        legenda: "acordado",
      };
    }
    return {
      etiqueta: `Contratou ${fechada.profissionalNome}`,
      urgente: false,
      valor: paga,
      legenda: "acordado",
    };
  }

  const aEsperar = propostasAEsperaDoCliente(order);
  if (aEsperar > 0) {
    return {
      etiqueta: aEsperar === 1 ? "1 proposta nova" : `${aEsperar} propostas novas`,
      urgente: true,
      valor: null,
      legenda: null,
    };
  }

  const abertas = negs.filter((n) => n.estado === "aberta").length;
  return {
    etiqueta:
      abertas > 0
        ? `${abertas} profissional${abertas === 1 ? "" : "is"} a responder`
        : null,
    urgente: false,
    valor: null,
    legenda: null,
  };
}
