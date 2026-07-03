"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { BUSINESS_PHONE } from "@/lib/seo-data";
import { translate, tElevator, tParking, tUrgency, tService, tFloor, FIELD_TRANSLATIONS } from "@/lib/translations";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pendente" | "atribuido" | "em_analise" | "precisa_info"
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

type Order = {
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
  analysisJsonExtended?: string | null;
  rawOrderJson?: string | null;
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
  historyJson?: string | null;
  reviewJson?: string | null;
  dataAgendada?: string | null;
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
  summary?: string;
  assumptions?: string[];
  missingFields?: string[];
  customerMessage?: string;
  internalNotes?: string[];
  analysisSource?: string;
  confidence?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OrderStatus, { label: string; dot: string; badge: string }> = {
  pendente:               { label: "Pendente",            dot: "bg-amber-400",   badge: "bg-amber-400/10 border-amber-400/30 text-amber-300" },
  atribuido:              { label: "Atribuído",           dot: "bg-sky-400",     badge: "bg-sky-400/10 border-sky-400/30 text-sky-300" },
  em_analise:             { label: "Em análise",          dot: "bg-violet-400",  badge: "bg-violet-400/10 border-violet-400/30 text-violet-300" },
  precisa_info:           { label: "Precisa info",        dot: "bg-orange-400",  badge: "bg-orange-400/10 border-orange-400/30 text-orange-300" },
  estimativa_pronta:      { label: "Estimativa pronta",   dot: "bg-teal-400",    badge: "bg-teal-400/10 border-teal-400/30 text-teal-300" },
  presencial_recomendado: { label: "Presencial rec.",     dot: "bg-indigo-400",  badge: "bg-indigo-400/10 border-indigo-400/30 text-indigo-300" },
  aprovado:               { label: "Aprovado",            dot: "bg-cyan-400",    badge: "bg-cyan-400/10 border-cyan-400/30 text-cyan-300" },
  enviado_cliente:        { label: "Enviado",             dot: "bg-blue-400",    badge: "bg-blue-400/10 border-blue-400/30 text-blue-300" },
  confirmado:             { label: "Confirmado",          dot: "bg-green-400",   badge: "bg-green-400/10 border-green-400/30 text-green-300" },
  em_execucao:            { label: "Em execução",         dot: "bg-lime-400",    badge: "bg-lime-400/10 border-lime-400/30 text-lime-300" },
  concluido:              { label: "Concluído",           dot: "bg-emerald-400", badge: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300" },
  cancelado:              { label: "Cancelado",           dot: "bg-slate-500",   badge: "bg-slate-500/10 border-slate-500/30 text-slate-400" },
  rejeitado:              { label: "Rejeitado",           dot: "bg-red-500",     badge: "bg-red-500/10 border-red-500/30 text-red-400" },
};

const ALL_STATUSES: OrderStatus[] = [
  "pendente", "atribuido", "em_analise", "precisa_info",
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

// Aliases de compatibilidade — delegar para traduções centralizadas
const ANALYSIS_SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  clyon_pricing:                    { label: "Preçário CLYON (Gemini)", color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
  clyon_pricing_plus_web_reference: { label: "Preçário + Web",          color: "text-teal-400 border-teal-400/30 bg-teal-400/10" },
  web_reference_only:               { label: "Apenas web",              color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  needs_human_review:               { label: "Revisão humana necessária", color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  gemini_reference:                 { label: "Referência Gemini (preço 0)", color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  fallback_reference:               { label: "Referência interna (fallback)", color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  timeout_fallback:                 { label: "Timeout Gemini — Estimativa local", color: "text-red-400 border-red-400/30 bg-red-400/10" },
  local_fast_estimate:              { label: "Estimativa local (sem Gemini)", color: "text-slate-400 border-slate-400/30 bg-slate-400/10" },
};

const TABS = [
  { id: "geral",     label: "Geral" },
  { id: "cliente",   label: "Cliente" },
  { id: "servico",   label: "Serviço" },
  { id: "morada",    label: "Morada" },
  { id: "estimativa",label: "Estimativa" },
  { id: "fotos",     label: "Fotos" },
  { id: "atribuicao",label: "Atribuição" },
  { id: "historico", label: "Histórico" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Muito fácil", 2: "Fácil", 3: "Moderado", 4: "Difícil", 5: "Muito difícil",
};
const DIFFICULTY_COLOR: Record<number, string> = {
  1: "text-emerald-400", 2: "text-green-400", 3: "text-amber-400", 4: "text-orange-400", 5: "text-red-400",
};

// ─── Helpers ───────────────────────────────────��──────────────────────────────

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
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">{label}</p>
      <p className="text-sm font-medium text-slate-200">{value || "—"}</p>
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition";
const selectCls = "w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition appearance-none cursor-pointer";
const optionCls = "bg-[#111827] text-white";

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPedidoDetalheClient({ id }: { id: number }) {
  const { token, ready, authHeader, user } = useAdminAuth();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("geral");

  // Edit state — mirrors all editable fields
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
  const [editPrecoFinal, setEditPrecoFinal] = useState("");
  const [editPrecoFinalIva, setEditPrecoFinalIva] = useState("");
  const [editMensagemCliente, setEditMensagemCliente] = useState("");
  const [editNotasInternas, setEditNotasInternas] = useState("");
  const [editStatus, setEditStatus] = useState<OrderStatus>("pendente");
  const [editPriority, setEditPriority] = useState<OrderPriority>("normal");
  const [editDataAgendada, setEditDataAgendada] = useState("");

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Image lightbox
  const [lightbox, setLightbox] = useState<string | null>(null);

  function populateEdit(o: Order) {
    // Extrair rawOrderJson como fallback para campos que podem estar null na DB
    // mas presentes no JSON original do simulador
    let raw: Record<string, any> = {};
    try { raw = o.rawOrderJson ? JSON.parse(o.rawOrderJson) : {}; } catch { raw = {}; }

    // Extrair estimativa para auto-preencher preço final quando ainda não definido
    let estData: GeminiEstimate | null = null;
    try { estData = o.estimateJson ? JSON.parse(o.estimateJson) : null; } catch { estData = null; }

    setEditContactName(o.contactName || "");
    setEditContactPhone(o.contactPhone || "");
    setEditContactEmail(o.contactEmail || "");

    // P6: serviceType — usar rawOrderJson como fallback se DB tiver null ou ""
    setEditServiceType(o.serviceType || raw.serviceType || raw.service_type || "");

    setEditDescription(o.description || "");

    // P3: urgency — usar rawOrderJson como fallback
    setEditUrgency(o.urgency || raw.urgency || raw.urgencia || "");

    setEditAddress(o.address || "");
    setEditCity(o.city || raw.address?.city || raw.city || "");
    setEditPostalCode(o.postalCode || raw.address?.postalCode || raw.postalCode || "");
    setEditFloor(o.floor || raw.floor || "");

    // P4: elevador e estacionamento — fallback abrangente para todos os possíveis
    // nomes de campo no rawOrderJson (camelCase, snake_case, PT, acessos aninhados)
    const rawElevator =
      raw.hasElevator || raw.has_elevator || raw.elevador ||
      raw.elevator || raw.access?.elevator || raw.access?.hasElevator ||
      raw.originAccess?.hasElevator || "";
    setEditHasElevator(o.hasElevator || rawElevator);

    const rawParking =
      raw.parkingDistance || raw.parking_distance || raw.estacionamento ||
      raw.parking || raw.parkingInfo || raw.access?.parking ||
      raw.access?.parkingDistance || raw.originAccess?.parkingDistance || "";
    setEditParkingDistance(o.parkingDistance || rawParking);

    // P1: auto-preencher preço final com estimativa recomendada quando confidence é high/medium
    const alreadyHasPrice = !!(o.precoFinal && parseFloat(o.precoFinal) > 0);
    const conf = estData?.confidence ?? "";
    const canAutoFill = !alreadyHasPrice && (conf === "high" || conf === "medium");
    const recPrice = estData?.estimatedPriceWithoutVat;
    const recPriceIva = estData?.estimatedPriceWithVat;

    setEditPrecoFinal(alreadyHasPrice
      ? o.precoFinal!
      : canAutoFill && recPrice != null
        ? String(recPrice.toFixed(2))
        : o.precoFinal ?? "");

    setEditPrecoFinalIva(alreadyHasPrice
      ? (o.precoFinalIva ?? "")
      : canAutoFill && recPriceIva != null
        ? String(recPriceIva.toFixed(2))
        : o.precoFinalIva ?? "");

    setEditMensagemCliente(o.mensagemCliente ?? estData?.customerMessage ?? "");
    setEditNotasInternas(o.notasInternas ?? "");
    setEditStatus(o.status);
    setEditPriority(o.priority ?? "normal");
    setEditDataAgendada(o.dataAgendada ? o.dataAgendada.slice(0, 16) : "");
  }

  const fetchOrder = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/pedidos/${id}`, { headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pedido não encontrado");
      setOrder(data.order);
      setIsAdmin(!!data.order?.isAdmin || !!user?.isAdmin);
      populateEdit(data.order);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, id, authHeader]);

  useEffect(() => { if (ready) fetchOrder(); }, [ready, fetchOrder]);

  // Derive isAdmin from user object
  useEffect(() => {
    if (user) setIsAdmin(!!(user as any).isAdmin);
  }, [user]);

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
      }
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao guardar");
      setOrder(data.order);
      populateEdit(data.order);
      setSaveMsg("Guardado com sucesso!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e: any) {
      setError(e.message);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir");
      router.push("/admin/pedidos");
    } catch (e: any) {
      setError(e.message);
      setDeleting(false);
    }
  }

  async function handleApprove() {
    if (!order) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "aprovado" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setOrder(data.order);
      setEditStatus("aprovado");
      setSaveMsg("Orçamento aprovado!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setOrder(data.order);
      setEditStatus(newStatus);
      setSaveMsg("Status atualizado!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  // ����── Render guards ──────────────────────────────────────────────────────────

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#070e17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-500">A carregar pedido...</p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-[#070e17] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-red-400/20 bg-red-400/10">
            <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">{error}</h2>
          <button onClick={() => router.back()} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] transition">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const est = parseEstimate(order.estimateJson);
  const history = parseHistory(order.historyJson);
  const files = parseFiles(order.filesJson);
  // Dados brutos do formulário (para campos como entulhoQuantidade)
  const rawOrder: Record<string, any> = (() => {
    try { return order.rawOrderJson ? JSON.parse(order.rawOrderJson) : {}; } catch { return {}; }
  })();
  // Dados da análise alargada (analysisSource, confidence, etc.)
  const analysisExt: Record<string, any> = (() => {
    try { return order.analysisJsonExtended ? JSON.parse(order.analysisJsonExtended) : {}; } catch { return {}; }
  })();
  const analysisSource: string = analysisExt.analysisSource ?? est?.analysisSource ?? "";
  const entulhoQtd: string | null = rawOrder.entulhoQuantidade ?? null;
  const entulhoState: string | null = rawOrder.entulhoState ?? null;

  // Campos de leitura com fallback para rawOrder.
  // Usar || em vez de ?? para também tratar string vazia "" como ausente
  // (pedidos antigos podem ter "" em vez de null nas colunas da DB)
  const displayServiceType = order.serviceType || rawOrder.serviceType || rawOrder.service_type || null;
  const displayUrgency     = order.urgency || rawOrder.urgency || rawOrder.urgencia || null;
  const displayFloor       = order.floor || rawOrder.floor || rawOrder.andar || null;
  const displayElevator    =
    order.hasElevator || rawOrder.hasElevator || rawOrder.has_elevator ||
    rawOrder.elevator || rawOrder.access?.elevator || rawOrder.access?.hasElevator ||
    rawOrder.originAccess?.hasElevator || null;
  const displayParking     =
    order.parkingDistance || rawOrder.parkingDistance || rawOrder.parking_distance ||
    rawOrder.parking || rawOrder.parkingInfo || rawOrder.access?.parking ||
    rawOrder.access?.parkingDistance || rawOrder.originAccess?.parkingDistance || null;
  const displayCity        = order.city || rawOrder.address?.city || rawOrder.city || null;

  const waPhone = (order.contactPhone ?? BUSINESS_PHONE).replace(/\D/g, "");
  const waMsg = encodeURIComponent(
    `Olá ${order.contactName ?? "cliente"}, a CLYON está a contactar relativamente ao seu pedido #${order.id} de ${tService(displayServiceType) ?? "serviço"}.`
  );

  // ─── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#070e17] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-[1200px]">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.back()}
              className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white transition"
              title="Voltar"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Pedido #{order.id} · Simulador
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-white text-balance">
                {order.contactName ?? "Cliente sem nome"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                {order.priority && order.priority !== "normal" && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    order.priority === "urgente" ? "text-red-400" :
                    order.priority === "alta" ? "text-amber-400" : "text-slate-500"
                  }`}>
                    {order.priority}
                  </span>
                )}
                {order.assignedToName && (
                  <span className="text-xs text-slate-500">
                    Assistente: <span className="font-semibold text-sky-400">{order.assignedToName}</span>
                  </span>
                )}
                <span className="text-xs text-slate-600">{fmt(order.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {saveMsg && (
              <span className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                {saveMsg}
              </span>
            )}
            {error && (
              <span className="rounded-2xl border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-300">
                {error}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition"
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
            <button
              onClick={handleApprove}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-60 transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Aprovar
            </button>
            <button
              onClick={() => handleStatusQuick("precisa_info")}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-400/20 disabled:opacity-60 transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pedir info
            </button>
            <button
              onClick={() => handleStatusQuick("presencial_recomendado")}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-300 hover:bg-indigo-400/20 disabled:opacity-60 transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Presencial
            </button>
            <a
              href={`https://wa.me/${waPhone}?text=${waMsg}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-semibold text-green-300 hover:bg-green-400/20 transition"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.528 5.845L.057 23.455a.5.5 0 00.614.6l5.757-1.508A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.933 0-3.746-.523-5.302-1.434l-.38-.222-3.938 1.031 1.046-3.82-.247-.393A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              WhatsApp
            </a>
            {isAdmin && (
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Excluir pedido
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="mb-6 flex overflow-x-auto gap-1 rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 rounded-[14px] px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">

          {/* ── Aba Geral ── */}
          {activeTab === "geral" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Resumo geral</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {[
                  { label: "Pedido nº", value: `#${order.id}` },
                  { label: "Cliente", value: order.contactName },
                  { label: "Telefone", value: order.contactPhone },
                  { label: "Serviço", value: tService(displayServiceType) },
                  { label: "Status", value: STATUS_CFG[order.status]?.label ?? order.status },
                  { label: "Prioridade", value: FIELD_TRANSLATIONS.priority?.[order.priority ?? "normal"] ?? order.priority ?? "Normal" },
                  { label: "Urgência", value: tUrgency(displayUrgency) },
                  { label: "Assistente", value: order.assignedToName ?? "Não atribuído" },
                  { label: "Origem", value: "Simulador" },
                  { label: "Data de entrada", value: fmt(order.createdAt) },
                ].map((item) => (
                  <div key={item.label} className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">{item.label}</p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-200">{item.value ?? "—"}</p>
                  </div>
                ))}
              </div>

              {/* Estimativa IA: Mínimo / Máximo / Recomendado + Preço final */}
              <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Estimativa IA</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: "Mínimo s/IVA", value: fmtEur(order.estimateMin) },
                    { label: "Máximo s/IVA", value: fmtEur(order.estimateMax) },
                    { label: "Recomendado s/IVA", value: fmtEur(order.estimateTotal), highlight: true },
                    { label: "Preço final s/IVA", value: fmtEur(order.precoFinal) },
                    { label: "Preço final c/IVA", value: fmtEur(order.precoFinalIva) },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-[14px] border p-3 ${item.highlight ? "border-cyan-400/20 bg-cyan-400/5" : "border-white/[0.06] bg-white/[0.02]"}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">{item.label}</p>
                      <p className={`mt-1 text-sm font-bold ${item.highlight ? "text-cyan-300" : "text-slate-200"}`}>{item.value ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Morada e acesso — versão só leitura */}
              <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Morada e acesso</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                  { label: "Localidade", value: displayCity },
                  { label: "Andar", value: tFloor(displayFloor) || displayFloor || "—" },
                  { label: "Elevador", value: tElevator(displayElevator) },
                  { label: "Estacionamento", value: tParking(displayParking) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-300">{item.value ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Ações rápidas</p>
                <div className="flex flex-wrap gap-2">
                  {order.contactPhone && (
                    <button
                      onClick={() => navigator.clipboard.writeText(order.contactPhone!)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] transition"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copiar telefone
                    </button>
                  )}
                  <a
                    href={`https://wa.me/${waPhone}?text=${waMsg}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-400/20 transition"
                  >
                    Abrir WhatsApp
                  </a>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-60 transition"
                  >
                    Guardar alterações
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setShowDelete(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-400/20 transition"
                    >
                      Excluir pedido
                    </button>
                  )}
                </div>
              </div>

              {order.description && (
                <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Descrição do pedido</p>
                  <p className="text-sm leading-relaxed text-slate-300">{order.description}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Aba Cliente ── */}
          {activeTab === "cliente" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Dados do cliente</h2>
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
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                  {saving ? "A guardar..." : "Guardar alterações"}
                </button>
              </div>
            </div>
          )}

          {/* ── Aba Serviço ── */}
          {activeTab === "servico" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Dados do serviço</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tipo de serviço">
                  <select value={editServiceType} onChange={(e) => setEditServiceType(e.target.value)} className={selectCls}>
                    <option value="" className={optionCls}>Selecionar...</option>
                    {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value} className={optionCls}>{s.label}</option>)}
                  </select>
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
              {/* Info extra apenas leitura */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <ReadonlyField label="Distância" value={order.distanceText} />
                <ReadonlyField label="Km" value={order.distanceKm ? `${order.distanceKm} km` : null} />
              </div>
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                  {saving ? "A guardar..." : "Guardar alterações"}
                </button>
              </div>
            </div>
          )}

          {/* ── Aba Morada ── */}
          {activeTab === "morada" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Morada e acesso</h2>
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
                    <option value="yes" className={optionCls}>Sim, funciona</option>
                    <option value="small" className={optionCls}>Sim, pequeno</option>
                    <option value="no" className={optionCls}>Não tem</option>
                    <option value="unknown" className={optionCls}>Não sei</option>
                  </select>
                </Field>
                <Field label="Estacionamento">
                  <select value={editParkingDistance} onChange={(e) => setEditParkingDistance(e.target.value)} className={selectCls}>
                    <option value="" className={optionCls}>Não informado</option>
                    <option value="door" className={optionCls}>Mesmo à porta</option>
                    <option value="under_20m" className={optionCls}>Sim, até 20 metros</option>
                    <option value="over_30m" className={optionCls}>Mais de 30 metros</option>
                    <option value="difficult" className={optionCls}>Estacionamento difícil</option>
                  </select>
                </Field>
              </div>
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                  {saving ? "A guardar..." : "Guardar alterações"}
                </button>
              </div>
            </div>
          )}

          {/* ── Aba Estimativa ── */}
          {activeTab === "estimativa" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-white">Estimativa e valores</h2>
                {/* Badge: fonte da análise */}
                {analysisSource && (() => {
                  const cfg = ANALYSIS_SOURCE_LABELS[analysisSource];
                  return (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg?.color ?? "text-slate-400 border-slate-400/30 bg-slate-400/10"}`}>
                      {cfg?.label ?? analysisSource}
                    </span>
                  );
                })()}
                {/* Badge: confiança da estimativa */}
                {(est?.confidence ?? analysisExt.confidence) && (() => {
                  const conf = est?.confidence ?? analysisExt.confidence;
                  const confCfg: Record<string, string> = {
                    high:   "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
                    medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
                    low:    "text-red-400 border-red-400/30 bg-red-400/10",
                  };
                  const confLabels: Record<string, string> = { high: "Confiança alta", medium: "Confiança média", low: "Confiança baixa" };
                  return (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${confCfg[conf as string] ?? "text-slate-400 border-slate-400/30 bg-slate-400/10"}`}>
                      {confLabels[conf as string] ?? conf}
                    </span>
                  );
                })()}
              </div>

              {/* Entulho info (se aplicável) */}
              {entulhoQtd && (
                <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Nº de sacos</p>
                    <p className="mt-1 text-sm font-bold text-slate-200">{entulhoQtd}</p>
                  </div>
                  {entulhoState && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Estado</p>
                      <p className="mt-1 text-sm font-semibold text-slate-300 capitalize">{entulhoState === "chao" ? "No chão" : entulhoState === "misto" ? "Misto" : "Ensacado"}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Valores IA */}
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Estimativa da IA</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Mínimo s/IVA</p>
                    <p className="mt-1.5 text-lg font-bold text-cyan-400">{fmtEur(order.estimateMin ?? (est?.estimateMinWithoutVat != null ? String(est.estimateMinWithoutVat) : null)) ?? "—"}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Máximo s/IVA</p>
                    <p className="mt-1.5 text-lg font-bold text-cyan-400">{fmtEur(order.estimateMax ?? (est?.estimateMaxWithoutVat != null ? String(est.estimateMaxWithoutVat) : null)) ?? "—"}</p>
                  </div>
                  <div className="rounded-[20px] border border-cyan-400/10 bg-cyan-400/5 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-600">Recomendado s/IVA</p>
                    <p className="mt-1.5 text-lg font-bold text-cyan-300">{fmtEur(order.estimateTotal ?? (est?.estimatedPriceWithoutVat != null ? String(est.estimatedPriceWithoutVat) : null)) ?? "—"}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Total c/IVA</p>
                    <p className="mt-1.5 text-lg font-bold text-slate-200">{est?.estimatedPriceWithVat != null ? fmtEur(String(est.estimatedPriceWithVat)) : "—"}</p>
                  </div>
                </div>
              </div>

              {/* Análise Gemini */}
              {est && (
                <div className="rounded-[24px] border border-violet-400/20 bg-violet-400/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Detalhe da análise</span>
                    <span className="ml-auto rounded-full border border-violet-400/30 px-2 py-0.5 text-[10px] font-semibold text-violet-400">IA</span>
                  </div>
                  <div className="space-y-4">
                    {/* Dificuldade + Equipa + Horas + Recomendação */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {est.difficultyLevel && (
                        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Dificuldade</p>
                          <div className="flex gap-0.5 mb-1">
                            {[1,2,3,4,5].map((n) => (
                              <div key={n} className={`h-1.5 w-4 rounded-full ${n <= (est.difficultyLevel ?? 0) ? "bg-violet-400" : "bg-white/10"}`} />
                            ))}
                          </div>
                          <span className={`text-xs font-semibold ${DIFFICULTY_COLOR[est.difficultyLevel] ?? "text-slate-300"}`}>
                            {DIFFICULTY_LABEL[est.difficultyLevel] ?? est.difficultyLevel}
                          </span>
                        </div>
                      )}
                      {(est as any).teamSize && (
                        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Equipa</p>
                          <p className="text-xs font-semibold text-slate-300">{(est as any).teamSize}</p>
                        </div>
                      )}
                      {(est as any).estimatedHoursText && (
                        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Tempo estimado</p>
                          <p className="text-xs font-semibold text-slate-300">{(est as any).estimatedHoursText}</p>
                        </div>
                      )}
                      {(est as any).recommendation && (
                        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Recomendação</p>
                          <p className={`text-xs font-semibold ${
                            (est as any).recommendation === "pode_aprovar" ? "text-emerald-400" :
                            (est as any).recommendation === "visita_presencial" ? "text-red-400" :
                            "text-amber-400"
                          }`}>
                            {(est as any).recommendation === "pode_aprovar" ? "Pode aprovar" :
                             (est as any).recommendation === "pedir_fotos" ? "Pedir fotos" :
                             (est as any).recommendation === "pedir_info" ? "Pedir info" :
                             (est as any).recommendation === "visita_presencial" ? "Visita presencial" :
                             (est as any).recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                    {est.summary && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 mb-1.5">Resumo</p>
                        <p className="text-sm leading-relaxed text-slate-300">{est.summary}</p>
                      </div>
                    )}
                    {est.customerMessage && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500 mb-1.5">Mensagem sugerida ao cliente</p>
                        <p className="text-sm leading-relaxed text-slate-300">{est.customerMessage}</p>
                      </div>
                    )}
                    {est.assumptions && est.assumptions.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Pressupostos</p>
                        <ul className="space-y-1">
                          {est.assumptions.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {est.missingFields && est.missingFields.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-2">Campos em falta</p>
                        <ul className="space-y-1">
                          {est.missingFields.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-amber-400">
                              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                              {f.replace(/_/g, " ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {est.internalNotes && est.internalNotes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Notas internas da IA</p>
                        <ul className="space-y-1">
                          {est.internalNotes.map((n, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-600" />
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Valores finais editáveis */}
              {isAdmin && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Valores finais (editável pelo admin)</p>
                    {/* Indicador de auto-preenchimento */}
                    {!order.precoFinal && est?.estimatedPriceWithoutVat && (est.confidence === "high" || est.confidence === "medium") && (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
                        Auto-preenchido com estimativa IA — reveja antes de guardar
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Preço final sem IVA (€)">
                      <input
                        type="number" step="0.01" min="0"
                        value={editPrecoFinal}
                        onChange={(e) => {
                          setEditPrecoFinal(e.target.value);
                          // Auto-calcular c/IVA ao editar s/IVA
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) setEditPrecoFinalIva((v * 1.23).toFixed(2));
                        }}
                        className={inputCls} placeholder="0.00"
                      />
                    </Field>
                    <Field label="Preço final com IVA (€)">
                      <input
                        type="number" step="0.01" min="0"
                        value={editPrecoFinalIva}
                        onChange={(e) => setEditPrecoFinalIva(e.target.value)}
                        className={inputCls} placeholder="0.00"
                      />
                    </Field>
                  </div>
                </div>
              )}

              <Field label="Notas internas sobre o orçamento">
                <textarea rows={4} value={editNotasInternas} onChange={(e) => setEditNotasInternas(e.target.value)} className={inputCls} placeholder="Notas internas (não visíveis pelo cliente)..." />
              </Field>

              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={handleApprove} disabled={saving} className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-60 transition">
                  Aprovar orçamento
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                  {saving ? "A guardar..." : "Guardar valores"}
                </button>
              </div>
            </div>
          )}

          {/* ── Aba Fotos ── */}
          {activeTab === "fotos" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Fotos e ficheiros</h2>
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-white/10 py-16 text-center">
                  <svg className="mb-3 h-10 w-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-slate-500">Nenhum ficheiro enviado pelo cliente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {files.map((url, i) => {
                    const isImg = /\.(jpe?g|png|gif|webp|avif|heic)$/i.test(url);
                    const isVid = /\.(mp4|mov|webm|avi)$/i.test(url);
                    return (
                      <div key={i} className="group relative overflow-hidden rounded-[16px] border border-white/[0.06] bg-white/[0.02] aspect-square">
                        {isImg ? (
                          <img
                            src={url}
                            alt={`Ficheiro ${i + 1}`}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                            onClick={() => setLightbox(url)}
                          />
                        ) : isVid ? (
                          <video src={url} className="h-full w-full object-cover" controls />
                        ) : (
                          <a href={url} target="_blank" rel="noreferrer" className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center hover:bg-white/[0.04] transition">
                            <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] text-slate-400 truncate w-full">Ficheiro {i + 1}</span>
                          </a>
                        )}
                        {isImg && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition cursor-pointer" onClick={() => setLightbox(url)}>
                            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Aba Atribuição ── */}
          {activeTab === "atribuicao" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Atribuição e status</h2>
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
              {/* Leitura apenas — atribuição */}
              <div className="grid grid-cols-2 gap-3">
                <ReadonlyField label="Assistente atribuída" value={order.assignedToName ?? "Não atribuído"} />
                <ReadonlyField label="Atribuído em" value={order.assignedAt ? fmt(order.assignedAt) : null} />
                <ReadonlyField label="Última atualização" value={fmt(order.updatedAt)} />
                <ReadonlyField label="Criado em" value={fmt(order.createdAt)} />
                {order.assignedToName && (
                  <ReadonlyField
                    label="Pagamento ao assistente"
                    value={(order as any).valorPagoAssistente != null
                      ? `${parseFloat(String((order as any).valorPagoAssistente)).toFixed(2)} € (fixo por trabalho)`
                      : "7,00 € (fixo por trabalho)"}
                  />
                )}
              </div>
              <Field label="Notas internas (visíveis apenas no backoffice)">
                <textarea rows={4} value={editNotasInternas} onChange={(e) => setEditNotasInternas(e.target.value)} className={inputCls} placeholder="Notas para o equipa..." />
              </Field>
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition">
                  {saving ? "A guardar..." : "Guardar alterações"}
                </button>
              </div>
            </div>
          )}

          {/* ── Aba Histórico ── */}
          {activeTab === "historico" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Histórico do pedido</h2>
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
                      <span className="absolute left-[-3px] top-1.5 h-2 w-2 rounded-full bg-cyan-400 ring-4 ring-[#070e17]" />
                      <p className="text-xs font-semibold text-slate-200">{entry.message}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {entry.by && (
                          <span className="text-[10px] font-medium text-slate-500">{entry.by.nome}</span>
                        )}
                        <span className="text-[10px] text-slate-600">{fmt(entry.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Auto history from order fields */}
              <div className="relative space-y-0 pl-4 border-t border-white/[0.06] pt-4">
                <div className="absolute left-4 top-7 bottom-3 w-px bg-white/[0.04]" />
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600 pl-6">Linha do tempo automática</p>
                {[
                  { label: "Pedido criado", date: order.createdAt, color: "bg-slate-400" },
                  ...(order.assignedAt ? [{ label: `Atribuído a ${order.assignedToName ?? "assistente"}`, date: order.assignedAt, color: "bg-sky-400" }] : []),
                  ...(order.status === "aprovado" ? [{ label: "Orçamento aprovado", date: order.updatedAt, color: "bg-emerald-400" }] : []),
                  ...(order.status === "confirmado" ? [{ label: "Pedido confirmado", date: order.updatedAt, color: "bg-green-400" }] : []),
                ].map((item, i) => (
                  <div key={i} className="relative pb-4 pl-6">
                    <span className={`absolute left-[-3px] top-1.5 h-2 w-2 rounded-full ${item.color} ring-4 ring-[#070e17]`} />
                    <p className="text-xs font-semibold text-slate-300">{item.label}</p>
                    <p className="text-[10px] text-slate-600">{fmt(item.date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Preview" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
          <button className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 transition" onClick={() => setLightbox(null)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[28px] border border-red-500/20 bg-[#0a1520] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10">
              <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">Excluir pedido #{order.id}?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Tem a certeza que deseja excluir este pedido? Esta ação irá remover o pedido da base de dados e{" "}
              <span className="font-semibold text-red-300">não poderá ser desfeita</span>.
            </p>
            <p className="mt-4 text-sm text-slate-400">Para confirmar, escreva <span className="font-mono font-bold text-red-400">EXCLUIR</span>:</p>
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
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== "EXCLUIR"}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-40 transition"
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
