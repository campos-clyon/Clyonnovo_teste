"use client";

import { useCallback, useEffect, useState } from "react";
import { BUSINESS_PHONE } from "@/lib/seo-data";
import { tElevator, tParking, tUrgency, tService, tEntulho } from "@/lib/translations";
import { firstPositive, legacyPriceText } from "@/lib/quote-price";
import { ELEVATOR_VALUES, PARKING_VALUES, isUnknownAccessValue, origemDoPedido } from "@/lib/acesso";
import { mensagemWhatsApp } from "@/lib/mensagem-whatsapp";
import { linkGoogleMaps } from "@/lib/morada";
import RegistarPedido from "./RegistarPedido";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "sem_assistente" | "pendente" | "atribuido" | "em_analise" | "precisa_info"
  | "estimativa_pronta" | "presencial_recomendado" | "aprovado"
  | "enviado_cliente" | "confirmado" | "em_execucao" | "concluido"
  | "cancelado" | "rejeitado";

type OrderPriority = "baixa" | "normal" | "alta" | "urgente";

type HistoryEntry = {
  type: string;
  by?: { id: number; nome: string; role: string } | null;
  message: string;
  createdAt: string;
};

export type PedidoOrder = {
  id: number;
  serviceType?: string | null;
  description?: string | null;
  filesJson?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  urgency?: string | null;
  /**
   * As duas perguntas do fim do simulador.
   *
   * A fatura decide quem pode sequer receber o pedido — um profissional que
   * não a passa é excluído pela regra de elegibilidade, e sem isto à vista
   * ninguém no backoffice percebia porque é que um pedido chegou a menos
   * gente do que era de esperar.
   *
   * O valor que o cliente conta gastar não entra em cálculo nenhum: serve
   * para sabermos se o que temos para propor está longe do que ele tinha em
   * mente, antes de gastar uma proposta a descobri-lo.
   */
  precisaFatura?: boolean | number | null;
  valorDesejadoCliente?: string | number | null;
  estimateTotal?: string | null;
  estimateMin?: string | null;
  estimateMax?: string | null;
  estimateJson?: string | null;
  distanceKm?: string | null;
  distanceText?: string | null;
  status: OrderStatus;
  priority?: OrderPriority | null;
  notasInternas?: string | null;
  precoFinal?: string | null;
  precoFinalIva?: string | null;
  mensagemCliente?: string | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  historyJson?: string | null;
  historyReadAt?: string | null;
  reviewJson?: string | null;
  rawOrderJson?: string | null;
  dataAgendada?: string | null;
  scheduledDate?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  calendarEventId?: string | null;
  calendarEventUrl?: string | null;
  calendarStatus?: "not_scheduled" | "scheduled" | "updated" | null;
  calendarNotes?: string | null;
  analysisJsonExtended?: string | null;
  /** ID do calendário CLYON onde o evento foi enviado */
  calendarTargetId?: string | null;
  /** Nome legível do calendário de destino */
  calendarTargetName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type GeminiEstimate = {
  status?: string;
  estimatedPriceWithoutVat?: number | null;
  vatAmount?: number | null;
  estimatedPriceWithVat?: number | null;
  estimateMinWithoutVat?: number | null;
  estimateMaxWithoutVat?: number | null;
  difficultyLevel?: number;
  confidence?: "high" | "medium" | "low";
  analysisSource?: string;
  summary?: string;
  assumptions?: string[];
  missingFields?: string[];
  customerMessage?: string;
  internalNotes?: string[];
  // Campos comerciais novos
  teamSize?: string;
  estimatedHoursText?: string;
  recommendation?: "pode_aprovar" | "pedir_fotos" | "pedir_info" | "visita_presencial" | string;
  labor?: {
    estimatedHours?: number;
    peopleCount?: number;
    hourlyRatePerPerson?: number;
    laborCost?: number;
  };
  travel?: {
    distanceKm?: number | null;
    durationText?: string | null;
    distanceCost?: number | null;
    source?: "google" | "manual" | "estimate" | null;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OrderStatus, { label: string; dot: string; badge: string }> = {
  sem_assistente:         { label: "Por atribuir",        dot: "bg-yellow-500",  badge: "bg-yellow-50 border-yellow-200 text-yellow-700" },
  pendente:               { label: "Pendente",            dot: "bg-amber-500",   badge: "bg-amber-50 border-amber-200 text-amber-700" },
  atribuido:              { label: "Atribuído",           dot: "bg-sky-500",     badge: "bg-sky-50 border-sky-200 text-sky-700" },
  em_analise:             { label: "Em análise",          dot: "bg-violet-500",  badge: "bg-violet-50 border-violet-200 text-violet-700" },
  precisa_info:           { label: "Precisa info",        dot: "bg-orange-500",  badge: "bg-orange-50 border-orange-200 text-orange-700" },
  estimativa_pronta:      { label: "Estimativa pronta",   dot: "bg-teal-500",    badge: "bg-teal-50 border-teal-200 text-teal-700" },
  presencial_recomendado: { label: "Presencial rec.",     dot: "bg-indigo-500",  badge: "bg-indigo-50 border-indigo-200 text-indigo-700" },
  aprovado:               { label: "Aprovado",            dot: "bg-cyan-500",    badge: "bg-cyan-50 border-cyan-200 text-cyan-700" },
  enviado_cliente:        { label: "Enviado",             dot: "bg-blue-500",    badge: "bg-blue-50 border-blue-200 text-blue-700" },
  confirmado:             { label: "Confirmado",          dot: "bg-green-500",   badge: "bg-green-50 border-green-200 text-green-700" },
  em_execucao:            { label: "Em execução",         dot: "bg-lime-500",    badge: "bg-lime-50 border-lime-200 text-lime-700" },
  concluido:              { label: "Concluído",           dot: "bg-emerald-500", badge: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  cancelado:              { label: "Cancelado",           dot: "bg-slate-400",   badge: "bg-slate-100 border-slate-200 text-slate-500" },
  rejeitado:              { label: "Rejeitado",           dot: "bg-red-500",     badge: "bg-red-50 border-red-200 text-red-700" },
};

const ALL_STATUSES: OrderStatus[] = [
  "sem_assistente", "pendente", "atribuido", "em_analise", "precisa_info",
  "estimativa_pronta", "presencial_recomendado", "aprovado",
  "confirmado", "em_execucao", "concluido", "cancelado",
];

const SERVICE_TYPES: { value: string; label: string }[] = [
  { value: "recolha_moveis",           label: "Recolha de móveis" },
  { value: "recolha_monos",            label: "Recolha de monos" },
  { value: "recolha_entulho",          label: "Recolha de entulho" },
  { value: "esvaziamento_casa",        label: "Esvaziamento de casa" },
  { value: "esvaziamento_apartamento", label: "Esvaziamento de apartamento" },
  { value: "mudanca",                  label: "Mudança" },
  { value: "outro",                    label: "Outro" },
];

const TABS = [
  { id: "geral",           label: "Geral" },
  { id: "cliente_morada",  label: "Cliente e Morada" },
  { id: "servico_fotos",   label: "Serviço e Fotos" },
  { id: "atribuicao",      label: "Estado e notas" },
  { id: "distribuicao",    label: "Distribuição" },
  { id: "historico",       label: "Histórico" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Muito fácil", 2: "Fácil", 3: "Moderado", 4: "Difícil", 5: "Muito difícil",
};
const DIFFICULTY_COLOR: Record<number, string> = {
  1: "text-emerald-400", 2: "text-green-400", 3: "text-amber-400", 4: "text-orange-400", 5: "text-red-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
// `if (!v)` deixava passar "0"/"0.00" (strings truthy) e os cartões mostravam
// "0,00 €". Zero não é preço — tratar como ausente para as cadeias `??` caírem.
function fmtEur(v?: string | null) {
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) || n <= 0 ? null : `${n.toFixed(2)} €`;
}
function parseEstimate(json?: string | null): GeminiEstimate | null {
  try { return json ? JSON.parse(json) : null; } catch { return null; }
}
function parseHistory(json?: string | null): HistoryEntry[] {
  try { return json ? JSON.parse(json) : []; } catch { return []; }
}
function parseFiles(json?: string | null): string[] {
  try {
    const parsed = json ? JSON.parse(json) : [];
    if (Array.isArray(parsed)) {
      return parsed.map((f: any) => (typeof f === "string" ? f : f?.url ?? f?.path ?? "")).filter(Boolean);
    }
    return [];
  } catch { return []; }
}

/**
 * Normaliza o serviceType para o valor interno canónico.
 * Aceita variantes: "Mudança", "mudança", "moving", "Mudanca" → "mudanca"
 */
function normalizeServiceType(value?: string | null): string {
  if (!value) return "";
  const v = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Normalizar variantes de mudança para o valor interno
  if (v === "mudanca" || v === "moving" || v === "mudança") return "mudanca";
  // Normalizar labels legados para valores internos
  const labelToValue: Record<string, string> = {
    "recolha de moveis":            "recolha_moveis",
    "recolha de monos":             "recolha_monos",
    "recolha de entulho":           "recolha_entulho",
    "esvaziamento de casa":         "esvaziamento_casa",
    "esvaziamento de apartamento":  "esvaziamento_apartamento",
    "outro servico":                "outro",
    "outro serviço":                "outro",
  };
  return labelToValue[v] ?? value.trim();
}

/** Devolve o label PT a mostrar para um serviceType interno */
function getServiceLabel(value?: string | null): string {
  if (!value) return "—";
  const found = SERVICE_TYPES.find((s) => s.value === normalizeServiceType(value));
  return found?.label ?? value;
}

/** Verifica se o serviceType é mudança */
function isMudanca(value?: string | null): boolean {
  return normalizeServiceType(value) === "mudanca";
}

/** Faz parse do rawOrderJson guardado pelo simulador */
function parseRawOrder(json?: string | null): Record<string, any> {
  try { return json ? JSON.parse(json) : {}; } catch { return {}; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pendente;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition";
const selectCls = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition appearance-none cursor-pointer";
const optionCls = "bg-white text-slate-900";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  id: number;
  token: string;
  isAdmin: boolean;
  /** ID do colaborador autenticado (para verificar atribuição) */
  colabId?: number;
  /** Função do colaborador: "assistente" | "admin" | etc. */
  onClose: () => void;
  /**
   * Mostrar o botao de excluir aqui dentro.
   *
   * Por omissao sim, porque e assim que o painel antigo o usa. O painel de
   * negociacoes passa `false`: la o apagar vive na lista, com caixas de
   * seleccao e com a guarda que recusa levar trabalho fechado por confirmar.
   * Duas portas para a mesma accao, uma com guarda e outra sem, e' ter a
   * guarda a fingir.
   *
   * A condicao aqui era `isAdmin` sozinho, por isso nao passar `onDeleted`
   * NAO escondia o botao — so fazia o painel nao reagir ao que ja tinha sido
   * apagado.
   */
  permitirApagar?: boolean;
  onDeleted?: (id: number) => void;
  onUpdated?: (order: PedidoOrder) => void;
};

// ─── Main component ───────────────────────────────────────────────────────────

function _maskName(name: string | null | undefined): string {
  if (!name) return "—";
  return name.trim().split(/\s+/).map((p) => p.charAt(0) + "***").join(" ");
}
function _maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  return d.length < 4 ? "***" : d.slice(0, 3) + "***" + d.slice(-2);
}
function _maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [l, dom] = email.split("@");
  return !dom ? "***@***" : l.charAt(0) + "***@" + dom.charAt(0) + "***";
}

export default function PedidoDetailModal({ id, token, isAdmin, colabId, onClose, permitirApagar = true, onDeleted, onUpdated }: Props) {
  const authHeader = { Authorization: `Bearer ${token}` };

  /*
   * As coordenadas do pedido — a parte INVISÍVEL da morada.
   *
   * O #217 parecia completo neste ecrã e não tinha coordenada nenhuma: a
   * distribuição caiu nas zonas, "Penha de frança" não estava na lista de
   * ninguém, e o pedido "não chegou". Este bloco torna o invisível visível e
   * dá o botão que resolve — o mesmo caminho que a promoção usa.
   */
  const [aLocalizar, setALocalizar] = useState(false);
  const [localizacao, setLocalizacao] = useState<
    { ok: true; lat: number; lng: number } | { ok: false; motivo: string } | null
  >(null);

  async function localizarMorada() {
    if (!order) return;
    setALocalizar(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/localizar`, {
        method: "POST",
        headers: authHeader,
      });
      const dados = await res.json();
      if (!res.ok) setLocalizacao({ ok: false, motivo: dados.error ?? "erro" });
      else if (dados.ok) setLocalizacao({ ok: true, lat: dados.lat, lng: dados.lng });
      else setLocalizacao({ ok: false, motivo: dados.motivo ?? "desconhecido" });
    } catch {
      setLocalizacao({ ok: false, motivo: "rede" });
    } finally {
      setALocalizar(false);
    }
  }

  const [order, setOrder] = useState<PedidoOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("geral");
  const [aDescarregar, setADescarregar] = useState<string | null>(null);

  /*
   * Descarregar uma foto do Blob.
   *
   * Um <a download> simples não serve: as fotos vivem noutro domínio
   * (Vercel Blob) e o atributo `download` é IGNORADO em links de outra
   * origem — o browser abria a imagem em vez de a guardar. Vai-se buscar o
   * ficheiro primeiro e entrega-se como objecto local; se a rede falhar,
   * abre-se num separador para a pessoa guardar à mão — pior que descarregar,
   * melhor que um botão morto.
   */
  async function descarregarFoto(url: string, nome: string) {
    setADescarregar(url);
    try {
      /*
       * Pela NOSSA origem, nunca direito ao Blob: o Blob da Vercel não manda
       * cabeçalhos CORS, o fetch directo falhava, e o plano B (abrir num
       * separador) morria no bloqueador de popups a partir do segundo —
       * "Descarregar todas" abria duas e não descarregava nenhuma. O proxy
       * de admin entrega a foto com ordem de guardar e sem CORS no caminho.
       */
      const res = await fetch(
        `/api/admin/fotos?url=${encodeURIComponent(url)}&nome=${encodeURIComponent(nome)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const extensao =
        url.match(/\.(jpe?g|png|gif|webp|avif|heic|mp4|mov|webm)(?:\?|$)/i)?.[1] ??
        (blob.type.split("/")[1] || "jpg");
      const alvo = document.createElement("a");
      alvo.href = URL.createObjectURL(blob);
      alvo.download = `${nome}.${extensao}`;
      document.body.appendChild(alvo);
      alvo.click();
      alvo.remove();
      URL.revokeObjectURL(alvo.href);
    } catch {
      window.open(url, "_blank", "noopener");
    } finally {
      setADescarregar(null);
    }
  }

  /*
   * Todas de uma vez, em série com meio segundo de intervalo — o browser
   * pergunta uma vez se autoriza vários downloads e o resto segue. Um zip
   * exigiria uma biblioteca; para uma dúzia de fotos, isto chega.
   */
  async function descarregarTodas(urls: string[], pedidoId: number) {
    for (let i = 0; i < urls.length; i++) {
      await descarregarFoto(urls[i], `pedido-${pedidoId}-foto-${i + 1}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const [showAcceptPrompt, setShowAcceptPrompt] = useState(false);
  const [showPedirInfo, setShowPedirInfo] = useState(false);
  const [pedirInfoText, setPedirInfoText] = useState("");
  const [pedirInfoSending, setPedirInfoSending] = useState(false);

  const isOwner = order?.assignedToId != null && order.assignedToId === colabId;
  const shouldMask = !isAdmin && !isOwner;

  // Edit state
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editServiceType, setEditServiceType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUrgency, setEditUrgency] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editHasElevator, setEditHasElevator] = useState("");
  const [editParkingDistance, setEditParkingDistance] = useState("");
  const [editDistanceKm, setEditDistanceKm] = useState("");
  const [distanceCalculating, setDistanceCalculating] = useState(false);
  const [distanceMsg, setDistanceMsg] = useState("");
  const [editPrecoFinal, setEditPrecoFinal] = useState("");
  const [editPrecoFinalIva, setEditPrecoFinalIva] = useState("");
  // Conversor big bags → sacos (só admin). 1 big bag = 42 sacos no chão.
  const [bigBags, setBigBags] = useState("");
  const [editMensagemCliente, setEditMensagemCliente] = useState("");
  const [editNotasInternas, setEditNotasInternas] = useState("");
  const [editStatus, setEditStatus] = useState<OrderStatus>("pendente");
  const [editPriority, setEditPriority] = useState<OrderPriority>("normal");
  const [editDataAgendada, setEditDataAgendada] = useState("");

  // Assistentes (para dropdown de atribuição — apenas admin)

  // Calendar / scheduling state (Atribuição tab block)
  const [schedDate, setSchedDate] = useState("");
  const [schedStart, setSchedStart] = useState("");
  const [schedEnd, setSchedEnd] = useState("");
  const [schedNotes, setSchedNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [schedMsg, setSchedMsg] = useState("");
  const [schedError, setSchedError] = useState("");

  // Calendar confirm modal state
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [cmTitle, setCmTitle] = useState("");
  const [cmDate, setCmDate] = useState("");
  const [cmStart, setCmStart] = useState("");
  const [cmEnd, setCmEnd] = useState("");
  const [cmClientName, setCmClientName] = useState("");
  const [cmClientPhone, setCmClientPhone] = useState("");
  const [cmClientEmail, setCmClientEmail] = useState("");
  const [cmServiceType, setCmServiceType] = useState("");
  const [cmDescription, setCmDescription] = useState("");
  const [cmAddress, setCmAddress] = useState("");
  const [cmOriginAddress, setCmOriginAddress] = useState("");
  const [cmDestinationAddress, setCmDestinationAddress] = useState("");
  const [cmRoute, setCmRoute] = useState("");
  const [cmNotes, setCmNotes] = useState("");
  const [cmScheduling, setCmScheduling] = useState(false);
  const [cmMsg, setCmMsg] = useState("");
  const [cmError, setCmError] = useState("");
  const [cmTargetName, setCmTargetName] = useState<string | null>(null);
  const [cmApiDisabledUrl, setCmApiDisabledUrl] = useState<string | null>(null);
  const [cmErrorCode, setCmErrorCode] = useState<string | null>(null);
  const [cmCalendarDescription, setCmCalendarDescription] = useState("");
  const [cmDescriptionLoading, setCmDescriptionLoading] = useState(false);

  // Accept state (assistente aceitar pedido da fila geral)
  const [accepting, setAccepting] = useState(false);
  const [acceptMsg, setAcceptMsg] = useState("");

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState<string | null>(null);

  function populateEdit(o: PedidoOrder) {
    // Fallback ao rawOrderJson (o simulador guarda lá quando o campo top-level
    // ainda não existia) e a `originAccess` para mudanças.
    let raw: any = {};
    try { raw = o.rawOrderJson ? JSON.parse(o.rawOrderJson) : {}; } catch { raw = {}; }
    const orig = raw.originAccess ?? {};

    setEditContactName(o.contactName ?? "");
    setEditContactPhone(o.contactPhone ?? "");
    setEditContactEmail(o.contactEmail ?? "");
    // normalizeServiceType retorna o valor interno canónico (ex: "mudanca", "recolha_moveis")
    setEditServiceType(normalizeServiceType(o.serviceType));
    setEditDescription(o.description ?? "");
    setEditUrgency(o.urgency ?? "");
    setEditAddress(o.address ?? raw.address?.formattedAddress ?? "");
    setEditCity(o.city ?? raw.address?.city ?? "");
    setEditPostalCode(o.postalCode ?? raw.address?.postalCode ?? "");
    setEditFloor(o.floor ?? orig.floor ?? raw.floor ?? "");
    setEditHasElevator(o.hasElevator ?? orig.hasElevator ?? raw.hasElevator ?? "");
    setEditParkingDistance(o.parkingDistance ?? orig.parkingDistance ?? raw.parkingDistance ?? "");
    setEditDistanceKm(o.distanceKm ?? "");
    setDistanceMsg("");
    setEditPrecoFinal(o.precoFinal ?? "");
    setEditPrecoFinalIva(o.precoFinalIva ?? "");
    setEditMensagemCliente(o.mensagemCliente ?? "");
    setEditNotasInternas(o.notasInternas ?? "");
    setEditStatus(o.status);
    setEditPriority(o.priority ?? "normal");
    setEditDataAgendada(o.dataAgendada ? o.dataAgendada.slice(0, 16) : "");
    setSchedDate(o.scheduledDate ?? "");
    setSchedStart(o.scheduledStartTime ?? "");
    setSchedEnd(o.scheduledEndTime ?? "");
    setSchedNotes(o.calendarNotes ?? "");
  }

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/pedidos/${id}`, { headers: authHeader });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Pedido não encontrado");
      if (!data?.order) throw new Error("Resposta inválida do servidor");
      setOrder(data.order);
      populateEdit(data.order);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  useEffect(() => { void fetchOrder(); }, [fetchOrder]);

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !showDelete && !lightbox) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showDelete, lightbox]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /**
   * Calcula a distância da base CLYON até à morada do serviço via /api/maps/distance
   * e persiste distanceKm + distanceText no pedido. Para mudança usa a morada de origem.
   * Devolve { distanceKm, durationText } ou null se não foi possível calcular.
   * @param opts.persist  quando true, guarda a distância na DB e actualiza o estado
   * @param opts.silent   quando true, não escreve mensagens na UI (usado no fluxo de recálculo)
   */
  async function calcularDistancia(
    opts: { persist?: boolean; silent?: boolean } = {}
  ): Promise<{ distanceKm: number; durationText: string | null } | null> {
    if (!order) return null;
    const { persist = true, silent = false } = opts;
    const raw = parseRawOrder(order.rawOrderJson);
    const mov = isMudanca(order.serviceType);
    // Destino do cálculo base→morada (para mudança, a morada de origem)
    const addr = mov
      ? (raw.originAddress?.formattedAddress ?? raw.originAddress?.address ?? order.address ?? "")
      : (order.address ?? raw.address?.formattedAddress ?? "");
    const geo = mov ? raw.originAddress : raw.address;
    if (!addr && !geo?.lat) {
      if (!silent) setDistanceMsg("Sem morada para calcular. Preencha a morada primeiro.");
      return null;
    }
    if (!silent) { setDistanceCalculating(true); setDistanceMsg(""); }
    try {
      const res = await fetch("/api/maps/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          destination: { formattedAddress: addr || undefined, lat: geo?.lat, lng: geo?.lng, placeId: geo?.placeId },
        }),
      });
      const data = await res.json();
      if (!data?.ok || typeof data.distanceKm !== "number") {
        if (!silent) setDistanceMsg(data?.customerMessage ?? "Não foi possível calcular a distância. Insira o valor manualmente.");
        return null;
      }
      const distanceKm: number = data.distanceKm;
      const durationText: string | null = data.durationText ?? null;
      const distanceText = durationText
        ? `${String(distanceKm).replace(".", ",")} km · ${durationText}`
        : `${String(distanceKm).replace(".", ",")} km`;

      if (persist) {
        const saveRes = await fetch(`/api/admin/pedidos/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ distanceKm: String(distanceKm), distanceText }),
        });
        if (saveRes.ok) {
          const updated = await saveRes.json();
          setOrder(updated.order ?? updated);
        }
        setEditDistanceKm(String(distanceKm));
      }
      if (!silent) setDistanceMsg(`Distância calculada: ${distanceText}`);
      return { distanceKm, durationText };
    } catch {
      if (!silent) setDistanceMsg("Erro ao calcular distância. Insira o valor manualmente.");
      return null;
    } finally {
      if (!silent) setDistanceCalculating(false);
    }
  }

  /** Botão manual: calcula a distância e guarda-a no pedido. */
  async function handleCalcularDistancia() {
    setDistanceCalculating(true);
    setDistanceMsg("");
    await calcularDistancia({ persist: true, silent: false });
  }

  /** Guarda a distância inserida manualmente pelo admin (km → distanceKm + distanceText). */
  async function handleGuardarDistanciaManual() {
    if (!order) return;
    const km = parseFloat(editDistanceKm.replace(",", "."));
    if (isNaN(km) || km <= 0) { setDistanceMsg("Insira um valor de km válido."); return; }
    setDistanceCalculating(true);
    setDistanceMsg("");
    try {
      const distanceText = `${String(km).replace(".", ",")} km (manual)`;
      const saveRes = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ distanceKm: String(km), distanceText }),
      });
      if (!saveRes.ok) throw new Error();
      const updated = await saveRes.json();
      setOrder(updated.order ?? updated);
      setDistanceMsg(`Distância manual guardada: ${km} km. Recalcule a estimativa para aplicar ao preço.`);
    } catch {
      setDistanceMsg("Erro ao guardar a distância manual.");
    } finally {
      setDistanceCalculating(false);
    }
  }

  async function handleRecalcularEstimativa() {
    if (!order) return;
    setRecalculating(true);
    setSaveMsg("");
    setError("");
    try {
      // Reconstituir rawOrderJson para enviar contexto completo ao Gemini
      const rawJson = order.rawOrderJson ? (() => { try { return JSON.parse(order.rawOrderJson!); } catch { return {}; } })() : {};

      // ── Resolver distância ANTES de estimar ──────────────────────────────
      // Prioridade: km manual (campo do admin) → distanceKm já guardado →
      // distanceFromBase do rawOrderJson → cálculo automático via Google Maps.
      // Sem distância o Gemini não consegue precificar a deslocação corretamente.
      const manualKm = editDistanceKm ? parseFloat(editDistanceKm.replace(",", ".")) : NaN;
      let resolvedKm: number | null =
        !isNaN(manualKm) && manualKm > 0
          ? manualKm
          : order.distanceKm
            ? Number(order.distanceKm)
            : typeof rawJson.distanceFromBase?.distanceKm === "number"
              ? rawJson.distanceFromBase.distanceKm
              : null;
      let resolvedDuration: string | null =
        rawJson.distanceFromBase?.durationText ?? null;

      if (resolvedKm === null) {
        const calc = await calcularDistancia({ persist: true, silent: true });
        if (calc) { resolvedKm = calc.distanceKm; resolvedDuration = calc.durationText; }
      }

      const orderData = {
        serviceType: order.serviceType ?? rawJson.serviceType ?? undefined,
        description: order.description ?? rawJson.description ?? undefined,
        address: order.address
          ? { formattedAddress: order.address, city: order.city ?? "" }
          : rawJson.address ?? undefined,
        city: order.city ?? rawJson.address?.city ?? undefined,
        floor: order.floor ?? rawJson.floor ?? undefined,
        hasElevator: order.hasElevator ?? rawJson.hasElevator ?? undefined,
        parkingDistance: order.parkingDistance ?? rawJson.parkingDistance ?? undefined,
        distanceFromBase:
          resolvedKm !== null
            ? { distanceKm: resolvedKm, durationText: resolvedDuration ?? undefined }
            : rawJson.distanceFromBase ?? undefined,
        urgency: order.urgency ?? rawJson.urgency ?? undefined,
        // Mudança: passar origem/destino/acesso
        originAddress: rawJson.originAddress ?? undefined,
        destinationAddress: rawJson.destinationAddress ?? undefined,
        originAccess: rawJson.originAccess ?? undefined,
        destinationAccess: rawJson.destinationAccess ?? undefined,
        movingDistance: rawJson.movingDistance ?? undefined,
        // Entulho
        entulhoState: rawJson.entulhoState ?? undefined,
        entulhoQuantidade: rawJson.entulhoQuantidade ?? undefined,
        heavyItems: rawJson.heavyItems ?? undefined,
        files: order.filesJson
          ? (() => { try { const f = JSON.parse(order.filesJson!); return Array.isArray(f) ? f.map((u: unknown, i: number) => ({ id: String(i), name: `foto${i}`, size: 0 })) : []; } catch { return []; } })()
          : [],
      };

      const res = await fetch("/api/simulator/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ order: orderData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao recalcular estimativa.");

      // Extrair valores numéricos para preencher campos da DB automaticamente
      const recommended = typeof data.estimatedPriceWithoutVat === "number" ? data.estimatedPriceWithoutVat : null;
      const minVal = typeof data.estimateMinWithoutVat === "number" ? data.estimateMinWithoutVat : recommended;
      const maxVal = typeof data.estimateMaxWithoutVat === "number" ? data.estimateMaxWithoutVat : recommended;
      const withVat = typeof data.estimatedPriceWithVat === "number" ? data.estimatedPriceWithVat : (recommended ? Math.round(recommended * 1.23 * 100) / 100 : null);

      // Guardar estimateJson + campos DECIMAL na mesma operação
      const patchBody: Record<string, unknown> = {
        estimateJson: JSON.stringify(data),
        ...(minVal !== null ? { estimateMin: String(minVal) } : {}),
        ...(maxVal !== null ? { estimateMax: String(maxVal) } : {}),
        ...(recommended !== null ? { estimateTotal: String(recommended) } : {}),
        // Pré-preencher precoFinal/precoFinalIva como sugestão (admin pode editar)
        ...(recommended !== null ? { precoFinal: String(recommended) } : {}),
        ...(withVat !== null ? { precoFinalIva: String(withVat) } : {}),
        // Persistir a distância considerada no cálculo
        ...(resolvedKm !== null
          ? {
              distanceKm: String(resolvedKm),
              distanceText: resolvedDuration
                ? `${String(resolvedKm).replace(".", ",")} km · ${resolvedDuration}`
                : `${String(resolvedKm).replace(".", ",")} km`,
            }
          : {}),
      };

      const saveRes = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(patchBody),
      });
      if (!saveRes.ok) {
        const saveErr = await saveRes.json().catch(() => ({}));
        throw new Error(saveErr?.error || "Erro ao guardar nova estimativa.");
      }
      const updated = await saveRes.json();
      setOrder(updated.order ?? updated);

      // Actualizar campos editáveis localmente para reflectir a sugestão
      if (recommended !== null) setEditPrecoFinal(String(recommended));
      if (withVat !== null) setEditPrecoFinalIva(String(withVat));

      // Mensagem contextual com base na fonte da estimativa
      const src = data.analysisSource ?? data.source ?? "";
      const isRef = src === "gemini_reference" || src === "fallback_reference";
      const missing: string[] = data.missingFields?.filter(Boolean) ?? [];
      if (isRef && missing.length > 0) {
        setSaveMsg(`Estimativa de referência gerada. Actualize: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " e outros" : ""}.`);
      } else if (isRef) {
        setSaveMsg("Estimativa de referência gerada — confirme antes de enviar ao cliente.");
      } else if (recommended) {
        setSaveMsg(`Estimativa calculada: ${recommended} € s/IVA (${withVat} € c/IVA). Pode editar antes de guardar.`);
      } else {
        setSaveMsg("Estimativa calculada com sucesso pelo Gemini.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao recalcular estimativa.");
    } finally {
      setRecalculating(false);
    }
  }

  async function handleSave() {
    if (!order) return;
    setSaving(true);
    setSaveMsg("");
    setError("");
    try {
      const body: Record<string, unknown> = {
        contactName: editContactName || null,
        contactPhone: editContactPhone || null,
        contactEmail: editContactEmail || null,
        serviceType: editServiceType || null,
        description: editDescription || null,
        urgency: editUrgency || null,
        address: editAddress || null,
        city: editCity || null,
        postalCode: editPostalCode || null,
        floor: editFloor || null,
        hasElevator: editHasElevator || null,
        parkingDistance: editParkingDistance || null,
        mensagemCliente: editMensagemCliente || null,
        notasInternas: editNotasInternas || null,
        dataAgendada: editDataAgendada || null,
      };

      /*
       * O estado só vai se tiver mudado.
       *
       * Ia sempre — `status: editStatus` — e `editStatus` é a cópia feita no
       * instante em que o modal abriu. Duas consequências, as duas más:
       *
       *   · se o pedido tiver avançado entretanto (outra pessoa no
       *     backoffice, o cliente a confirmar, uma rota automática), gravar
       *     uma vírgula na descrição REPUNHA o estado antigo;
       *   · e uma mudança de estado dispara email e notificação ao cliente.
       *     Ou seja: corrigir um acento numa morada podia mandar-lhe uma
       *     mensagem a dizer que o pedido tinha voltado atrás.
       *
       * O filtro do lado da base ignora o que vier `undefined`, por isso não
       * enviar é o mesmo que não escrever — e deixa de haver forma de
       * disparar correspondência sem querer.
       */
      if (editStatus !== order.status) body.status = editStatus;
      if (editPriority !== (order.priority ?? "normal")) body.priority = editPriority;
      if (isAdmin) {
        body.precoFinal = editPrecoFinal || null;
        body.precoFinalIva = editPrecoFinalIva || null;
      }
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Não foi possível guardar as alterações.");
      }
      const updated = data?.order ?? order;
      setOrder(updated);
      populateEdit(updated);
      setSaveMsg("Guardado com sucesso!");
      setTimeout(() => setSaveMsg(""), 3000);
      onUpdated?.(updated);
    } catch (e: any) {
      console.error("[Pedido save error]", e);
      setError(e.message || "Não foi possível guardar as alterações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!order) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao excluir");
      onDeleted?.(order.id);
      onClose();
    } catch (e: any) {
      setError(e.message);
      setDeleting(false);
    }
  }

  async function handleStatusQuick(newStatus: OrderStatus) {
    if (!order) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao atualizar status");
      const updated = data?.order ?? { ...order, status: newStatus };
      setOrder(updated);
      setEditStatus(newStatus);
      setSaveMsg("Status atualizado!");
      setTimeout(() => setSaveMsg(""), 3000);
      onUpdated?.(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!order) return;
    const motivo = window.prompt("Motivo da rejeição (fica guardado nas notas internas):");
    if (motivo === null) return; // cancelado pelo utilizador
    setSaving(true);
    try {
      const notasAtualizadas = motivo.trim()
        ? `${editNotasInternas ? `${editNotasInternas}\n` : ""}[Rejeitado] ${motivo.trim()}`
        : editNotasInternas;
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelado", notasInternas: notasAtualizadas || null }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Erro ao rejeitar pedido");
      const updated = data?.order ?? { ...order, status: "cancelado", notasInternas: notasAtualizadas };
      setOrder(updated);
      setEditStatus("cancelado");
      setEditNotasInternas(notasAtualizadas ?? "");
      setSaveMsg("Pedido rejeitado.");
      setTimeout(() => setSaveMsg(""), 3000);
      onUpdated?.(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAccept() {
    if (!order) return;
    setAccepting(true);
    setAcceptMsg("");
    setError("");
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/accept`, {
        method: "POST",
        headers: authHeader,
      });
      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Não foi possível aceitar o pedido.");
      }
      const updated = data?.order ?? order;
      setOrder(updated);
      populateEdit(updated);
      setAcceptMsg("Pedido aceite com sucesso!");
      setTimeout(() => setAcceptMsg(""), 4000);
      onUpdated?.(updated);
    } catch (e: any) {
      setError(e.message || "Erro ao aceitar o pedido.");
    } finally {
      setAccepting(false);
    }
  }

  async function handleSchedule() {
    if (!order) return;
    if (!schedDate || !schedStart || !schedEnd) {
      setSchedError("Preencha a data, hora de início e hora de fim.");
      return;
    }
    setScheduling(true);
    setSchedMsg("");
    setSchedError("");
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/calendar`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: schedDate,
          scheduledStartTime: schedStart,
          scheduledEndTime: schedEnd,
          calendarNotes: schedNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Erro ao agendar serviço.");
      }
      const updated = data?.order ?? order;
      setOrder(updated);
      populateEdit(updated);
      setSchedMsg(data.message ?? "Serviço agendado com sucesso.");
      setTimeout(() => setSchedMsg(""), 5000);
      onUpdated?.(updated);

      // Auto-open Google Calendar in new tab
      if (data.calendarEventUrl) {
        window.open(data.calendarEventUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      setSchedError(e.message || "Não foi possível agendar o serviço. Tente novamente.");
    } finally {
      setScheduling(false);
    }
  }

  /** Pré-preenche o modal de confirmação com os dados do pedido */
  function populateCalendarModal(o: PedidoOrder) {
    const raw = parseRawOrder(o.rawOrderJson);
    const isMov = isMudanca(o.serviceType);
    const originAddr =
      raw.originAddress?.formattedAddress ??
      raw.originAddress?.address ??
      o.address ??
      "";
    const destAddr =
      raw.destinationAddress?.formattedAddress ??
      raw.destinationAddress?.address ??
      "";
    const distText =
      raw.movingDistance?.distanceText ??
      (o.distanceKm ? `${o.distanceKm} km` : "");

    const serviceLabel = getServiceLabel(o.serviceType);
    const title = [o.contactName, serviceLabel].filter(Boolean).join(" - ");

    setCmTitle(title);
    setCmDate(o.scheduledDate ?? "");
    setCmStart(o.scheduledStartTime ?? "");
    setCmEnd(o.scheduledEndTime ?? "");
    setCmClientName(o.contactName ?? "");
    setCmClientPhone(o.contactPhone ?? "");
    setCmClientEmail(o.contactEmail ?? "");
    setCmServiceType(serviceLabel);
    setCmDescription(o.description ?? "");
    setCmAddress(isMov ? "" : (o.address ?? ""));
    setCmOriginAddress(isMov ? originAddr : "");
    setCmDestinationAddress(isMov ? destAddr : "");
    setCmRoute(isMov ? distText : "");
    setCmNotes(o.calendarNotes ?? "");
    setCmMsg("");
    setCmError("");
    setCmTargetName(null);
    setCmApiDisabledUrl(null);
    setCmErrorCode(null);
    setCmCalendarDescription("");
  }

  function openCalendarModal() {
    if (!order) return;
    populateCalendarModal(order);
    setCalendarModalOpen(true);
    // Fetch Gemini-powered preview description in background
    setCmDescriptionLoading(true);
    fetch(`/api/admin/pedidos/${order.id}/calendar/preview`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (data?.calendarDescription) {
          setCmCalendarDescription(data.calendarDescription);
        }
      })
      .catch(() => {
        // Ignore — user can still schedule without a pre-filled description
      })
      .finally(() => setCmDescriptionLoading(false));
  }

  async function handleScheduleModal() {
    if (!order) return;
    if (!cmDate || !cmStart || !cmEnd) {
      setCmError("Data, hora de início e hora de fim são obrigatórios.");
      return;
    }
    setCmScheduling(true);
    setCmMsg("");
    setCmError("");
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/calendar`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cmTitle || undefined,
          scheduledDate: cmDate,
          scheduledStartTime: cmStart,
          scheduledEndTime: cmEnd,
          customerName: cmClientName || undefined,
          customerPhone: cmClientPhone || undefined,
          customerEmail: cmClientEmail || undefined,
          serviceType: cmServiceType || undefined,
          serviceDescription: cmDescription || undefined,
          address: cmAddress || undefined,
          originAddress: cmOriginAddress || undefined,
          destinationAddress: cmDestinationAddress || undefined,
          route: cmRoute || undefined,
          calendarNotes: cmNotes || undefined,
          calendarDescription: cmCalendarDescription || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        if (data?.errorCode === "calendar_api_disabled" && data?.enableUrl) {
          setCmApiDisabledUrl(data.enableUrl);
        }
        setCmErrorCode(data?.errorCode ?? null);
        throw new Error(data?.error || "Erro ao agendar serviço.");
      }
      setCmApiDisabledUrl(null);
      setCmErrorCode(null);
      setCmCalendarDescription("");
      const updated = data?.order ?? order;
      setOrder(updated);
      populateEdit(updated);
      // Sync Atribuição tab fields too
      setSchedDate(updated.scheduledDate ?? "");
      setSchedStart(updated.scheduledStartTime ?? "");
      setSchedEnd(updated.scheduledEndTime ?? "");
      setSchedNotes(updated.calendarNotes ?? "");

      setCmTargetName(data.calendarTargetName ?? null);
      setCmMsg(data.message ?? "Evento criado na agenda da organização com sucesso.");
      onUpdated?.(updated);
    } catch (e: any) {
      setCmError(e.message || "Não foi possível agendar o serviço. Tente novamente.");
    } finally {
      setCmScheduling(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────���

  return (
    // Ecrã inteiro, como o resto do backoffice.
    //
    // Estava limitado a 1800px de largura e 97% da altura, com margem à
    // volta e cantos arredondados. Num monitor grande sobrava moldura e
    // faltava espaço à informação — e o pedido é o ecrã onde se trabalha
    // mais tempo, não uma caixa de confirmação.
    <div className="fixed inset-0 z-50 bg-[#e8e8ff]">
      <div
        className="relative flex h-full w-full flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
            <svg className="h-8 w-8 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-slate-500">A carregar pedido...</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && !order && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-red-400/20 bg-red-400/10">
              <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-900">{error}</p>
            <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">Fechar</button>
          </div>
        )}

        {/* ── Content ── */}
        {!loading && order && (() => {
          const est = parseEstimate(order.estimateJson);
          const history = parseHistory(order.historyJson);
          const files = parseFiles(order.filesJson);
          const waPhone = (order.contactPhone ?? BUSINESS_PHONE).replace(/\D/g, "");
          // Era uma frase igual para toda a gente, com o nome completo e o
          // nome interno do serviço ("recolha_moveis"). Quem a usava tinha de
          // escrever tudo à mão a seguir. Agora parte do que foi recolhido.
          const waMsg = encodeURIComponent(
            mensagemWhatsApp({
              id: order.id,
              contactName: order.contactName,
              serviceType: order.serviceType,
              address: order.address,
              city: order.city,
              urgency: order.urgency,
              fotosRecebidas: files.length,
              fotosNaoEnviadas: Number(
                (parseRawOrder(order.rawOrderJson) as Record<string, unknown>)?.fotosNaoEnviadas ?? 0,
              ),
              precoFinalIva: order.precoFinalIva,
            }),
          );

          return (
            <div className="flex flex-col" style={{ height: "94vh", maxHeight: "94vh" }}>
              {/* ── Header (compacto — 1 linha) ── */}
              <div className="flex-shrink-0 border-b border-slate-100 px-4 py-2.5 sm:px-5">
                {/*
                  EMPILHADO em telemóvel, uma linha só a partir de lg.

                  Era uma linha única sempre: à esquerda o nome e os chips (com
                  wrap), à direita SETE botões com flex-shrink-0 — que recusa
                  encolher. Num ecrã de 400px os dois lados dobravam um por
                  cima do outro: "Por atribuir" em cima do "Aceitar pedido", o
                  nome cortado a "Isab…". Empilhar não é menos bonito — é o
                  que cabe.
                */}
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                  <div className="min-w-0 flex items-center gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400 leading-tight">
                        {/* Dizia "Simulador" a todos os pedidos. Um contacto
                            de quatro campos parecia um pedido do simulador com
                            tudo em falta — e a equipa procurava dados que
                            nunca tinham sido pedidos. */}
                        #{order.id} · {origemDoPedido(order.rawOrderJson).label}
                      </p>
                      <h2 className="text-base font-bold text-slate-900 truncate leading-tight">
                        {shouldMask ? _maskName(order.contactName) : (order.contactName ?? "Cliente sem nome")}
                      </h2>
                    </div>
                    <StatusBadge status={order.status} />
                    {order.priority && order.priority !== "normal" && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        order.priority === "urgente" ? "text-red-600" :
                        order.priority === "alta" ? "text-amber-600" : "text-slate-500"
                      }`}>{order.priority}</span>
                    )}
                    {order.assignedToName ? (
                      <span className="text-[11px] text-slate-500 truncate">
                        <span className="font-semibold text-sky-600">{order.assignedToName}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-yellow-700">
                        Fila geral
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{fmt(order.createdAt)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 lg:flex-shrink-0">
                    {/* Aceitar — marca o pedido como tomado por quem está a
                        trabalhar nele. Antes só aparecia ao assistente com o
                        pedido na fila geral; sem essa função, é a administração
                        que o toma. */}
                    {!order.assignedToId && (
                      <button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {accepting ? "A aceitar..." : "Aceitar pedido"}
                      </button>
                    )}
                    {/* Guardar */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition"
                    >
                      {saving ? (
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Guardar
                    </button>
                    {/* Aprovar */}
                    <button
                      onClick={() => handleStatusQuick("aprovado")}
                      disabled={saving}
                      className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-400/20 disabled:opacity-60 transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Aprovar
                    </button>
                    {/* Pedir info */}
                    <button
                      onClick={() => { setPedirInfoText(""); setShowPedirInfo(true); }}
                      disabled={saving}
                      className="hidden sm:flex items-center gap-1.5 rounded-xl border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-400/20 disabled:opacity-60 transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pedir info
                    </button>
                    {/* Arquivar */}
                    <button
                      onClick={handleReject}
                      disabled={saving}
                      className="hidden sm:flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-400/20 disabled:opacity-60 transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M6 8l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M10 12h4" />
                      </svg>
                      Arquivar
                    </button>
                    {/* WhatsApp */}
                    {shouldMask ? (
                      <button
                        type="button"
                        onClick={() => setShowAcceptPrompt(true)}
                        className="hidden md:flex items-center gap-1.5 rounded-xl border border-green-400/30 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-400/20 transition"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.528 5.845L.057 23.455a.5.5 0 00.614.6l5.757-1.508A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.933 0-3.746-.523-5.302-1.434l-.38-.222-3.938 1.031 1.046-3.82-.247-.393A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                        </svg>
                        WhatsApp
                      </button>
                    ) : (
                      <a
                        href={`https://wa.me/${waPhone}?text=${waMsg}`}
                        target="_blank" rel="noreferrer"
                        className="hidden md:flex items-center gap-1.5 rounded-xl border border-green-400/30 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-400/20 transition"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.528 5.845L.057 23.455a.5.5 0 00.614.6l5.757-1.508A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.933 0-3.746-.523-5.302-1.434l-.38-.222-3.938 1.031 1.046-3.82-.247-.393A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                        </svg>
                        WhatsApp
                      </a>
                    )}
                    {/* Agendar serviço — pedido aprovado/confirmado/em_execucao */}
                    {(["aprovado", "confirmado", "em_execucao"].includes(order.status) || !!order.scheduledDate) && (
                        /* Both states (scheduled or not) open the confirm modal.
                           "Abrir no Google Calendar" is shown after scheduling inside the modal itself. */
                        <button
                          onClick={openCalendarModal}
                          className="hidden lg:flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-400/20 transition"
                          title={order.calendarEventId ? `Atualizar agenda (agendado para ${order.scheduledDate} ${order.scheduledStartTime}–${order.scheduledEndTime})` : "Agendar no Google Calendar"}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {order.calendarEventId ? "Atualizar agenda" : "Agendar no Google Calendar"}
                        </button>
                      )
                    }
                    {/* Excluir — apenas admin geral, e só onde este ecrã é a porta do apagar */}
                    {isAdmin && permitirApagar && <button
                      onClick={() => setShowDelete(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Excluir
                    </button>}
                    {/* Fechar */}
                    <button
                      onClick={onClose}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mensagens de estado (accept / save / error) — strip fina abaixo do header */}
              {(acceptMsg || saveMsg || (error && !showDelete)) && (
                <div className="flex-shrink-0 border-b border-slate-100 px-5 py-1.5 flex flex-wrap items-center gap-2">
                  {acceptMsg && (
                    <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                      {acceptMsg}
                    </span>
                  )}
                  {saveMsg && (
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {saveMsg}
                    </span>
                  )}
                  {error && !showDelete && (
                    <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                      {error}
                    </span>
                  )}
                </div>
              )}

              {/* ── Tabs ── */}
              {(() => {
                const historyEntries = parseHistory(order.historyJson);
                const lastReadAt = order.historyReadAt ? new Date(order.historyReadAt).getTime() : 0;
                const unreadClientReplies = historyEntries.filter(
                  (e) => e.type === "client_reply" && new Date(e.createdAt).getTime() > lastReadAt
                ).length;
                return (
                  <div className="flex-shrink-0 overflow-x-auto border-b border-slate-100 px-6">
                    <div className="flex gap-0.5 py-2">
                      {TABS.map((tab) => {
                        const isDisabled = shouldMask && tab.id === "cliente_morada";
                        const showBadge = tab.id === "historico" && unreadClientReplies > 0;
                        return (
                          <button
                            key={tab.id}
                            onClick={async () => {
                              if (isDisabled) { setShowAcceptPrompt(true); return; }
                              setActiveTab(tab.id);
                              if (tab.id === "historico" && unreadClientReplies > 0) {
                                try {
                                  const res = await fetch(`/api/admin/pedidos/${order.id}/mark-history-read`, {
                                    method: "POST",
                                    headers: authHeader,
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setOrder((cur) => cur ? { ...cur, historyReadAt: data.historyReadAt } : cur);
                                    onUpdated?.({ ...order, historyReadAt: data.historyReadAt });
                                  }
                                } catch { /* silencioso */ }
                              }
                            }}
                            disabled={isDisabled}
                            title={isDisabled ? "Aceite o pedido para ver os dados completos do cliente" : undefined}
                            className={`relative flex-shrink-0 rounded-[12px] px-4 py-1.5 text-xs font-semibold transition ${
                              activeTab === tab.id
                                ? "bg-cyan-400 text-slate-950"
                                : isDisabled
                                ? "text-slate-300 cursor-not-allowed opacity-60"
                                : "text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                            }`}
                          >
                            {isDisabled && (
                              <svg className="inline h-3 w-3 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            )}
                            {tab.label}
                            {showBadge && (
                              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                                {unreadClientReplies > 9 ? "9+" : unreadClientReplies}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── Tab Content ── */}
              <div className="flex-1 overflow-y-auto px-6 py-6">

                {/* ── Aba 1: Geral ─────────────────────���───────────────────── */}
                {activeTab === "geral" && (() => {
                  const raw = parseRawOrder(order.rawOrderJson);
                  const isMov = isMudanca(order.serviceType);
                  const originAddr = raw.originAddress?.formattedAddress ?? raw.originAddress?.address ?? order.address;
                  const destAddr = raw.destinationAddress?.formattedAddress ?? raw.destinationAddress?.address;
                  const movDist = raw.movingDistance?.distanceText ?? (order.distanceKm ? `${order.distanceKm} km` : null);
                  const estVal = parseEstimate(order.estimateJson);
                  // Base s/IVA: primeiro valor POSITIVO; se os totais vierem a
                  // 0, cai para o extremo inferior do intervalo em vez de
                  // calcular IVA sobre zero e mostrar três cartões a 0,00 €.
                  const baseNoVat = firstPositive(
                    order.precoFinal, order.estimateTotal, order.estimateMin,
                  );
                  const vatAmount = estVal?.vatAmount ?? (baseNoVat != null ? baseNoVat * 0.23 : null);
                  const totalWithVat = estVal?.estimatedPriceWithVat ?? (baseNoVat != null ? baseNoVat * 1.23 : null);
                  const priceText = legacyPriceText(order);

                  return (
                  <div className="space-y-5">

                    {/* Top info cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {[
                        { icon: "🔧", label: "Tipo de serviço", value: getServiceLabel(order.serviceType), accent: "text-cyan-400" },
                        { icon: "📋", label: "Pedido nº", value: `#${order.id}`, accent: "text-slate-800" },
                        { icon: "📅", label: "Data de entrada", value: fmt(order.createdAt), accent: "text-slate-800" },
                        { icon: "👤", label: "Cliente", value: shouldMask ? _maskName(order.contactName) : (order.contactName ?? "—"), accent: "text-slate-900" },
                        { icon: "📊", label: "Estado", value: STATUS_CFG[order.status]?.label ?? order.status, accent: "text-cyan-700" },
                      ].map((c) => (
                        <div key={c.label} className="rounded-[16px] border border-slate-100 bg-slate-50/50 p-3.5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm">{c.icon}</span>
                            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">{c.label}</p>
                          </div>
                          <p className={`text-sm font-bold ${c.accent} truncate`}>{c.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Estimate cards */}
                    {/* Guard por valor POSITIVO (ou intervalo): "0.00" é uma
                        string truthy e mostrava os três cartões a zero */}
                    {priceText && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-[16px] border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
                            {fmtEur(order.precoFinal) ? "Preço s/IVA" : "Estimativa s/IVA"}
                          </p>
                          <p className="mt-1.5 text-xl font-bold text-emerald-700">
                            {priceText}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-cyan-400/20 bg-cyan-400/[0.06] p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-500">IVA 23%</p>
                          <p className="mt-1.5 text-xl font-bold text-cyan-700">
                            {vatAmount != null && !isNaN(vatAmount) ? `${vatAmount.toFixed(2)} €` : "—"}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-orange-400/20 bg-orange-400/[0.06] p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                            {order.precoFinalIva ? "Preço total" : "Estimativa total"}
                          </p>
                          <p className="mt-1.5 text-xl font-bold text-orange-300">
                            {fmtEur(order.precoFinalIva) ?? (totalWithVat != null && !isNaN(totalWithVat) ? `${totalWithVat.toFixed(2)} €` : "—")}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Two-column layout */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

                      {/* Left column (3/5) */}
                      <div className="space-y-5 lg:col-span-3">

                        {/* Dados do serviço */}
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-5">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Dados do serviço</p>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Tipo</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800">{getServiceLabel(order.serviceType)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Urgência</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800">{tUrgency(order.urgency) ?? "Normal"}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Precisa de fatura</p>
                              {order.precisaFatura == null ? (
                                <p className="mt-1 text-sm text-slate-400">Não respondeu</p>
                              ) : (
                                <p
                                  className={`mt-1 text-sm font-semibold ${
                                    order.precisaFatura ? "text-[#00B4CC]" : "text-slate-800"
                                  }`}
                                >
                                  {order.precisaFatura ? "Sim — só a quem a passa" : "Não é preciso"}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                                Conta gastar
                              </p>
                              {order.valorDesejadoCliente == null ||
                              order.valorDesejadoCliente === "" ? (
                                <p className="mt-1 text-sm text-slate-400">Não disse</p>
                              ) : (
                                <p className="mt-1 text-sm font-semibold text-slate-800">
                                  {Number(order.valorDesejadoCliente).toFixed(2)} €
                                  <span className="ml-1 font-normal text-slate-500">
                                    (não entra no cálculo)
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                          {order.description && (
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Descrição</p>
                              <p className="text-sm leading-relaxed text-slate-700">{order.description}</p>
                            </div>
                          )}
                        </div>

                        {/* Análise Gemini */}
                        {estVal && (
                          <div className="rounded-[18px] border border-violet-400/20 bg-violet-400/[0.03] p-5 space-y-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Análise Gemini</span>
                              {estVal.confidence && (
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  estVal.confidence === "high" ? "border-emerald-400/30 text-emerald-400" :
                                  estVal.confidence === "medium" ? "border-amber-400/30 text-amber-400" :
                                  "border-red-400/30 text-red-400"
                                }`}>
                                  {estVal.confidence === "high" ? "Alta" : estVal.confidence === "medium" ? "Média" : "Baixa"}
                                </span>
                              )}
                              {estVal.confidence && (
                                <div className="ml-2 flex items-center gap-1 flex-1">
                                  <div className="h-1.5 flex-1 max-w-[100px] rounded-full bg-white/[0.06] overflow-hidden">
                                    <div className={`h-full rounded-full ${
                                      estVal.confidence === "high" ? "bg-emerald-400 w-full" :
                                      estVal.confidence === "medium" ? "bg-amber-400 w-2/3" :
                                      "bg-red-400 w-1/3"
                                    }`} />
                                  </div>
                                </div>
                              )}
                              <span className="ml-auto rounded-full border border-violet-400/30 px-2 py-0.5 text-[10px] font-semibold text-violet-400">IA</span>
                            </div>

                            {estVal.summary && (
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-400 mb-1">Resumo</p>
                                <p className="text-xs leading-relaxed text-slate-700">{estVal.summary}</p>
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {estVal.assumptions && estVal.assumptions.length > 0 && (
                                <div>
                                  <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400 mb-1.5">Pressupostos</p>
                                  <ul className="space-y-1">
                                    {estVal.assumptions.map((a, i) => (
                                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                                        <span className="mt-1 text-emerald-400 text-[10px]">✓</span>{a}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {estVal.missingFields && estVal.missingFields.length > 0 && (
                                <div>
                                  <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-400 mb-1.5">Pontos de atenção</p>
                                  <ul className="space-y-1">
                                    {estVal.missingFields.map((f, i) => (
                                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                                        <span className="mt-0.5 text-[10px]">◆</span>{f.replace(/_/g, " ")}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {estVal.difficultyLevel && (
                                <div className="rounded-[12px] border border-slate-100 bg-slate-50/50 p-2.5">
                                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Dificuldade</p>
                                  <div className="flex gap-0.5 mb-1">
                                    {[1,2,3,4,5].map((n) => (
                                      <div key={n} className={`h-1 w-3.5 rounded-full ${n <= (estVal.difficultyLevel ?? 0) ? "bg-violet-400" : "bg-white/10"}`} />
                                    ))}
                                  </div>
                                  <span className={`text-[10px] font-semibold ${DIFFICULTY_COLOR[estVal.difficultyLevel] ?? "text-slate-700"}`}>
                                    {DIFFICULTY_LABEL[estVal.difficultyLevel] ?? estVal.difficultyLevel}
                                  </span>
                                </div>
                              )}
                              {estVal.teamSize && (
                                <div className="rounded-[12px] border border-slate-100 bg-slate-50/50 p-2.5">
                                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Equipa</p>
                                  <p className="text-[11px] font-semibold text-slate-700">{estVal.teamSize}</p>
                                </div>
                              )}
                              {estVal.estimatedHoursText && (
                                <div className="rounded-[12px] border border-slate-100 bg-slate-50/50 p-2.5">
                                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Tempo</p>
                                  <p className="text-[11px] font-semibold text-slate-700">{estVal.estimatedHoursText}</p>
                                </div>
                              )}
                              {estVal.recommendation && (
                                <div className="rounded-[12px] border border-slate-100 bg-slate-50/50 p-2.5">
                                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Ação</p>
                                  <p className={`text-[11px] font-semibold ${
                                    estVal.recommendation === "pode_aprovar" ? "text-emerald-400" :
                                    estVal.recommendation === "visita_presencial" ? "text-red-400" :
                                    "text-amber-400"
                                  }`}>
                                    {estVal.recommendation === "pode_aprovar" ? "Pode aprovar" :
                                     estVal.recommendation === "pedir_fotos" ? "Pedir fotos" :
                                     estVal.recommendation === "pedir_info" ? "Pedir info" :
                                     estVal.recommendation === "visita_presencial" ? "Visita presencial" :
                                     estVal.recommendation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Preço e notas internas */}
                        {isAdmin && (
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-5 space-y-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Preço e notas internas</p>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Preço final sem IVA (€)">
                                <input type="number" step="0.01" min="0" value={editPrecoFinal} onChange={(e) => setEditPrecoFinal(e.target.value)} className={inputCls} placeholder="0.00" />
                              </Field>
                              <Field label="Preço final com IVA (€)">
                                <input type="number" step="0.01" min="0" value={editPrecoFinalIva} onChange={(e) => setEditPrecoFinalIva(e.target.value)} className={inputCls} placeholder="0.00" />
                              </Field>
                            </div>
                            <Field label="Razão interna / notas">
                              <textarea rows={3} value={editNotasInternas} onChange={(e) => setEditNotasInternas(e.target.value)} className={inputCls} placeholder="Notas internas (não visíveis pelo cliente)..." />
                            </Field>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button onClick={handleRecalcularEstimativa} disabled={recalculating || saving}
                                className="flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-400/20 disabled:opacity-60 transition">
                                {recalculating ? "A recalcular..." : "Recalcular estimativa"}
                              </button>
                              <button onClick={() => handleStatusQuick("aprovado")} disabled={saving}
                                className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-400/20 disabled:opacity-60 transition">
                                Aprovar orçamento
                              </button>
                              <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                                {saving ? "A guardar..." : "Guardar alterações"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Fotos e ficheiros */}
                        {files.length > 0 && (
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-5">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Fotos e ficheiros ({files.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {files.slice(0, 8).map((url, i) => {
                                const isImg = /\.(jpe?g|png|gif|webp|avif|heic)$/i.test(url);
                                return isImg ? (
                                  <button key={i} type="button" onClick={() => setLightbox(url)} className="h-16 w-16 overflow-hidden rounded-xl border border-slate-100">
                                    <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover hover:scale-105 transition" />
                                  </button>
                                ) : (
                                  <a key={i} href={url} target="_blank" rel="noreferrer" className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-100 bg-slate-50/50 text-slate-500 hover:text-slate-700 transition">
                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  </a>
                                );
                              })}
                              {files.length > 8 && (
                                <button type="button" onClick={() => setActiveTab("servico_fotos")} className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-100 bg-slate-50/50 text-xs text-slate-400 hover:bg-slate-100 transition">
                                  +{files.length - 8}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right sidebar (2/5) */}
                      <div className="space-y-4 lg:col-span-2">

                        {/* Resumo rápido */}
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-4 space-y-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Resumo rápido</p>
                          {[
                            { label: "Responsável", value: order.assignedToName ?? "Por atribuir" },
                            { label: "Prioridade", value: order.priority === "urgente" ? "Urgente" : order.priority === "alta" ? "Alta" : order.priority === "baixa" ? "Baixa" : "Normal" },
                            { label: "Urgência", value: tUrgency(order.urgency) ?? "Normal" },
                            ...(estVal?.difficultyLevel ? [{ label: "Complexidade", value: DIFFICULTY_LABEL[estVal.difficultyLevel] ?? String(estVal.difficultyLevel) }] : []),
                            ...(order.distanceKm ? [{ label: "Distância", value: `${order.distanceKm} km` }] : []),
                          ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
                              <span className="text-[10px] text-slate-500">{item.label}</span>
                              <span className="text-xs font-semibold text-slate-800">{item.value}</span>
                            </div>
                          ))}
                        </div>

                        {/* Contacto */}
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Contacto</p>
                          {order.contactPhone && (
                            <div className="flex items-center gap-2">
                              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <span className="text-sm font-semibold text-slate-800">{shouldMask ? _maskPhone(order.contactPhone) : order.contactPhone}</span>
                            </div>
                          )}
                          {order.contactEmail && (
                            <div className="flex items-center gap-2">
                              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-slate-700 truncate">{shouldMask ? _maskEmail(order.contactEmail) : order.contactEmail}</span>
                            </div>
                          )}
                          {order.contactPhone && !shouldMask && (
                            <a href={`https://wa.me/${waPhone}?text=${waMsg}`} target="_blank" rel="noreferrer"
                              className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-500/15 border border-green-400/20 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/25 transition w-full">
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                              WhatsApp
                            </a>
                          )}
                          {order.contactPhone && shouldMask && (
                            <button onClick={() => setShowAcceptPrompt(true)}
                              className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-500/15 border border-green-400/20 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/25 transition w-full">
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                              WhatsApp
                            </button>
                          )}
                        </div>

                        {/* Morada */}
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Morada</p>
                          {isMov ? (
                            <>
                              <div>
                                <p className="text-[9px] text-cyan-500 font-semibold uppercase tracking-wider">Origem</p>
                                <p className="text-xs text-slate-800 mt-0.5">{originAddr ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-violet-400 font-semibold uppercase tracking-wider">Destino</p>
                                <p className="text-xs text-slate-800 mt-0.5">{destAddr ?? "—"}</p>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-slate-800">{order.address ?? "—"}</p>
                          )}
                          {(order.city || order.postalCode) && (
                            <p className="text-[11px] text-slate-400">{[order.city, order.postalCode].filter(Boolean).join(" · ")}</p>
                          )}
                          {order.address && (
                            <a href={linkGoogleMaps({ street: order.address, postalCode: order.postalCode, city: order.city, formattedAddress: order.address }) ?? "#"} target="_blank" rel="noreferrer"
                              className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-700 transition">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Ver no mapa
                            </a>
                          )}
                        </div>

                        {/* Distância / Zona */}
                        {(order.distanceKm || movDist) && (
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Distância / Zona</p>
                            <p className="text-lg font-bold text-cyan-700">
                              {isMov ? movDist : `${order.distanceKm} km`}
                            </p>
                            {order.distanceText && <p className="text-[11px] text-slate-400">{order.distanceText}</p>}
                            {order.city && (
                              <span className="inline-block rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                                {order.city}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Mini histórico */}
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-4">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Histórico do pedido</p>
                          <div className="relative space-y-0 pl-3">
                            <div className="absolute left-3 top-1 bottom-1 w-px bg-white/[0.06]" />
                            {[
                              { label: "Pedido criado", date: order.createdAt, color: "bg-slate-400" },
                              ...(order.assignedAt ? [{ label: `Atribuído a ${order.assignedToName ?? "alguém da equipa"}`, date: order.assignedAt, color: "bg-sky-400" }] : []),
                              ...(order.status === "aprovado" ? [{ label: "Orçamento aprovado", date: order.updatedAt, color: "bg-emerald-400" }] : []),
                              ...(order.status === "confirmado" ? [{ label: "Confirmado", date: order.updatedAt, color: "bg-green-400" }] : []),
                              ...(order.status === "em_execucao" ? [{ label: "Em execução", date: order.updatedAt, color: "bg-lime-400" }] : []),
                              ...(order.status === "concluido" ? [{ label: "Concluído", date: order.updatedAt, color: "bg-emerald-400" }] : []),
                            ].slice(0, 5).map((item, i) => (
                              <div key={i} className="relative pb-3 pl-5">
                                <span className={`absolute left-[-3px] top-1 h-2 w-2 rounded-full ${item.color} ring-3 ring-white`} />
                                <p className="text-[11px] font-semibold text-slate-700">{item.label}</p>
                                <p className="text-[10px] text-slate-600">{fmt(item.date)}</p>
                              </div>
                            ))}
                          </div>
                          {history.length > 0 && (
                            <button onClick={() => setActiveTab("historico")} className="mt-2 text-[11px] font-semibold text-cyan-400 hover:text-cyan-700 transition">
                              Ver histórico completo →
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                  );
                })()}

                {/* ── Aba 2: Cliente e Morada ────────���─────────────────────── */}
                {activeTab === "cliente_morada" && (() => {
                  const raw = parseRawOrder(order.rawOrderJson);
                  const isMov = isMudanca(order.serviceType);
                  const originAccess = raw.originAccess ?? {};
                  const destAccess = raw.destinationAccess ?? {};
                  const originAddr = raw.originAddress ?? {};
                  const destAddr = raw.destinationAddress ?? {};
                  const movDist = raw.movingDistance ?? {};
                  const baseDist = raw.distanceFromBase ?? {};

                  return (
                  <div className="space-y-8">
                    {/* Dados do cliente */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-slate-900">Dados do cliente</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Nome completo">
                          <input type="text" value={editContactName} onChange={(e) => setEditContactName(e.target.value)} className={inputCls} placeholder="Nome do cliente" />
                        </Field>
                        <Field label="Telefone">
                          <input type="tel" value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} className={inputCls} placeholder="+351 9XX XXX XXX" />
                        </Field>
                        <Field label="E-mail">
                          <input type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} className={inputCls} placeholder="email@exemplo.com" />
                        </Field>
                        <Field label="Urgência">
                          <select value={editUrgency} onChange={(e) => setEditUrgency(e.target.value)} className={selectCls}>
                            <option value="" className={optionCls}>Normal</option>
                            <option value="today" className={optionCls}>Hoje</option>
                            <option value="tomorrow" className={optionCls}>Amanhã</option>
                            <option value="this_week" className={optionCls}>Esta semana</option>
                            <option value="flexible" className={optionCls}>Flexível</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="Mensagem personalizada para o cliente">
                        <textarea rows={4} value={editMensagemCliente} onChange={(e) => setEditMensagemCliente(e.target.value)} className={inputCls} placeholder="Mensagem que será enviada ao cliente..." />
                      </Field>
                    </div>

                    {/* Morada e acesso */}
                    {isMov ? (
                      <div className="space-y-6">
                        <h3 className="text-base font-bold text-slate-900">Morada de mudança — Origem e Destino</h3>
                        <div className="rounded-[20px] border border-cyan-400/20 bg-cyan-400/[0.03] p-5">
                          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-cyan-400">Origem</p>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <ReadonlyField label="Morada de origem" value={originAddr.formattedAddress ?? originAddr.address ?? order.address} />
                            <ReadonlyField label="Localidade" value={originAddr.city ?? order.city} />
                            <ReadonlyField label="Código postal" value={originAddr.postalCode ?? order.postalCode} />
                            <ReadonlyField label="Andar" value={originAccess.floor ?? order.floor} />
                            <ReadonlyField label="Elevador" value={tElevator(originAccess.hasElevator ?? order.hasElevator)} />
                            <ReadonlyField label="Estacionamento" value={tParking(originAccess.parkingDistance ?? order.parkingDistance)} />
                            <ReadonlyField label="Acesso difícil" value={originAccess.difficultAccess ? "Sim" : originAccess.difficultAccess === false ? "Não" : null} />
                            {originAccess.observations && (
                              <div className="sm:col-span-2">
                                <ReadonlyField label="Observações origem" value={originAccess.observations} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-violet-400/20 bg-violet-400/[0.03] p-5">
                          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-violet-400">Destino</p>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <ReadonlyField label="Morada de destino" value={destAddr.formattedAddress ?? destAddr.address} />
                            <ReadonlyField label="Localidade" value={destAddr.city} />
                            <ReadonlyField label="Código postal" value={destAddr.postalCode} />
                            <ReadonlyField label="Andar" value={destAccess.floor} />
                            <ReadonlyField label="Elevador" value={tElevator(destAccess.hasElevator)} />
                            <ReadonlyField label="Estacionamento" value={tParking(destAccess.parkingDistance)} />
                            <ReadonlyField label="Acesso difícil" value={destAccess.difficultAccess ? "Sim" : destAccess.difficultAccess === false ? "Não" : null} />
                            {destAccess.observations && (
                              <div className="sm:col-span-2">
                                <ReadonlyField label="Observações destino" value={destAccess.observations} />
                              </div>
                            )}
                          </div>
                        </div>
                        {(movDist.distanceText || movDist.distanceKm || order.distanceKm || baseDist.distanceText) && (
                          <div className="rounded-[20px] border border-slate-100 bg-slate-50/50 p-5">
                            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Percurso</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <ReadonlyField label="Origem → Destino" value={movDist.distanceText ?? (order.distanceKm ? `${order.distanceKm} km` : null)} />
                              <ReadonlyField label="Duração" value={movDist.durationText ?? order.distanceText} />
                              {baseDist.distanceText && <ReadonlyField label="Base → Origem" value={baseDist.distanceText} />}
                              {baseDist.durationText && <ReadonlyField label="Duração base" value={baseDist.durationText} />}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h3 className="text-base font-bold text-slate-900">Morada e acesso</h3>
                        {/* Um contacto de quatro campos não perdeu dados: nunca
                            os pediu. Sem isto, a equipa procura o que não
                            existe em vez de levantar o telefone. */}
                        {origemDoPedido(order.rawOrderJson).slug === "formulario_contactos" && (
                          <p className="rounded-[16px] border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900">
                            Este pedido veio da <span className="font-semibold">página de contactos</span>, que só
                            pede nome, telemóvel, email, morada e tipo de serviço. Andar, elevador e
                            estacionamento não chegaram porque não foram perguntados — confirma-os com o cliente.
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field label="Morada completa">
                            <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className={inputCls} placeholder="Rua, número, andar..." />
                          </Field>
                          <Field label="Localidade">
                            <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} className={inputCls} placeholder="Lisboa, Porto..." />
                          </Field>
                          <Field label="Código postal">
                            <input type="text" value={editPostalCode} onChange={(e) => setEditPostalCode(e.target.value)} className={inputCls} placeholder="1234-567" />
                          </Field>
                          {/* Abre no Maps com o que está NOS CAMPOS neste
                              momento, não com o que foi gravado. Quem corrige
                              a morada aqui quer confirmar a correcção, não a
                              versão antiga. */}
                          <Field label="Confirmar no mapa">
                            {(() => {
                              const url = linkGoogleMaps({
                                street: editAddress,
                                postalCode: editPostalCode,
                                city: editCity,
                                formattedAddress: editAddress,
                              });
                              if (!url) {
                                return (
                                  <p className="px-1 py-2.5 text-xs text-slate-400">
                                    Preencha a morada para abrir o mapa.
                                  </p>
                                );
                              }
                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-400/20"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  Abrir no Google Maps
                                </a>
                              );
                            })()}
                          </Field>
                          <Field label="Coordenadas para o raio">
                            {(() => {
                              const raw = parseRawOrder(order.rawOrderJson) as {
                                address?: { lat?: number; lng?: number };
                                coordenadasAproximadas?: boolean;
                              };
                              const lat = localizacao?.ok ? localizacao.lat : raw.address?.lat;
                              const lng = localizacao?.ok ? localizacao.lng : raw.address?.lng;
                              const tem = typeof lat === "number" && typeof lng === "number";
                              return (
                                <div className="space-y-1.5 px-1 py-1">
                                  {tem ? (
                                    <p className="text-xs font-semibold text-emerald-600">
                                      Localizada ({lat!.toFixed(4)}, {lng!.toFixed(4)})
                                      {raw.coordenadasAproximadas ? " · pelo centro da freguesia" : ""}
                                      {" — o raio dos profissionais conta."}
                                    </p>
                                  ) : (
                                    <p className="text-xs font-semibold text-amber-600">
                                      SEM coordenadas — o raio dos profissionais não conta;
                                      só chega a quem tiver a localidade na lista de zonas.
                                    </p>
                                  )}
                                  {localizacao && !localizacao.ok && (
                                    <p className="text-xs text-red-600">
                                      {localizacao.motivo === "REQUEST_DENIED"
                                        ? "O Google recusou a chave — active a Geocoding API no Google Cloud."
                                        : localizacao.motivo === "SEM_CHAVE"
                                          ? "Sem chave do Google no servidor, e o recurso pela freguesia também falhou."
                                          : `Não foi possível localizar (${localizacao.motivo}).`}
                                    </p>
                                  )}
                                  {!tem && (
                                    <button
                                      type="button"
                                      onClick={localizarMorada}
                                      disabled={aLocalizar}
                                      className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-400/20 disabled:opacity-50"
                                    >
                                      {aLocalizar ? "A localizar…" : "Localizar agora"}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </Field>
                          <Field label="Andar">
                            <input type="text" value={editFloor} onChange={(e) => setEditFloor(e.target.value)} className={inputCls} placeholder="Ex: 3º andar" />
                          </Field>
                          <Field label="Elevador">
                            {/* Vocabulário partilhado: o que aqui se grava é
                                lido pelo motor de preços e pelo simulador */}
                            <select value={editHasElevator} onChange={(e) => setEditHasElevator(e.target.value)} className={selectCls}>
                              <option value="" className={optionCls}>Não informado</option>
                              {ELEVATOR_VALUES.map((v) => (
                                <option key={v} value={v} className={optionCls}>{tElevator(v)}</option>
                              ))}
                              {isUnknownAccessValue(editHasElevator, ELEVATOR_VALUES) && (
                                <option value={editHasElevator} className={optionCls}>{editHasElevator} (valor antigo)</option>
                              )}
                            </select>
                          </Field>
                          <Field label="Distância de estacionamento">
                            <select value={editParkingDistance} onChange={(e) => setEditParkingDistance(e.target.value)} className={selectCls}>
                              <option value="" className={optionCls}>Não informado</option>
                              {PARKING_VALUES.map((v) => (
                                <option key={v} value={v} className={optionCls}>{tParking(v)}</option>
                              ))}
                              {isUnknownAccessValue(editParkingDistance, PARKING_VALUES) && (
                                <option value={editParkingDistance} className={optionCls}>{editParkingDistance} (valor antigo)</option>
                              )}
                            </select>
                          </Field>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                        {saving ? "A guardar..." : "Guardar alterações"}
                      </button>
                    </div>
                  </div>
                  );
                })()}

                {/* ── Aba 3: Serviço e Fotos ───────────────────────────────── */}
                {activeTab === "servico_fotos" && (
                  <div className="space-y-8">
                    {/* Serviço */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-slate-900">Dados do serviço</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Tipo de serviço">
                          <select value={editServiceType} onChange={(e) => setEditServiceType(e.target.value)} className={selectCls}>
                            <option value="" className={optionCls}>Selecionar...</option>
                            {SERVICE_TYPES.map((s) => (
                              <option key={s.value} value={s.value} className={optionCls}>{s.label}</option>
                            ))}
                          </select>
                          {editServiceType && !SERVICE_TYPES.some((s) => s.value === editServiceType) && (
                            <p className="mt-1 text-[10px] text-amber-400">
                              Valor original: &quot;{order.serviceType}&quot; — não reconhecido
                            </p>
                          )}
                        </Field>
                        <Field label="Urgência">
                          <select value={editUrgency} onChange={(e) => setEditUrgency(e.target.value)} className={selectCls}>
                            <option value="" className={optionCls}>Normal</option>
                            <option value="today" className={optionCls}>Hoje</option>
                            <option value="tomorrow" className={optionCls}>Amanhã</option>
                            <option value="this_week" className={optionCls}>Esta semana</option>
                            <option value="flexible" className={optionCls}>Flexível</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="Descrição detalhada do serviço">
                        <textarea rows={5} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className={inputCls} placeholder="Descreva o serviço em detalhe..." />
                      </Field>

                      {/* Entulho: quantidade de sacos, estado e conversor big bags — apenas para recolha_entulho */}
                      {editServiceType === "recolha_entulho" && (() => {
                        const raw = parseRawOrder(order.rawOrderJson);
                        const qtd: string | null = raw.entulhoQuantidade ?? null;
                        const state: string | null = raw.entulhoState ?? null;
                        const bb = parseInt(bigBags.replace(/[^\d]/g, ""), 10) || 0;
                        const sacosEquiv = bb * 42;
                        return (
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-4 space-y-4">
                            {(qtd || state) && (
                              <div className="flex flex-wrap items-center gap-6">
                                {qtd && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Quantidade de sacos</p>
                                    <p className="mt-1 text-sm font-bold text-slate-800">{qtd}</p>
                                  </div>
                                )}
                                {state && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Estado</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">{tEntulho(state)}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Conversor big bags → sacos — uso interno, nunca visível ao cliente */}
                            <div className={`${qtd || state ? "border-t border-slate-100 pt-4" : ""}`}>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-400">Big bags → sacos (uso interno)</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">1 big bag = 42 sacos no chão. Usa o equivalente para calcular o preço.</p>
                              <div className="mt-2 flex items-center gap-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={bigBags}
                                  onChange={(e) => setBigBags(e.target.value)}
                                  placeholder="Nº de big bags"
                                  className="w-36 rounded-lg border border-slate-200 bg-white/[0.03] px-3 py-2 text-sm text-slate-800 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                                />
                                <span className="text-sm font-semibold text-slate-700">
                                  {bb > 0 ? `= ${sacosEquiv} sacos` : "= — sacos"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Estimativa da IA — cartões de valores */}
                      <div>
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Estimativa da IA</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Mínimo s/IVA</p>
                            <p className="mt-1.5 text-lg font-bold text-cyan-400">
                              {fmtEur(order.estimateMin) ?? (est?.estimateMinWithoutVat ? `${est.estimateMinWithoutVat.toFixed(2)} €` : "—")}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/50 p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Máximo s/IVA</p>
                            <p className="mt-1.5 text-lg font-bold text-cyan-400">
                              {fmtEur(order.estimateMax) ?? (est?.estimateMaxWithoutVat ? `${est.estimateMaxWithoutVat.toFixed(2)} €` : "—")}
                            </p>
                          </div>
                          <div className="rounded-[18px] border border-cyan-400/10 bg-cyan-400/5 p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-600">Recomendado s/IVA</p>
                            <p className="mt-1.5 text-lg font-bold text-cyan-700">
                              {fmtEur(order.estimateTotal) ?? (est?.estimatedPriceWithoutVat ? `${est.estimatedPriceWithoutVat.toFixed(2)} €` : "—")}
                            </p>
                          </div>
                        </div>
                        {/* Valor com IVA em destaque */}
                        {(est?.estimatedPriceWithVat || order.estimateTotal) && (
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <span className="text-[10px] text-slate-600">com IVA (23%):</span>
                            <span className="text-base font-bold text-cyan-400">
                              {est?.estimatedPriceWithVat
                                ? `${est.estimatedPriceWithVat.toFixed(2)} €`
                                : order.estimateTotal
                                  ? `${(parseFloat(order.estimateTotal) * 1.23).toFixed(2)} €`
                                  : "—"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Análise Gemini detalhada */}
                      {est && (
                        <div className="rounded-[20px] border border-violet-400/20 bg-violet-400/[0.03] p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Análise Gemini</span>
                            {est.confidence && (
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                est.confidence === "high" ? "border-emerald-400/30 text-emerald-400" :
                                est.confidence === "medium" ? "border-amber-400/30 text-amber-400" :
                                "border-red-400/30 text-red-400"
                              }`}>
                                {est.confidence === "high" ? "Alta confiança" : est.confidence === "medium" ? "Confiança média" : "Baixa confiança"}
                              </span>
                            )}
                            <span className="ml-auto rounded-full border border-violet-400/30 px-2 py-0.5 text-[10px] font-semibold text-violet-400">IA</span>
                          </div>

                          {/* Equipa / Horas / Dificuldade / Recomendação */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {est.difficultyLevel && (
                              <div className="rounded-[12px] border border-slate-100 bg-slate-50/50 p-2.5">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Dificuldade</p>
                                <div className="flex gap-0.5 mb-1">
                                  {[1,2,3,4,5].map((n) => (
                                    <div key={n} className={`h-1 w-3.5 rounded-full ${n <= (est.difficultyLevel ?? 0) ? "bg-violet-400" : "bg-white/10"}`} />
                                  ))}
                                </div>
                                <span className={`text-[10px] font-semibold ${DIFFICULTY_COLOR[est.difficultyLevel] ?? "text-slate-700"}`}>
                                  {DIFFICULTY_LABEL[est.difficultyLevel] ?? est.difficultyLevel}
                                </span>
                              </div>
                            )}
                            {est.teamSize && (
                              <div className="rounded-[12px] border border-slate-100 bg-slate-50/50 p-2.5">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Equipa</p>
                                <p className="text-[11px] font-semibold text-slate-700">{est.teamSize}</p>
                              </div>
                            )}
                            {est.estimatedHoursText && (
                              <div className="rounded-[12px] border border-slate-100 bg-slate-50/50 p-2.5">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Tempo</p>
                                <p className="text-[11px] font-semibold text-slate-700">{est.estimatedHoursText}</p>
                              </div>
                            )}
                            {est.recommendation && (
                              <div className="rounded-[12px] border border-slate-100 bg-slate-50/50 p-2.5">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Ação</p>
                                <p className={`text-[11px] font-semibold ${
                                  est.recommendation === "pode_aprovar" ? "text-emerald-400" :
                                  est.recommendation === "visita_presencial" ? "text-red-400" :
                                  "text-amber-400"
                                }`}>
                                  {est.recommendation === "pode_aprovar" ? "Pode aprovar" :
                                   est.recommendation === "pedir_fotos" ? "Pedir fotos" :
                                   est.recommendation === "pedir_info" ? "Pedir info" :
                                   est.recommendation === "visita_presencial" ? "Visita presencial" :
                                   est.recommendation}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Deslocação considerada no cálculo (base CLYON → morada) */}
                          {(() => {
                            const tKm = est.travel?.distanceKm ?? (order.distanceKm ? Number(order.distanceKm) : null);
                            const tDur = est.travel?.durationText ?? null;
                            const tCost = est.travel?.distanceCost ?? (tKm != null ? Math.round(tKm * 2 * 100) / 100 : null);
                            const tHours = est.labor?.estimatedHours ?? null;
                            return (
                              <div className="rounded-[14px] border border-cyan-400/15 bg-cyan-400/[0.04] p-3">
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-500 mb-2">Deslocação e horas consideradas</p>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Distância da base</p>
                                    <p className="mt-1 text-[12px] font-bold text-cyan-700">
                                      {tKm != null ? `${String(tKm).replace(".", ",")} km${tDur ? ` · ${tDur}` : ""}` : "A confirmar"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Custo deslocação</p>
                                    <p className="mt-1 text-[12px] font-bold text-cyan-700">
                                      {tCost != null ? `${tCost.toFixed(2)} €` : "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Horas estimadas</p>
                                    <p className="mt-1 text-[12px] font-bold text-cyan-700">
                                      {tHours != null ? `${tHours}h` : (est.estimatedHoursText ?? "—")}
                                    </p>
                                  </div>
                                </div>
                                {tKm == null && (
                                  <p className="mt-2 text-[10px] text-amber-400">Distância a confirmar manualmente — insira os km abaixo e recalcule.</p>
                                )}
                              </div>
                            );
                          })()}

                          {/* Resumo destacado + custo mínimo (break-even) */}
                          {(() => {
                            const finalPrice = est.estimatedPriceWithoutVat ?? null;
                            const distance = est.travel?.distanceCost ?? null;
                            const labor = est.labor?.laborCost ?? null;
                            // Fórmula CLYON: (combustível + pessoal + overhead) × 1.40 = preço s/IVA
                            // Se temos os componentes soma-os; senão, divide o preço por 1.40 (assumindo margem 40%).
                            const componentsSum = (distance != null && labor != null)
                              ? distance + labor + 17 // overhead fixo (as internal notes indicam 17€)
                              : null;
                            // Um break-even a 0 dizia ao operador que qualquer
                            // valor está acima do limiar de prejuízo — a
                            // defesa colapsava em silêncio. Só vale se > 0.
                            const breakEvenRaw = componentsSum ?? (finalPrice != null ? finalPrice / 1.4 : null);
                            const breakEven = breakEvenRaw != null && breakEvenRaw > 0 ? breakEvenRaw : null;
                            const profit = (finalPrice != null && breakEven != null) ? finalPrice - breakEven : null;
                            const marginPercent = (finalPrice != null && breakEven != null && breakEven > 0)
                              ? ((finalPrice - breakEven) / breakEven) * 100
                              : null;
                            return (
                              <div className="rounded-[16px] border-2 border-violet-400/40 bg-gradient-to-br from-violet-50 to-white p-4">
                                {est.summary && (
                                  <>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-600 mb-1.5">Resumo</p>
                                    <p className="text-sm font-medium leading-relaxed text-slate-800 mb-4">{est.summary}</p>
                                  </>
                                )}
                                {breakEven != null && (
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-violet-200/60 pt-3">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-1">
                                        Custo mínimo (break-even)
                                      </p>
                                      <p className="text-xl font-bold text-rose-700">
                                        {breakEven.toFixed(2)} €
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-slate-500">
                                        Abaixo deste valor = prejuízo
                                      </p>
                                    </div>
                                    {finalPrice != null && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                          Preço sugerido s/IVA
                                        </p>
                                        <p className="text-xl font-bold text-violet-700">
                                          {finalPrice.toFixed(2)} €
                                        </p>
                                        {marginPercent != null && (
                                          <p className="mt-0.5 text-[10px] text-slate-500">
                                            Margem {marginPercent.toFixed(0)}%
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {profit != null && profit > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
                                          Lucro estimado
                                        </p>
                                        <p className="text-xl font-bold text-emerald-700">
                                          {profit.toFixed(2)} €
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-slate-500">
                                          s/IVA · antes de comissão
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {est.customerMessage && (
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-500 mb-1">Mensagem sugerida ao cliente</p>
                              <p className="text-xs leading-relaxed text-slate-700 italic">{est.customerMessage}</p>
                            </div>
                          )}
                          {est.assumptions && est.assumptions.length > 0 && (
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Pressupostos</p>
                              <ul className="space-y-0.5">
                                {est.assumptions.map((a, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                                    <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />{a}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {est.missingFields && est.missingFields.length > 0 && (
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-500 mb-1.5">Campos em falta</p>
                              <ul className="space-y-0.5">
                                {est.missingFields.map((f, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                                    <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />{f.replace(/_/g, " ")}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {est.internalNotes && est.internalNotes.length > 0 && (
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Notas internas da IA</p>
                              <ul className="space-y-0.5">
                                {est.internalNotes.map((n, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                                    <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-600" />{n}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {isAdmin && (
                        <Field label="Distância da base CLYON (km)">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number" step="0.1" min="0" value={editDistanceKm}
                              onChange={(e) => setEditDistanceKm(e.target.value)}
                              className={`${inputCls} w-32`} placeholder="Ex: 26.8"
                            />
                            <button
                              type="button" onClick={handleCalcularDistancia} disabled={distanceCalculating}
                              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-700 hover:bg-cyan-400/20 disabled:opacity-60 transition"
                            >
                              {distanceCalculating ? "A calcular..." : "Calcular pela morada"}
                            </button>
                            <button
                              type="button" onClick={handleGuardarDistanciaManual} disabled={distanceCalculating}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition"
                            >
                              Guardar km manual
                            </button>
                          </div>
                          {distanceMsg && <p className="mt-1.5 text-[11px] text-cyan-400">{distanceMsg}</p>}
                          <p className="mt-1 text-[10px] text-slate-500">Base: Av. Q.ta das Laranjeiras, Fernão Ferro. A distância entra no cálculo do preço ao recalcular a estimativa.</p>
                        </Field>
                      )}

                      {isAdmin && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field label="Preço final sem IVA (€)">
                            <input type="number" step="0.01" min="0" value={editPrecoFinal} onChange={(e) => setEditPrecoFinal(e.target.value)} className={inputCls} placeholder="0.00" />
                          </Field>
                          <Field label="Preço final com IVA (€)">
                            <input type="number" step="0.01" min="0" value={editPrecoFinalIva} onChange={(e) => setEditPrecoFinalIva(e.target.value)} className={inputCls} placeholder="0.00" />
                          </Field>
                        </div>
                      )}

                      <Field label="Notas internas sobre o serviço">
                        <textarea rows={4} value={editNotasInternas} onChange={(e) => setEditNotasInternas(e.target.value)} className={inputCls} placeholder="Notas internas (não visíveis pelo cliente)..." />
                      </Field>

                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={handleRecalcularEstimativa} disabled={recalculating || saving}
                          className="flex items-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-400/20 disabled:opacity-60 transition">
                          {recalculating ? "A recalcular..." : "Recalcular estimativa"}
                        </button>
                        <button onClick={() => handleStatusQuick("aprovado")} disabled={saving}
                          className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-400/20 disabled:opacity-60 transition">
                          Aprovar orçamento
                        </button>
                        <button onClick={handleSave} disabled={saving}
                          className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                          {saving ? "A guardar..." : "Guardar alterações"}
                        </button>
                      </div>
                    </div>

                    {/* Fotos */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900">Fotos e ficheiros</h3>
                        {files.length > 0 && (
                          <button
                            type="button"
                            onClick={() => descarregarTodas(files, order.id)}
                            disabled={aDescarregar != null}
                            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-50"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
                            </svg>
                            {aDescarregar != null ? "A descarregar…" : `Descarregar todas (${files.length})`}
                          </button>
                        )}
                      </div>
                      {/* O cliente escolheu fotos e o upload falhou. Sem isto,
                          a equipa via "nenhuma foto" e o cliente jurava tê-las
                          enviado — e ninguém tinha razão nem prova. */}
                      {(() => {
                        const raw = parseRawOrder(order.rawOrderJson);
                        const perdidas = Number((raw as Record<string, unknown>)?.fotosNaoEnviadas ?? 0);
                        const motivo = (raw as Record<string, unknown>)?.motivoFotosNaoEnviadas;
                        if (!perdidas) return null;
                        return (
                          <div className="rounded-[16px] border border-amber-300 bg-amber-50 p-4">
                            <p className="text-sm font-semibold text-amber-900">
                              O cliente enviou {perdidas} foto{perdidas === 1 ? "" : "s"} que não chegaram.
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-amber-800">
                              Ele foi avisado no ecrã final e convidado a reenviá-las por WhatsApp — vale a pena confirmar.
                            </p>
                            {typeof motivo === "string" && motivo && (
                              <p className="mt-2 rounded-[10px] bg-amber-100 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-900">
                                {motivo}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      {files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-white/10 py-16 text-center">
                          <svg className="mb-3 h-10 w-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm text-slate-500">Nenhuma foto enviada pelo cliente.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                          {files.map((url, i) => {
                            const isImg = /\.(jpe?g|png|gif|webp|avif|heic)$/i.test(url);
                            const isVid = /\.(mp4|mov|webm|avi)$/i.test(url);
                            return (
                              <div key={i} className="group relative overflow-hidden rounded-[16px] border border-slate-100 bg-slate-50/50 aspect-square">
                                {isImg ? (
                                  <>
                                    <img src={url} alt={`Ficheiro ${i + 1}`} className="h-full w-full object-cover transition group-hover:scale-105 cursor-pointer" onClick={() => setLightbox(url)} />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        descarregarFoto(url, `pedido-${order.id}-foto-${i + 1}`);
                                      }}
                                      disabled={aDescarregar === url}
                                      title="Descarregar esta foto"
                                      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-700 opacity-0 shadow transition hover:bg-white group-hover:opacity-100 disabled:opacity-60"
                                    >
                                      {aDescarregar === url ? (
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                                      ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
                                        </svg>
                                      )}
                                    </button>
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition cursor-pointer" onClick={() => setLightbox(url)}>
                                      <svg className="h-6 w-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </div>
                                  </>
                                ) : isVid ? (
                                  <video src={url} className="h-full w-full object-cover" controls />
                                ) : (
                                  <a href={url} target="_blank" rel="noreferrer" className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center hover:bg-slate-50 transition">
                                    <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-[10px] text-slate-400 truncate w-full">Ficheiro {i + 1}</span>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* Atribuição */}
                {activeTab === "atribuicao" && (
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-slate-900">Estado do pedido</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Status do pedido">
                        <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as OrderStatus)} className={selectCls}>
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s} className={optionCls}>{STATUS_CFG[s]?.label ?? s}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Prioridade">
                        <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as OrderPriority)} className={selectCls}>
                          <option value="baixa" className={optionCls}>Baixa</option>
                          <option value="normal" className={optionCls}>Normal</option>
                          <option value="alta" className={optionCls}>Alta</option>
                          <option value="urgente" className={optionCls}>Urgente</option>
                        </select>
                      </Field>
                      <Field label="Data agendada">
                        <input type="datetime-local" value={editDataAgendada} onChange={(e) => setEditDataAgendada(e.target.value)} className={inputCls} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ReadonlyField label="Criado em" value={fmt(order.createdAt)} />
                      <ReadonlyField label="Última atualização" value={fmt(order.updatedAt)} />
                      {(order as any).acceptedAt && (
                        <ReadonlyField label="Aceite em" value={fmt((order as any).acceptedAt)} />
                      )}
                    </div>
                    <Field label="Notas internas (visíveis apenas no backoffice)">
                      <textarea rows={4} value={editNotasInternas} onChange={(e) => setEditNotasInternas(e.target.value)} className={inputCls} placeholder="Notas para a equipa..." />
                    </Field>
                    <div className="flex justify-end">
                      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                        {saving ? "A guardar..." : "Guardar alterações"}
                      </button>
                    </div>

                    {/* ── Agenda do serviço ──────────────────────────────── */}
                    {isAdmin && (
                      <div className="rounded-[20px] border border-violet-400/20 bg-violet-400/[0.03] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-violet-700 flex items-center gap-2">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Agenda do serviço
                          </h4>
                          {/* Current calendar status badge */}
                          {order.calendarStatus === "scheduled" && (
                            <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                              Agendado
                            </span>
                          )}
                          {order.calendarStatus === "updated" && (
                            <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                              Atualizado
                            </span>
                          )}
                          {(!order.calendarStatus || order.calendarStatus === "not_scheduled") && (
                            <span className="rounded-full border border-slate-600/40 bg-slate-600/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                              Não agendado
                            </span>
                          )}
                        </div>

                        {/* Agenda de destino — quando configurada */}
                        {order.calendarTargetName && (
                          <div className="flex items-center gap-2 rounded-[12px] border border-violet-400/15 bg-violet-400/[0.04] px-3 py-2">
                            <svg className="h-3.5 w-3.5 flex-shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[11px] text-slate-500">Agenda: <span className="font-semibold text-violet-700">{order.calendarTargetName}</span></span>
                          </div>
                        )}

                        {/* Confirmed schedule pill */}
                        {order.scheduledDate && order.calendarStatus && order.calendarStatus !== "not_scheduled" && (() => {
                          const [y, m, d] = order.scheduledDate!.split("-");
                          const datePt = `${d}/${m}/${y}`;
                          return (
                            <div className="flex items-center gap-2 rounded-[14px] border border-violet-400/20 bg-violet-400/[0.06] px-4 py-2.5 text-sm">
                              <svg className="h-4 w-4 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-violet-200">
                                Agendado para{" "}
                                <span className="font-bold text-slate-900">{datePt}</span>
                                {order.scheduledStartTime && order.scheduledEndTime && (
                                  <>, <span className="font-bold text-slate-900">{order.scheduledStartTime}–{order.scheduledEndTime}</span></>
                                )}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Scheduling form */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <Field label="Data do serviço">
                            <input
                              type="date"
                              value={schedDate}
                              onChange={(e) => setSchedDate(e.target.value)}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Hora de início">
                            <input
                              type="time"
                              value={schedStart}
                              onChange={(e) => setSchedStart(e.target.value)}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Hora de fim">
                            <input
                              type="time"
                              value={schedEnd}
                              onChange={(e) => setSchedEnd(e.target.value)}
                              className={inputCls}
                            />
                          </Field>
                        </div>
                        <Field label="Observações para a agenda (opcional)">
                          <textarea
                            rows={2}
                            value={schedNotes}
                            onChange={(e) => setSchedNotes(e.target.value)}
                            className={inputCls}
                            placeholder="Ex: Levar embalagens extra, acesso pelo lado esquerdo..."
                          />
                        </Field>

                        {/* Messages */}
                        {schedError && (
                          <p className="text-xs font-semibold text-red-400">{schedError}</p>
                        )}
                        {schedMsg && (
                          <p className="text-xs font-semibold text-violet-700">{schedMsg}</p>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={handleSchedule}
                            disabled={scheduling || !schedDate || !schedStart || !schedEnd}
                            className="flex items-center gap-1.5 rounded-2xl bg-violet-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-violet-400 disabled:opacity-50 transition"
                          >
                            {scheduling ? (
                              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                            {scheduling ? "A agendar..." : order.calendarEventId ? "Atualizar no Google Calendar" : "Agendar no Google Calendar"}
                          </button>

                          {order.calendarEventUrl && (
                            <a
                              href={order.calendarEventUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-400/20 transition"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Abrir no Google Calendar
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Histórico */}
                {activeTab === "distribuicao" && (
                  <DistribuicaoTab pedidoId={order.id} token={token} />
                )}

                {activeTab === "historico" && (
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-slate-900">Histórico do pedido</h3>
                    {history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <svg className="mb-3 h-10 w-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-slate-500">Nenhum registo de histórico ainda.</p>
                      </div>
                    ) : (
                      <div className="relative space-y-0 pl-4">
                        <div className="absolute left-4 top-3 bottom-3 w-px bg-white/[0.06]" />
                        {history.map((entry, i) => {
                          const isReply = entry.type === "client_reply";
                          const isInfoReq = entry.type === "info_requested";
                          return (
                            <div key={i} className="relative pb-5 pl-6">
                              <span className={`absolute left-[-3px] top-1.5 h-2 w-2 rounded-full ring-4 ring-white ${
                                isReply ? "bg-blue-500" : isInfoReq ? "bg-orange-400" : "bg-cyan-400"
                              }`} />
                              {isReply ? (
                                <div className="inline-block rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                    Resposta do cliente
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-slate-800 whitespace-pre-line">{entry.message}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    {entry.by && <span className="text-[10px] font-medium text-blue-600">{entry.by.nome}</span>}
                                    <span className="text-[10px] text-slate-500">{fmt(entry.createdAt)}</span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-slate-800">{entry.message}</p>
                                  <div className="mt-0.5 flex items-center gap-2">
                                    {entry.by && <span className="text-[10px] font-medium text-slate-500">{entry.by.nome}</span>}
                                    <span className="text-[10px] text-slate-600">{fmt(entry.createdAt)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="relative space-y-0 border-t border-slate-100 pl-4 pt-4">
                      <div className="absolute left-4 top-7 bottom-3 w-px bg-slate-50" />
                      <p className="mb-3 pl-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Linha do tempo automática</p>
                      {[
                        { label: "Pedido criado", date: order.createdAt, color: "bg-slate-400" },
                        ...(order.assignedAt ? [{ label: `Atribuído a ${order.assignedToName ?? "alguém da equipa"}`, date: order.assignedAt, color: "bg-sky-400" }] : []),
                        ...(order.status === "aprovado" ? [{ label: "Orçamento aprovado", date: order.updatedAt, color: "bg-emerald-400" }] : []),
                        ...(order.status === "confirmado" ? [{ label: "Pedido confirmado", date: order.updatedAt, color: "bg-green-400" }] : []),
                      ].map((item, i) => (
                        <div key={i} className="relative pb-4 pl-6">
                          <span className={`absolute left-[-3px] top-1.5 h-2 w-2 rounded-full ${item.color} ring-4 ring-white`} />
                          <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                          <p className="text-[10px] text-slate-600">{fmt(item.date)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Preview" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
          <button className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-slate-900 hover:bg-white/20 transition" onClick={() => setLightbox(null)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Calendar confirm modal ───────────────────────────────────────── */}
      {calendarModalOpen && order && (() => {
        const isMov = isMudanca(order.serviceType);
        const calCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-violet-400/40 focus:outline-none focus:ring-1 focus:ring-violet-400/20 transition";
        const lbCls = "block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1.5";
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setCalendarModalOpen(false); }}
          >
            <div
              className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_40px_100px_rgba(0,0,0,0.15)]"
              style={{ maxHeight: "92vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex-shrink-0 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Agendar servico no Google Calendar</h2>
                    <p className="mt-1 text-xs text-slate-500">Confirme os dados antes de enviar para a agenda.</p>
                  </div>
                  <button
                    onClick={() => setCalendarModalOpen(false)}
                    className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-900 transition"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* Dados do evento */}
                <section className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400">Dados do evento</p>
                  <div>
                    <label className={lbCls}>Titulo do evento</label>
                    <input type="text" value={cmTitle} onChange={(e) => setCmTitle(e.target.value)} className={calCls} placeholder="Ex: Maria Silva - Mudanca" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={lbCls}>Data do servico</label>
                      <input type="date" value={cmDate} onChange={(e) => setCmDate(e.target.value)} className={calCls} />
                    </div>
                    <div>
                      <label className={lbCls}>Hora de inicio</label>
                      <input type="time" value={cmStart} onChange={(e) => setCmStart(e.target.value)} className={calCls} />
                    </div>
                    <div>
                      <label className={lbCls}>Hora de fim</label>
                      <input type="time" value={cmEnd} onChange={(e) => setCmEnd(e.target.value)} className={calCls} />
                    </div>
                  </div>

                  {/* Agenda de destino — mostra o calendário CLYON configurado */}
                  {(() => {
                    // Após agendamento, order já tem calendarTargetName; antes, lemos do env NEXT_PUBLIC_
                    const targetName =
                      order.calendarTargetName ||
                      (typeof window !== "undefined"
                        ? (window as any).__CLYON_CALENDAR_NAME ?? null
                        : null);
                    const hasTarget = !!targetName;
                    return (
                      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${hasTarget ? "border-violet-400/20 bg-violet-400/[0.05]" : "border-amber-400/20 bg-amber-400/[0.04]"}`}>
                        <svg className={`h-4 w-4 flex-shrink-0 ${hasTarget ? "text-violet-400" : "text-amber-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Agenda de destino</p>
                          {hasTarget ? (
                            <p className="mt-0.5 truncate text-sm font-semibold text-violet-200">{targetName}</p>
                          ) : (
                            <p className="mt-0.5 text-xs text-amber-400">
                              Nenhuma agenda configurada. O Google Calendar pedira para escolher ao guardar.
                            </p>
                          )}
                        </div>
                        {hasTarget && (
                          <span className="flex-shrink-0 rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            Configurado
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </section>

                {/* Cliente */}
                <section className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400">Cliente</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbCls}>Nome do cliente</label>
                      <input type="text" value={cmClientName} onChange={(e) => setCmClientName(e.target.value)} className={calCls} />
                    </div>
                    <div>
                      <label className={lbCls}>Telefone</label>
                      <input type="tel" value={cmClientPhone} onChange={(e) => setCmClientPhone(e.target.value)} className={calCls} />
                    </div>
                  </div>
                  <div>
                    <label className={lbCls}>Email (opcional)</label>
                    <input type="email" value={cmClientEmail} onChange={(e) => setCmClientEmail(e.target.value)} className={calCls} />
                  </div>
                </section>

                {/* Servico */}
                <section className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400">Servico</p>
                  <div>
                    <label className={lbCls}>Tipo de servico</label>
                    <input type="text" value={cmServiceType} onChange={(e) => setCmServiceType(e.target.value)} className={calCls} />
                  </div>
                  <div>
                    <label className={lbCls}>Descricao do trabalho</label>
                    <textarea rows={3} value={cmDescription} onChange={(e) => setCmDescription(e.target.value)} className={calCls} placeholder="Descreva o trabalho a realizar..." />
                  </div>
                </section>

                {/* Localizacao */}
                <section className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400">Localizacao</p>
                  {isMov ? (
                    <>
                      <div>
                        <label className={lbCls}>Morada de origem</label>
                        <input type="text" value={cmOriginAddress} onChange={(e) => setCmOriginAddress(e.target.value)} className={calCls} />
                      </div>
                      <div>
                        <label className={lbCls}>Morada de destino</label>
                        <input type="text" value={cmDestinationAddress} onChange={(e) => setCmDestinationAddress(e.target.value)} className={calCls} />
                      </div>
                      <div>
                        <label className={lbCls}>Percurso (opcional)</label>
                        <input type="text" value={cmRoute} onChange={(e) => setCmRoute(e.target.value)} className={calCls} placeholder="Ex: 12 km" />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className={lbCls}>Morada do servico</label>
                      <input type="text" value={cmAddress} onChange={(e) => setCmAddress(e.target.value)} className={calCls} />
                    </div>
                  )}
                </section>

                {/* Observacoes */}
                <section className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400">Observacoes</p>
                  <div>
                    <label className={lbCls}>Observacoes para a agenda (opcional)</label>
                    <textarea rows={2} value={cmNotes} onChange={(e) => setCmNotes(e.target.value)} className={calCls} placeholder="Ex: Levar embalagens extra, acesso pelo lado esquerdo..." />
                  </div>
                </section>

                {/* Descricao que vai para a agenda */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400">Descrição que irá para a agenda</p>
                    {cmDescriptionLoading && (
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        A gerar com Gemini...
                      </span>
                    )}
                    {!cmDescriptionLoading && cmCalendarDescription && (
                      <span className="text-[10px] text-violet-400/70">Editável — alterações serão enviadas para a agenda</span>
                    )}
                  </div>
                  <textarea
                    rows={10}
                    value={cmCalendarDescription}
                    onChange={(e) => setCmCalendarDescription(e.target.value)}
                    className={`${calCls} font-mono text-xs`}
                    placeholder={cmDescriptionLoading ? "A gerar descrição..." : "A descrição será gerada automaticamente ao abrir o modal. Pode editar antes de agendar."}
                    disabled={cmDescriptionLoading}
                  />
                  <p className="text-[10px] text-slate-600">Se deixar em branco, a rota gera automaticamente a descrição com os dados do pedido.</p>
                </section>

                {/* Messages */}
                {cmError && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs font-semibold leading-relaxed text-red-400">{cmError}</p>
                    </div>

                    {/* API not enabled */}
                    {cmApiDisabledUrl && (
                      <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2.5 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Como resolver</p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          A <strong>Google Calendar API</strong> precisa de ser activada no Google Cloud Console.
                        </p>
                        <a
                          href={cmApiDisabledUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-400/20"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Activar Google Calendar API
                        </a>
                        <p className="text-[10px] text-slate-500">Depois de activar, aguarde 1-2 minutos e tente novamente.</p>
                      </div>
                    )}

                    {/* Calendar not shared with Service Account */}
                    {cmErrorCode === "calendar_not_found" && !cmApiDisabledUrl && (
                      <div className="rounded-lg border border-sky-400/20 bg-sky-400/[0.05] px-3 py-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Como resolver — 3 passos</p>
                        <ol className="space-y-2 text-xs text-slate-700 leading-relaxed list-none">
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-sky-400/40 text-[9px] font-bold text-sky-400">1</span>
                            Abra o <strong>Google Calendar</strong> com a conta <strong>geral@clyon.pt</strong>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-sky-400/40 text-[9px] font-bold text-sky-400">2</span>
                            Clique nos <strong>3 pontos</strong> ao lado de <em>Organização CLYON</em> &rarr; <strong>Definições e partilha</strong>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-sky-400/40 text-[9px] font-bold text-sky-400">3</span>
                            Em <strong>Partilhado com pessoas específicas</strong> adicione o email da Service Account com permissão <em>Fazer alterações nos eventos</em>
                          </li>
                        </ol>
                        <a
                          href="https://calendar.google.com/calendar/r/settings"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-bold text-sky-300 transition hover:bg-sky-400/20"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Abrir definições do Google Calendar
                        </a>
                      </div>
                    )}
                  </div>
                )}
                {cmMsg && (
                  <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 flex-shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-xs font-semibold text-violet-700">{cmMsg}</p>
                    </div>
                    {cmTargetName && (
                      <div className="flex items-center gap-2 rounded-lg border border-violet-400/15 bg-violet-400/[0.06] px-3 py-2">
                        <svg className="h-3.5 w-3.5 flex-shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-slate-400">Agenda: <span className="font-semibold text-violet-200">{cmTargetName}</span></span>
                      </div>
                    )}
                    {order.calendarEventUrl && (
                      <a
                        href={order.calendarEventUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-200 hover:underline"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Ver evento na agenda
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setCalendarModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleScheduleModal}
                  disabled={cmScheduling || !cmDate || !cmStart || !cmEnd}
                  className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-violet-400 disabled:opacity-50 transition"
                >
                  {cmScheduling ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {cmScheduling ? "A agendar..." : order.calendarEventId ? "Atualizar agenda" : "Agendar agora"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Accept prompt (assistente) ── */}
      {showAcceptPrompt && order && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.15)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <svg className="h-6 w-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Aceitar pedido #{order.id}?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Ao aceitar, terá acesso ao contacto completo do cliente e será cobrado o valor por pedido aceite.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAcceptPrompt(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >Cancelar</button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/pedidos/${order.id}/accept`, {
                      method: "POST",
                      headers: authHeader,
                    });
                    if (res.ok) {
                      setShowAcceptPrompt(false);
                      const data = await res.json();
                      if (data.order) setOrder(data.order);
                      onUpdated?.(data.order ?? order);
                    } else {
                      const err = await res.json();
                      setError(err.error || "Erro ao aceitar pedido.");
                      setShowAcceptPrompt(false);
                    }
                  } catch {
                    setError("Erro de ligação ao aceitar.");
                    setShowAcceptPrompt(false);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-2.5 text-sm font-bold text-white hover:bg-cyan-400 transition"
              >
                Aceitar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pedir info dialog ── */}
      {showPedirInfo && order && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.15)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10">
              <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Pedir informação ao cliente</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Escreva a informação em falta. Esta mensagem será enviada para a conta do cliente e o status do pedido passa a &quot;Precisa info&quot;.
            </p>
            <textarea
              rows={5}
              value={pedirInfoText}
              onChange={(e) => setPedirInfoText(e.target.value)}
              placeholder="Ex: Pode confirmar quantos volumes tem ao todo? Precisamos de fotos das peças maiores para a estimativa final."
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20"
              autoFocus
            />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowPedirInfo(false); setPedirInfoText(""); }}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >Cancelar</button>
              <button
                type="button"
                disabled={pedirInfoSending || !pedirInfoText.trim()}
                onClick={async () => {
                  if (!pedirInfoText.trim()) return;
                  setPedirInfoSending(true);
                  try {
                    const res = await fetch(`/api/admin/pedidos/${order.id}/pedir-info`, {
                      method: "POST",
                      headers: { ...authHeader, "Content-Type": "application/json" },
                      body: JSON.stringify({ message: pedirInfoText.trim() }),
                    });
                    const data = await safeJson(res);
                    if (!res.ok) throw new Error(data?.error || "Erro ao enviar pedido de info");
                    const updated = data?.order ?? { ...order, status: "precisa_info", mensagemCliente: pedirInfoText.trim() };
                    setOrder(updated);
                    setEditStatus("precisa_info");
                    setEditMensagemCliente(pedirInfoText.trim());
                    setSaveMsg("Pedido de informação enviado ao cliente!");
                    setTimeout(() => setSaveMsg(""), 3000);
                    onUpdated?.(updated);
                    setShowPedirInfo(false);
                    setPedirInfoText("");
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setPedirInfoSending(false);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 transition"
              >
                {pedirInfoSending ? "A enviar..." : "Enviar ao cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {showDelete && order && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.15)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10">
              <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Excluir pedido #{order.id}?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Esta ação irá remover o pedido definitivamente da base de dados e{" "}
              <span className="font-semibold text-red-300">não poderá ser desfeita</span>.
            </p>
            <p className="mt-4 text-sm text-slate-400">
              Para confirmar, escreva <span className="font-mono font-bold text-red-400">EXCLUIR</span>:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className={`mt-2 ${inputCls}`}
              placeholder="EXCLUIR"
              autoFocus
            />
            {error && (
              <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">{error}</p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDelete(false); setDeleteConfirm(""); setError(""); }}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >Cancelar</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== "EXCLUIR"}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-slate-900 hover:bg-red-400 disabled:opacity-40 transition"
              >
                {deleting ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
                {deleting ? "A excluir..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * A quem o pedido chegou — e a quem não chegou, com o motivo por extenso.
 *
 * A lista por profissional saiu dos cartões do painel de negociações: com
 * mil profissionais era uma parede. Quem quer saber abre o pedido e vê aqui
 * os dois lados, incluindo "conta suspensa" e "fora do raio" — os motivos que
 * o painel só mostrava agregados no momento do envio, e nunca mais.
 */
function DistribuicaoTab({ pedidoId, token }: { pedidoId: number; token: string }) {
  const [aVerificar, setAVerificar] = useState(false);
  const [versao, setVersao] = useState(0);
  const [dados, setDados] = useState<{
    receberam: Array<{ providerId: number; nome: string; negociacao: { estado: string; valorAcordado: number | null } | null; distanciaKm: number | null }>;
    naoReceberam: Array<{ providerId: number; nome: string; motivos: string[]; distanciaKm: number | null }>;
  } | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pedidos/${pedidoId}/distribuicao`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (!vivo) return;
        if (!res.ok) setErro(d.error ?? "Não foi possível avaliar.");
        else setDados(d);
      } catch {
        if (vivo) setErro("Erro de rede.");
      }
    })();
    return () => {
      vivo = false;
    };
    // `versao` recarrega a lista depois de verificar/enviar.
  }, [pedidoId, token, versao]);

  if (erro) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>;
  }
  if (!dados) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" aria-label="A carregar" />
      </div>
    );
  }

  const km = (v: number | null) => (v != null ? ` · ${Math.round(v)} km` : "");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">
            Receberam o pedido ({dados.receberam.length})
          </h3>
          {/*
            Enviar passa SEMPRE pela verificação: o botão não dispara nada —
            abre o editor da plataforma pré-preenchido, e o enviar só aparece
            DEPOIS de gravar. Foi o #220 que ditou a regra: quatro
            profissionais a propor às cegas sobre um pedido sem descrição.
            E só existe enquanto ninguém recebeu — um pedido já distribuído
            gere-se nas Negociações, não se redistribui daqui.
          */}
          {dados.receberam.length === 0 && (
            <button
              type="button"
              onClick={() => setAVerificar(true)}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-400"
            >
              Verificar e enviar aos profissionais
            </button>
          )}
        </div>
        {dados.receberam.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Ninguém. O pedido ainda não foi enviado, ou nenhum profissional era
            elegível na altura — os motivos estão na lista de baixo.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {dados.receberam.map((r) => (
              <li
                key={r.providerId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">
                  {r.nome}
                  <span className="font-normal text-slate-400">{km(r.distanciaKm)}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {r.negociacao?.estado ?? "—"}
                  {r.negociacao?.valorAcordado != null &&
                    ` · ${r.negociacao.valorAcordado.toFixed(2).replace(".", ",")} €`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-base font-bold text-slate-900">
          Não receberam ({dados.naoReceberam.length})
        </h3>
        {dados.naoReceberam.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chegou a todos os profissionais registados.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {dados.naoReceberam.map((r) => (
              <li
                key={r.providerId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">
                  {r.nome}
                  <span className="font-normal text-slate-400">{km(r.distanciaKm)}</span>
                </span>
                <span className="text-xs text-amber-800">{r.motivos.join("; ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        A elegibilidade é avaliada AGORA, com o perfil actual de cada um — quem
        mudou de zonas ou foi suspenso depois do envio aparece com o estado de
        hoje. O histórico do pedido guarda o que aconteceu na altura.
      </p>

      {aVerificar && (
        <div
          /*
            Ecrã INTEIRO e fundo sólido, como o modal grande — não uma janela
            flutuante sobre um véu. Com o pano de fundo a 60%, o separador de
            trás lia-se através da moldura e parecia tudo sobreposto e partido.
          */
          className="fixed inset-0 z-[60] overflow-y-auto bg-[#0B1220] p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAVerificar(false);
              setVersao((v) => v + 1);
            }
          }}
        >
          <div className="mx-auto max-w-5xl">
            <RegistarPedido
              editarId={pedidoId}
              podeEnviarAoGravar
              onCriado={() => setVersao((v) => v + 1)}
              onFechar={() => {
                setAVerificar(false);
                setVersao((v) => v + 1);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
