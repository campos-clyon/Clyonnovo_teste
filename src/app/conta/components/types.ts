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
  | "visao-geral"
  | "pedidos"
  | "dados-pessoais"
  | "faturacao"
  | "notificacoes"
  | "seguranca";

// Estados internos do backoffice agrupados em rótulos simples para o cliente —
// o cliente nunca vê termos como "sem_assistente" ou "atribuido".
const NOVO      = { label: "Novo",       bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" };
const ANALISE   = { label: "Em análise", bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" };
const APROVADO  = { label: "Aprovado",   bg: "bg-cyan-50",    text: "text-cyan-700",    dot: "bg-cyan-500" };
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
