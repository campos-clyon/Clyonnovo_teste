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

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pendente:   { label: "Novo",         bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500" },
  em_analise: { label: "Em análise",   bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-500" },
  aprovado:   { label: "Aprovado",     bg: "bg-cyan-50",    text: "text-cyan-700",   dot: "bg-cyan-500" },
  agendado:   { label: "Agendado",     bg: "bg-violet-50",  text: "text-violet-700", dot: "bg-violet-500" },
  confirmado: { label: "Confirmado",   bg: "bg-emerald-50", text: "text-emerald-700",dot: "bg-emerald-500" },
  em_curso:   { label: "Em curso",     bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500" },
  concluido:  { label: "Concluído",    bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500" },
  cancelado:  { label: "Cancelado",    bg: "bg-slate-100",  text: "text-slate-500",  dot: "bg-slate-400" },
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
};
