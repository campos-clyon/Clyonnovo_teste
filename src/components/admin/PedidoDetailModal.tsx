"use client";

import { useCallback, useEffect, useState } from "react";
import { BUSINESS_PHONE } from "@/lib/seo-data";
import { tElevator, tParking, tUrgency, tService, tEntulho } from "@/lib/translations";

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
  sem_assistente:         { label: "Fila geral",          dot: "bg-yellow-500",  badge: "bg-yellow-50 border-yellow-200 text-yellow-700" },
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
  { id: "atribuicao",      label: "Atribuição" },
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
function fmtEur(v?: string | null) {
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : `${n.toFixed(2)} €`;
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
  colabFuncao?: string;
  onClose: () => void;
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

export default function PedidoDetailModal({ id, token, isAdmin, colabId, colabFuncao, onClose, onDeleted, onUpdated }: Props) {
  const authHeader = { Authorization: `Bearer ${token}` };

  const [order, setOrder] = useState<PedidoOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("geral");
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
  const [assistants, setAssistants] = useState<{ id: number; nome: string; activePedidos?: number }[]>([]);
  const [editAssignedToId, setEditAssignedToId] = useState<number | null>(null);

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
    setEditContactName(o.contactName ?? "");
    setEditContactPhone(o.contactPhone ?? "");
    setEditContactEmail(o.contactEmail ?? "");
    // normalizeServiceType retorna o valor interno canónico (ex: "mudanca", "recolha_moveis")
    setEditServiceType(normalizeServiceType(o.serviceType));
    setEditDescription(o.description ?? "");
    setEditUrgency(o.urgency ?? "");
    setEditAddress(o.address ?? "");
    setEditCity(o.city ?? "");
    setEditPostalCode(o.postalCode ?? "");
    setEditFloor(o.floor ?? "");
    setEditHasElevator(o.hasElevator ?? "");
    setEditParkingDistance(o.parkingDistance ?? "");
    setEditDistanceKm(o.distanceKm ?? "");
    setDistanceMsg("");
    setEditPrecoFinal(o.precoFinal ?? "");
    setEditPrecoFinalIva(o.precoFinalIva ?? "");
    setEditMensagemCliente(o.mensagemCliente ?? "");
    setEditNotasInternas(o.notasInternas ?? "");
    setEditStatus(o.status);
    setEditPriority(o.priority ?? "normal");
    setEditDataAgendada(o.dataAgendada ? o.dataAgendada.slice(0, 16) : "");
    setEditAssignedToId(o.assignedToId ?? null);
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

  // Fetch lista de assistentes quando admin abre a aba de atribuição
  useEffect(() => {
    if (!isAdmin || (activeTab !== "atribuicao") || assistants.length > 0) return;
    fetch("/api/admin/assistentes", { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        const list = data?.assistants ?? data?.assistentes ?? [];
        setAssistants(list);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab]);

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
        status: editStatus,
        priority: editPriority,
        dataAgendada: editDataAgendada || null,
      };
      if (isAdmin) {
        body.precoFinal = editPrecoFinal || null;
        body.precoFinalIva = editPrecoFinalIva || null;
        // Atribuição de assistente — deriva o nome a partir da lista carregada
        body.assignedToId = editAssignedToId ?? null;
        body.assignedToName = editAssignedToId
          ? (assistants.find((a) => a.id === editAssignedToId)?.nome ?? order.assignedToName ?? null)
          : null;
        // Se estamos a atribuir e o pedido ainda está sem assistente, muda status para atribuido
        if (editAssignedToId && !order.assignedToId && body.status === "sem_assistente") {
          body.status = "atribuido";
          setEditStatus("atribuido");
        }
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#ccccff]/50 backdrop-blur-sm p-2"
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-[28px] border border-[#ccccff] bg-[#e8e8ff] shadow-[0_40px_120px_rgba(204,204,255,0.4)]"
        style={{ maxWidth: "min(1800px, 98vw)", maxHeight: "97vh", height: "97vh" }}
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
          const waMsg = encodeURIComponent(
            `Olá ${order.contactName ?? "cliente"}, a CLYON está a contactar relativamente ao seu pedido #${order.id} de ${order.serviceType ?? "serviço"}.`
          );

          return (
            <div className="flex flex-col" style={{ height: "94vh", maxHeight: "94vh" }}>
              {/* ── Header ── */}
              <div className="flex-shrink-0 border-b border-slate-100 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Pedido #{order.id} · Simulador
                    </p>
                    <h2 className="mt-0.5 text-xl font-bold text-slate-900 truncate">
                      {shouldMask ? _maskName(order.contactName) : (order.contactName ?? "Cliente sem nome")}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={order.status} />
                      {order.priority && order.priority !== "normal" && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          order.priority === "urgente" ? "text-red-600" :
                          order.priority === "alta" ? "text-amber-600" : "text-slate-500"
                        }`}>{order.priority}</span>
                      )}
                      {order.assignedToName ? (
                        <span className="text-xs text-slate-500">
                          Assistente: <span className="font-semibold text-sky-600">{order.assignedToName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-700">
                          Fila geral
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{fmt(order.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    {acceptMsg && (
                      <span className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                        {acceptMsg}
                      </span>
                    )}
                    {saveMsg && (
                      <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {saveMsg}
                      </span>
                    )}
                    {/* Aceitar pedido — visível apenas para assistentes quando pedido está na fila geral */}
                    {!isAdmin && colabFuncao === "assistente" && !order.assignedToId && (
                      <button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="flex items-center gap-1.5 rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition"
                      >
                        {accepting ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {accepting ? "A aceitar..." : "Aceitar pedido"}
                      </button>
                    )}
                    {/* Pedido já atribuído a outra assistente */}
                    {!isAdmin && colabFuncao === "assistente" && order.assignedToId && order.assignedToId !== colabId && (
                      <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                        Atribuído a {order.assignedToName}
                      </span>
                    )}
                    {error && !showDelete && (
                      <span className="rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 max-w-[200px] truncate">
                        {error}
                      </span>
                    )}
                    {/* Guardar */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition"
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
                      className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-400/20 disabled:opacity-60 transition"
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
                      className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-400/20 disabled:opacity-60 transition"
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
                      className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-400/20 disabled:opacity-60 transition"
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
                        className="hidden md:flex items-center gap-1.5 rounded-2xl border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-semibold text-green-300 hover:bg-green-400/20 transition"
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
                        className="hidden md:flex items-center gap-1.5 rounded-2xl border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-semibold text-green-300 hover:bg-green-400/20 transition"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.528 5.845L.057 23.455a.5.5 0 00.614.6l5.757-1.508A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.933 0-3.746-.523-5.302-1.434l-.38-.222-3.938 1.031 1.046-3.82-.247-.393A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                        </svg>
                        WhatsApp
                      </a>
                    )}
                    {/* Agendar serviço — admin ou assistente responsável, pedido aprovado/confirmado/em_execucao */}
                    {(isAdmin || (colabFuncao === "assistente" && order.assignedToId === colabId)) &&
                      (["aprovado", "confirmado", "em_execucao"].includes(order.status) || !!order.scheduledDate) && (
                        /* Both states (scheduled or not) open the confirm modal.
                           "Abrir no Google Calendar" is shown after scheduling inside the modal itself. */
                        <button
                          onClick={openCalendarModal}
                          className="hidden lg:flex items-center gap-1.5 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-400/20 transition"
                          title={order.calendarEventId ? `Atualizar agenda (agendado para ${order.scheduledDate} ${order.scheduledStartTime}–${order.scheduledEndTime})` : "Agendar no Google Calendar"}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {order.calendarEventId ? "Atualizar agenda" : "Agendar no Google Calendar"}
                        </button>
                      )
                    }
                    {/* Excluir — apenas admin geral */}
                    {isAdmin && <button
                      onClick={() => setShowDelete(true)}
                      className="flex items-center gap-1.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Excluir
                    </button>}
                    {/* Fechar */}
                    <button
                      onClick={onClose}
                      className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Tabs ── */}
              <div className="flex-shrink-0 overflow-x-auto border-b border-slate-100 px-6">
                <div className="flex gap-0.5 py-2">
                  {TABS.map((tab) => {
                    const isDisabled = shouldMask && tab.id === "cliente_morada";
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (isDisabled) { setShowAcceptPrompt(true); return; }
                          setActiveTab(tab.id);
                        }}
                        disabled={isDisabled}
                        title={isDisabled ? "Aceite o pedido para ver os dados completos do cliente" : undefined}
                        className={`flex-shrink-0 rounded-[12px] px-4 py-1.5 text-xs font-semibold transition ${
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
                      </button>
                    );
                  })}
                </div>
              </div>

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
                  const vatAmount = estVal?.vatAmount ?? (order.estimateTotal ? parseFloat(order.estimateTotal) * 0.23 : null);
                  const totalWithVat = estVal?.estimatedPriceWithVat ?? (order.estimateTotal ? parseFloat(order.estimateTotal) * 1.23 : null);

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
                    {(order.estimateTotal || order.precoFinal) && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-[16px] border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-500">
                            {order.precoFinal ? "Preço s/IVA" : "Estimativa s/IVA"}
                          </p>
                          <p className="mt-1.5 text-xl font-bold text-emerald-700">
                            {fmtEur(order.precoFinal) ?? fmtEur(order.estimateTotal) ?? "—"}
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
                            { label: "Assistente", value: order.assignedToName ?? "Fila geral" },
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
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`} target="_blank" rel="noreferrer"
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
                              ...(order.assignedAt ? [{ label: `Atribuído a ${order.assignedToName ?? "assistente"}`, date: order.assignedAt, color: "bg-sky-400" }] : []),
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
                          <Field label="Andar">
                            <input type="text" value={editFloor} onChange={(e) => setEditFloor(e.target.value)} className={inputCls} placeholder="Ex: 3º andar" />
                          </Field>
                          <Field label="Elevador">
                            <select value={editHasElevator} onChange={(e) => setEditHasElevator(e.target.value)} className={selectCls}>
                              <option value="" className={optionCls}>Não informado</option>
                              <option value="sim" className={optionCls}>Sim</option>
                              <option value="nao" className={optionCls}>Não</option>
                            </select>
                          </Field>
                          <Field label="Distância de estacionamento">
                            <select value={editParkingDistance} onChange={(e) => setEditParkingDistance(e.target.value)} className={selectCls}>
                              <option value="" className={optionCls}>Não informado</option>
                              <option value="porta" className={optionCls}>À porta</option>
                              <option value="proximo" className={optionCls}>Próximo (até 50m)</option>
                              <option value="medio" className={optionCls}>Médio (50-200m)</option>
                              <option value="longe" className={optionCls}>Longe (mais de 200m)</option>
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

                          {est.summary && (
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-400 mb-1">Resumo</p>
                              <p className="text-xs leading-relaxed text-slate-700">{est.summary}</p>
                            </div>
                          )}
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
                      <h3 className="text-base font-bold text-slate-900">Fotos e ficheiros</h3>
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
                    <h3 className="text-base font-bold text-slate-900">Atribuição e status</h3>
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
                    {/* Atribuição de assistente — editável apenas para admin */}
                    {isAdmin ? (
                      <div className="space-y-3">
                        <Field label="Assistente responsável">
                          <select
                            value={editAssignedToId ?? ""}
                            onChange={(e) => setEditAssignedToId(e.target.value ? Number(e.target.value) : null)}
                            className={selectCls}
                          >
                            <option value="" className={optionCls}>Sem atribuição (fila geral)</option>
                            {assistants.map((a) => (
                              <option key={a.id} value={a.id} className={optionCls}>
                                {a.nome}{a.activePedidos !== undefined ? ` — ${a.activePedidos} pedido${a.activePedidos !== 1 ? "s" : ""} activo${a.activePedidos !== 1 ? "s" : ""}` : ""}
                              </option>
                            ))}
                          </select>
                          {assistants.length === 0 && (
                            <p className="mt-1.5 text-[11px] text-slate-500">A carregar assistentes...</p>
                          )}
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <ReadonlyField label="Atribuído em" value={order.assignedAt ? fmt(order.assignedAt) : null} />
                          <ReadonlyField label="Criado em" value={fmt(order.createdAt)} />
                          <ReadonlyField label="Última atualização" value={fmt(order.updatedAt)} />
                          {(order as any).acceptedAt && (
                            <ReadonlyField label="Aceite em" value={fmt((order as any).acceptedAt)} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <ReadonlyField label="Assistente atribuída" value={order.assignedToName ?? "Fila geral"} />
                        <ReadonlyField label="Atribuído em" value={order.assignedAt ? fmt(order.assignedAt) : null} />
                        <ReadonlyField label="Última atualização" value={fmt(order.updatedAt)} />
                        <ReadonlyField label="Criado em" value={fmt(order.createdAt)} />
                      </div>
                    )}
                    <Field label="Notas internas (visíveis apenas no backoffice)">
                      <textarea rows={4} value={editNotasInternas} onChange={(e) => setEditNotasInternas(e.target.value)} className={inputCls} placeholder="Notas para a equipa..." />
                    </Field>
                    <div className="flex justify-end">
                      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                        {saving ? "A guardar..." : "Guardar alterações"}
                      </button>
                    </div>

                    {/* ── Agenda do serviço ──────────────────────────────── */}
                    {(isAdmin || (colabFuncao === "assistente" && order.assignedToId === colabId)) && (
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
                              className="flex items-center gap-1.5 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-400/20 transition"
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
                        {history.map((entry, i) => (
                          <div key={i} className="relative pb-5 pl-6">
                            <span className="absolute left-[-3px] top-1.5 h-2 w-2 rounded-full bg-cyan-400 ring-4 ring-white" />
                            <p className="text-xs font-semibold text-slate-800">{entry.message}</p>
                            <div className="mt-0.5 flex items-center gap-2">
                              {entry.by && <span className="text-[10px] font-medium text-slate-500">{entry.by.nome}</span>}
                              <span className="text-[10px] text-slate-600">{fmt(entry.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="relative space-y-0 border-t border-slate-100 pl-4 pt-4">
                      <div className="absolute left-4 top-7 bottom-3 w-px bg-slate-50" />
                      <p className="mb-3 pl-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Linha do tempo automática</p>
                      {[
                        { label: "Pedido criado", date: order.createdAt, color: "bg-slate-400" },
                        ...(order.assignedAt ? [{ label: `Atribuído a ${order.assignedToName ?? "assistente"}`, date: order.assignedAt, color: "bg-sky-400" }] : []),
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
                    const res = await fetch(`/api/admin/pedidos/${order.id}`, {
                      method: "PATCH",
                      headers: { ...authHeader, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        status: "precisa_info",
                        mensagemCliente: pedirInfoText.trim(),
                      }),
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
