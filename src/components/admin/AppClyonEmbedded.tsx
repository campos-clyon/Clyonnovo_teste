"use client";

import { useCallback, useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Package } from "lucide-react";
import AppPedidosClient from "@/app/admin/app-pedidos/AppPedidosClient";
import PagamentosPanel from "@/components/admin/PagamentosPanel";
import { CLYON_TABS, type AppClyonTab } from "@/components/admin/app-clyon/navigation";
import { buildWhatsappLink, deleteReasonError } from "@/lib/order-actions";
import { validateProposal, isQuoteApprovalAvailable, PROPOSAL_MESSAGE_MIN_LENGTH } from "@/lib/quote-approval";
import { nextPhase, isTerminalStatus, isApprovedStatus, isWaitingOnCustomer } from "@/lib/order-status-flow";
import { displayPrice, withVat, isBelowFloor, gatePrice, orcamentoDoPedido } from "@/lib/quote-price";
import { suggestJustifications, type RequestFacts } from "@/lib/proposal-suggestions";
import { toFiveStars } from "@/lib/partner-profile";

// Converte um nome kebab-case (guardado em service_categories.icon) num componente
// lucide-react. Ex.: "shopping-bag" → LucideIcons.ShoppingBag.
function CategoryIcon({ name, className = "h-5 w-5" }: { name: string | null; className?: string }) {
  if (!name) return <Package className={className} />;
  const key = name
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[key];
  return Icon ? <Icon className={className} /> : <Package className={className} />;
}

export type { AppClyonTab };

// ── Tipos partilhados ──────────────────────────────────────────────────────
type AppStatus =
  | "draft" | "received" | "in_review" | "awaiting_customer_approval"
  | "awaiting_deposit" | "assignment_pending"
  | "partner_selected" | "confirmed" | "in_route" | "arrived" | "in_execution"
  | "extra_review_requested" | "awaiting_confirmation" | "completed"
  | "in_dispute" | "canceled" | "rejected";

type InlineOrder = {
  id: string; status: AppStatus; urgency: string;
  details: unknown; notes: unknown;
  address_line: unknown; city: unknown; region: unknown;
  category_slug: string | null; estimated_price: number | null;
  final_price?: number | null;
  // Motor de preços — total = 0 já não significa "sem preço" (§3.1)
  estimate_min?: number | null;
  estimate_max?: number | null;
  price_status?: string | null;
  request_facts?: Record<string, unknown> | null;
  scheduled_for: string | null; photos: string[]; created_at: string;
  client_name: unknown; client_email: unknown; client_phone: unknown;
  category_name: unknown; category_icon: string | null;
  details_meta?: Record<string, unknown> | null;
  archived_at?: string | null;
};

// Labels de negócio para chaves conhecidas em details_meta.
// Mantém-se aqui para permitir tradução centralizada e evitar mostrar chaves técnicas.
const DETAILS_LABELS: Record<string, string> = {
  items_max: "Quantidade máxima de itens",
  items_count: "Quantidade de itens",
  items: "Itens",
  distance_km: "Distância estimada (km)",
  distance: "Distância estimada",
  floor: "Andar",
  floors: "Andares",
  has_elevator: "Elevador",
  elevator: "Elevador",
  needs_elevator: "Necessita elevador",
  building_type: "Tipo de edifício",
  property_type: "Tipo de propriedade",
  area_sqm: "Área (m²)",
  area: "Área",
  rooms: "Divisões",
  bedrooms: "Quartos",
  parking: "Estacionamento",
  access_notes: "Notas de acesso",
  preferred_time: "Hora preferida",
  contact_time: "Melhor hora para contactar",
  additional_notes: "Observações adicionais",
  observations: "Observações",
  volume_m3: "Volume estimado (m³)",
  weight_kg: "Peso estimado (kg)",
  pending_quote_id: "Orçamento pendente",
  quote_id: "Orçamento",
  service_type: "Tipo de serviço",
  urgency_reason: "Motivo de urgência",
};

function labelFor(key: string): string {
  if (DETAILS_LABELS[key]) return DETAILS_LABELS[key];
  // Fallback: converter snake_case em Título com Espaços
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatDetailValue).join(", ");
  if (typeof value === "object") {
    // Objecto aninhado: uma linha compacta com sub-labels
    const parts: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null && v !== undefined) parts.push(`${labelFor(k)}: ${formatDetailValue(v)}`);
    }
    return parts.join("; ") || "—";
  }
  return String(value);
}

function displayText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value || fallback;
  if (typeof value === "number" || typeof value === "boolean") return formatDetailValue(value);
  if (Array.isArray(value)) return formatDetailValue(value) || fallback;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) parts.push(`${labelFor(k)}: ${formatDetailValue(v)}`);
    }
    return parts.length > 0 ? parts.join(" · ") : fallback;
  }
  return String(value) || fallback;
}

// ── Curadoria de details_meta → secções de negócio ─────────────────────────
// O motor de orçamentos da app grava um objecto técnico em details. Aqui
// separamos o que o operador precisa de ver (itens, acesso, riscos, mensagem)
// do que é depuração (breakdown, ids, coordenadas), que fica colapsado.

const RISK_FLAG_LABELS: Record<string, string> = {
  out_of_zone: "Fora da zona de cobertura",
  volume_grande: "Volume grande",
  volume_high: "Volume elevado",
  heavy_items: "Itens pesados",
  no_elevator: "Sem elevador",
  long_carry: "Transporte longo à mão",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  out_of_zone: "Fora de zona — proposta manual",
  ok: "Orçamento automático válido",
  pending: "Orçamento pendente",
  manual_review: "Requer revisão manual",
};

type MetaItem = { qty: number; name: string; unitPrice: number | null; subtotal: number | null; volume: number | null };

type CuratedMeta = {
  items: MetaItem[];
  totalSemIva: number | null;
  serviceType: string | null;
  bags: number | null;
  floor: string | null;
  elevator: boolean | null;
  parkingAvailable: boolean | null;
  parkingDistanceM: number | null;
  pickupAddress: string | null;
  customerMessage: string | null;
  riskFlags: string[];
  quoteStatus: string | null;
  confidenceScore: number | null;
  estimatedVolume: number | null;
  rest: Record<string, unknown>;
};

function metaTake(rest: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in rest) { const v = rest[k]; delete rest[k]; return v; }
  }
  return undefined;
}

function asNum(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "Sim" || v === "sim" || v === "yes" || v === "true") return true;
  if (v === "Não" || v === "nao" || v === "no" || v === "false") return false;
  return null;
}

function curateMeta(meta: Record<string, unknown> | null | undefined): CuratedMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const rest: Record<string, unknown> = { ...meta };

  const rawItems = metaTake(rest, "selected_items", "selectedItems", "items");
  const items: MetaItem[] = Array.isArray(rawItems)
    ? rawItems.filter((it) => it && typeof it === "object").map((it: any) => ({
        qty: asNum(it.qty ?? it.Qty ?? it.quantity) ?? 1,
        name: String(it.name ?? it.Name ?? "Item"),
        unitPrice: asNum(it.unit_price ?? it.unitPrice ?? it.UnitPrice),
        subtotal: asNum(it.subtotal ?? it.Subtotal),
        volume: asNum(it.volume ?? it.Volume),
      }))
    : [];

  const pickup = metaTake(rest, "pickup", "Pickup") as Record<string, unknown> | undefined;
  const pickupAddress = pickup && typeof pickup === "object" && typeof pickup.address === "string"
    ? pickup.address : null;
  // Coordenadas e restos do pickup vão para os detalhes técnicos
  if (pickup && typeof pickup === "object") {
    const { address: _a, ...coords } = pickup as Record<string, unknown>;
    if (Object.keys(coords).length > 0) rest.pickup_coords = coords;
  }

  const rawFlags = metaTake(rest, "risk_flags", "riskFlags");
  const riskFlags = Array.isArray(rawFlags) ? rawFlags.map(String) : [];

  const curated: CuratedMeta = {
    items,
    totalSemIva: asNum(metaTake(rest, "total_sem_iva", "totalSemIva")),
    serviceType: (metaTake(rest, "service_type", "serviceType", "tipo_de_servico") as string) ?? null,
    bags: asNum(metaTake(rest, "bags", "sacos")),
    floor: ((v) => (v === undefined || v === null ? null : String(v)))(metaTake(rest, "floor", "andar")),
    elevator: asBool(metaTake(rest, "has_elevator", "elevator", "elevador", "needs_elevator")),
    parkingAvailable: asBool(metaTake(rest, "parking_available", "parkingAvailable")),
    parkingDistanceM: asNum(metaTake(rest, "parking_distance_m", "parkingDistanceM")),
    pickupAddress,
    customerMessage: ((v) => (typeof v === "string" && v.trim() ? v.trim() : null))(
      metaTake(rest, "customer_message", "customerMessage"),
    ),
    riskFlags,
    quoteStatus: ((v) => (typeof v === "string" ? v : null))(metaTake(rest, "quote_status", "quoteStatus")),
    confidenceScore: asNum(metaTake(rest, "confidence_score", "confidenceScore")),
    estimatedVolume: asNum(metaTake(rest, "estimated_volume_m3", "estimatedVolumeM3", "volume_m3")),
    rest,
  };
  // Redundante com a galeria de fotografias
  metaTake(curated.rest, "photos_count", "photosCount");
  return curated;
}

const CARD = "rounded-2xl border border-white/[0.08] bg-[#0C1C2E] p-4";
const CARD_TITLE = "mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#97AABD]";

function FactChip({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "ok" | "warn" }) {
  const tones = {
    neutral: "border-white/[0.08] bg-[#12263B] text-[#F5FAFF]",
    ok: "border-[#19C37D]/25 bg-[#19C37D]/[0.08] text-[#19C37D]",
    warn: "border-[#F6B84A]/25 bg-[#F6B84A]/[0.08] text-[#F6B84A]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${tones[tone]}`}>
      <span className="text-[10px] uppercase tracking-wider text-[#97AABD]">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

// Visualizador de fotografias no próprio painel, com navegação e teclado
function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const hasMany = photos.length > 1;
  const prev = useCallback(
    () => onNavigate((index - 1 + photos.length) % photos.length),
    [index, photos.length, onNavigate],
  );
  const next = useCallback(
    () => onNavigate((index + 1) % photos.length),
    [index, photos.length, onNavigate],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMany) prev();
      else if (e.key === "ArrowRight" && hasMany) next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next, hasMany]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-label={`Fotografia ${index + 1} de ${photos.length}`}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/[0.06] p-2 text-slate-300 transition hover:bg-white/[0.12] hover:text-white"
        aria-label="Fechar"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {hasMany && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-white/[0.06] p-2.5 text-slate-300 transition hover:bg-white/[0.12] hover:text-white"
          aria-label="Fotografia anterior"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index]}
        alt={`Fotografia ${index + 1} do pedido`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
      />

      {hasMany && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-white/[0.06] p-2.5 text-slate-300 transition hover:bg-white/[0.12] hover:text-white"
          aria-label="Fotografia seguinte"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {hasMany && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-slate-200">
          {index + 1} / {photos.length}
        </p>
      )}
    </div>
  );
}

// Detalhes técnicos colapsáveis (breakdown do motor, ids, coordenadas)
function TechnicalDetails({ rest }: { rest: Record<string, unknown> }) {
  const entries = Object.entries(rest).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-white/[0.06] bg-[#0C1C2E]/60">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-semibold text-[#97AABD] transition hover:text-white [&::-webkit-details-marker]:hidden">
        <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Detalhes técnicos do orçamento automático
        <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px]">{entries.length}</span>
      </summary>
      <dl className="space-y-2 border-t border-white/[0.05] px-4 py-3">
        {entries.map(([k, v]) => (
          <div key={k} className="text-xs">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{labelFor(k)}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-slate-400">
              {typeof v === "object" ? JSON.stringify(v, null, 1).replace(/[{}"]/g, "").trim() : String(v)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

type OpsEntry = {
  id: string; action_type: string; status_from: string | null; status_to: string | null;
  reason: string | null; note: string | null; colab_nome: string; created_at: string;
};

// ── Motor de preços (NOTA-BRIDGE-MOTOR §3.3 / §3.4) ───────────────────────
// quote_engine_trace e pricing_outcomes são SÓ ADMIN — o piso anti-prejuízo
// é custo interno da CLYON e nunca pode chegar ao cliente.
type EngineTrace = {
  engine_floor: number | null;
  engine_ceiling: number | null;
  gemini_price: number | null;
  engine_source: string | null;
  engine_confidence: number | null;
  engine_reasons: unknown;
};

type PricingOutcome = {
  price_approved: number | null;
  approved_at: string | null;
  price_executed: number | null;
  executed_at: string | null;
  horas_reais: number | null;
  pessoas_reais: number | null;
  ajustes_no_local: string | null;
  desvio_pct: number | null;
  // Decomposição do desvio (NOTA-BRIDGE-CALIBRACAO §3) — podem não existir
  // enquanto a migração 20260725150000 não correr.
  ajustes_total?: number | null;
  ajustes_contagem?: number | null;
  valor_cobrado_real?: number | null;
};

type MotorState = {
  trace: EngineTrace | null;
  quote: { total: number | null; estimate_min: number | null; estimate_max: number | null; price_status: string | null } | null;
  request_facts: Record<string, unknown> | null;
  outcome: PricingOutcome | null;
  unavailable?: boolean;
  notice?: string;
};

// ── Propostas de horário (tabela schedule_proposals do Bridge) ────────────
// O profissional pode propor outra hora depois de aceitar. Uma proposta
// `pending` significa que o pedido está à espera do CLIENTE — nada é
// aplicado automaticamente, ao contrário dos ajustes de preço.
type ScheduleProposal = {
  id: string;
  previous_for: string | null;
  proposed_for: string;
  reason: string | null;
  status: "pending" | "accepted" | "rejected" | "canceled";
  created_at: string;
  responded_at: string | null;
  partner_name: string | null;
};

type ScheduleState = {
  proposals: ScheduleProposal[];
  pending?: ScheduleProposal | null;
  awaitingCustomer?: boolean;
  unavailable?: boolean;
};

const SCHEDULE_STATUS_LABEL: Record<string, string> = {
  pending:  "À espera do cliente",
  accepted: "Aceite",
  rejected: "Recusada",
  canceled: "Substituída",
};

// ── Negociação de preço (tabela price_proposals do Bridge) ────────────────
type ProposalRound = {
  id: string;
  round: number;
  actor: "admin" | "customer";
  amount: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "superseded" | "expired";
  created_at: string;
  responded_at: string | null;
  expires_at: string | null;
};

type NegotiationState = {
  rounds: ProposalRound[];
  pending?: ProposalRound | null;
  customerCounters?: number;
  counterLimit?: number;
  awaitingAdmin?: boolean;
  unavailable?: boolean;
  notice?: string;
};

const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceite",
  rejected: "Recusada",
  superseded: "Substituída",
  expired: "Expirada",
};

const INLINE_STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "text-slate-400" },
  received: { label: "Recebido", color: "text-amber-400" },
  in_review: { label: "Em análise", color: "text-amber-400" },
  awaiting_customer_approval: { label: "Proposta no cliente", color: "text-violet-400" },
  awaiting_deposit: { label: "Aguarda depósito", color: "text-amber-400" },
  assignment_pending: { label: "A atribuir", color: "text-amber-400" },
  partner_selected: { label: "Parceiro atribuído", color: "text-amber-400" },
  confirmed: { label: "Confirmado", color: "text-sky-400" },
  in_route: { label: "A caminho", color: "text-sky-400" },
  arrived: { label: "Chegou", color: "text-sky-400" },
  in_execution: { label: "Em execução", color: "text-sky-400" },
  // Ajuste no local acima do teto — à espera da decisão do cliente
  extra_review_requested: { label: "Ajuste no cliente", color: "text-violet-400" },
  awaiting_confirmation: { label: "Aguarda confirmação", color: "text-sky-400" },
  completed: { label: "Concluído", color: "text-emerald-400" },
  in_dispute: { label: "Em disputa", color: "text-red-400" },
  canceled: { label: "Cancelado", color: "text-red-400" },
  rejected: { label: "Rejeitado", color: "text-red-400" },
};

const INLINE_VALID_STATUSES = Object.keys(INLINE_STATUS_CFG) as AppStatus[];

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon",
  });
}

// ── Spinner / ErrBox comuns ────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="h-6 w-6 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function ErrBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
      {msg}{" "}
      <button onClick={onRetry} className="ml-2 underline">Tentar novamente</button>
    </div>
  );
}

// ── Painel de detalhe inline ───────────────────────────────────────────────
function PedidoInlinePanel({
  id,
  authHeader,
  onBack,
  onChanged,
}: {
  id: string;
  authHeader: Record<string, string>;
  onBack: () => void;
  onChanged?: () => void;
}) {
  const [order, setOrder] = useState<InlineOrder | null>(null);
  const [ops, setOps] = useState<OpsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<null | "archive" | "delete">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const [status, setStatus] = useState<AppStatus>("received");
  const [urgency, setUrgency] = useState("normal");
  const [price, setPrice] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState<number | null>(null);

  // ── Negociação de preço (plano §8) ─────────────────────────────────────
  const [nego, setNego] = useState<NegotiationState | null>(null);
  const [proposalAmount, setProposalAmount] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");

  // ── Motor de preços (NOTA-BRIDGE-MOTOR §3.3 / §3.4) ────────────────────
  const [motor, setMotor] = useState<MotorState | null>(null);
  const [horario, setHorario] = useState<ScheduleState | null>(null);
  const [execPrice, setExecPrice] = useState("");
  const [execCobradoReal, setExecCobradoReal] = useState("");
  const [execHoras, setExecHoras] = useState("");
  const [execPessoas, setExecPessoas] = useState("");
  const [execAjustes, setExecAjustes] = useState("");

  const needsReason = status === "canceled" || status === "rejected";

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [orderRes, opsRes, negoRes, motorRes, horarioRes] = await Promise.all([
        fetch(`/api/admin/app-pedidos/${id}`, { headers: authHeader }),
        fetch(`/api/admin/app-clyon/pedidos/${id}/ops`, { headers: authHeader }),
        fetch(`/api/admin/app-pedidos/${id}/proposta`, { headers: authHeader }),
        fetch(`/api/admin/app-pedidos/${id}/motor`, { headers: authHeader }),
        fetch(`/api/admin/app-pedidos/${id}/horario`, { headers: authHeader }),
      ]);
      const orderJson = await orderRes.json();
      if (!orderRes.ok) { setError(orderJson.error ?? "Erro ao carregar pedido."); return; }
      const opsJson = await opsRes.json();
      const o = orderJson.order as InlineOrder;
      setOrder(o);
      setOps(opsJson.ops ?? []);
      setNego(negoRes.ok ? ((await negoRes.json()) as NegotiationState) : null);
      const m = motorRes.ok ? ((await motorRes.json()) as MotorState) : null;
      setMotor(m);
      setHorario(horarioRes.ok ? ((await horarioRes.json()) as ScheduleState) : null);
      setProposalMessage("");
      // Pré-preencher a execução com o que já foi registado
      // Pré-preencher com o final_price — que já inclui os ajustes aplicados
      // no local — mas SEM impor: no modelo de créditos o cliente paga em mão
      // e o operador tem de poder corrigir (NOTA-BRIDGE-CALIBRACAO §2).
      const jaRegistado = m?.outcome?.price_executed;
      const doSistema = o.final_price ?? gatePrice(o);
      setExecPrice(
        jaRegistado != null ? String(jaRegistado)
        : doSistema != null ? String(doSistema) : ""
      );
      setExecCobradoReal(
        m?.outcome && "valor_cobrado_real" in m.outcome && m.outcome.valor_cobrado_real != null
          ? String(m.outcome.valor_cobrado_real) : ""
      );
      setExecHoras(m?.outcome?.horas_reais != null ? String(m.outcome.horas_reais) : "");
      setExecPessoas(m?.outcome?.pessoas_reais != null ? String(m.outcome.pessoas_reais) : "");
      setExecAjustes(m?.outcome?.ajustes_no_local ?? "");
      setStatus(o.status);
      setUrgency(o.urgency ?? "normal");
      // ⚠️ O campo "Valor do orçamento" EDITA estimated_price, logo tem de
      // MOSTRAR estimated_price. Mostrar gatePrice() dava a ilusão de que a
      // gravação falhava: gatePrice prefere final_price, por isso ao recarregar
      // o campo voltava ao valor antigo — apesar de o novo estar gravado.
      // O valor do motor só entra como âncora quando ainda não há orçamento.
      const orcamento = orcamentoDoPedido(o);
      setPrice(orcamento != null ? String(orcamento) : "");
      // A proposta parte do valor calculado; o admin corrige antes de enviar
      setProposalAmount(orcamento != null ? String(orcamento) : "");
      setScheduledFor(o.scheduled_for ? String(o.scheduled_for).slice(0, 16) : "");
      setAdminNote(""); setReason("");
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [id, authHeader]);

  useEffect(() => { load(); }, [load]);

  async function handleAdvancePhase() {
    if (!order) return;
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    try {
      const body: Record<string, unknown> = {};
      if (adminNote.trim()) body.note = adminNote.trim();
      if (price !== "" && Number(price) > 0) body.estimated_price = Number(price);
      const res = await fetch(`/api/admin/app-pedidos/${id}/advance`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Erro ao avançar a fase."); return; }
      const statusLabel = INLINE_STATUS_CFG[json.status as AppStatus]?.label ?? json.status;
      let msg = `Fase avançada: ${json.action}. Estado actual: ${statusLabel}.`;
      if (json.status === "confirmed" || json.status === "assignment_pending") {
        msg += " A publicação aos parceiros é automática.";
      }
      setSaveSuccess(msg);
      await load();
      onChanged?.();
    } catch { setSaveError("Erro de ligação."); }
    finally { setSaving(false); }
  }

  async function handleSave() {
    if (!order) return;
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    const payload: Record<string, unknown> = {};
    // Alteração manual de estado = override explícito da sequência de fases
    if (status !== order.status) { payload.status = status; payload.force = true; }
    if (urgency !== order.urgency) payload.urgency = urgency;
    // Comparar com a MESMA origem que pré-preencheu o campo, senão ou se
    // reescreve o valor em cada gravação, ou se descarta a alteração.
    const orcamentoAtual = orcamentoDoPedido(order);
    const origPrice = orcamentoAtual != null ? String(orcamentoAtual) : "";
    if (price !== origPrice) payload.estimated_price = price === "" ? null : Number(price);
    const origDate = order.scheduled_for ? String(order.scheduled_for).slice(0, 16) : "";
    if (scheduledFor !== origDate) payload.scheduled_for = scheduledFor || null;
    if (adminNote.trim()) payload.admin_note = adminNote.trim();
    if (reason.trim()) payload.reason = reason.trim();
    if (Object.keys(payload).length === 0) { setSaveError("Nenhuma alteração."); setSaving(false); return; }
    try {
      const res = await fetch(`/api/admin/app-pedidos/${id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Erro ao guardar."); return; }
      setSaveSuccess("Alterações guardadas com sucesso.");
      await load();
    } catch { setSaveError("Erro de ligação."); }
    finally { setSaving(false); }
  }

  // Envia uma proposta de preço ao cliente (RPC admin_send_price_proposal).
  // O painel NÃO escreve status nem final_price — quem o faz é a RPC.
  async function handleSendProposal() {
    if (!order) return;

    const check = validateProposal(proposalAmount, proposalMessage);
    if (!check.ok) {
      setSaveSuccess(null);
      setSaveError(check.error);
      return;
    }

    setSaving(true); setSaveError(null); setSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/app-pedidos/${id}/proposta`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          amount: Number(proposalAmount),
          message: proposalMessage.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Erro ao enviar a proposta."); return; }
      setSaveSuccess(json.message ?? "Proposta enviada ao cliente.");
      await load();
      onChanged?.();
    } catch {
      setSaveError("Erro de ligação.");
    } finally {
      setSaving(false);
    }
  }

  // Fecha a linha de treino do motor com o que aconteceu de facto (§3.4).
  // Sem isto, pricing_outcomes fica vazia e não há como saber se o motor
  // está a acertar — é calibrar com intuição em vez de dados.
  async function handleRecordExecution() {
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/app-pedidos/${id}/motor`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_execution",
          price_executed: Number(execPrice),
          valor_cobrado_real: execCobradoReal === "" ? null : Number(execCobradoReal),
          horas_reais: execHoras === "" ? null : Number(execHoras),
          pessoas_reais: execPessoas === "" ? null : Number(execPessoas),
          ajustes_no_local: execAjustes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Erro ao registar a execução."); return; }
      const desvio = json.outcome?.desvio_pct;
      const partes = ["Execução registada."];
      if (typeof desvio === "number") {
        partes.push(`Desvio face ao aprovado: ${desvio > 0 ? "+" : ""}${desvio.toFixed(1)}%.`);
      }
      if (typeof json.ajustes_contagem === "number" && json.ajustes_contagem > 0) {
        partes.push(`${json.ajustes_contagem} ajuste(s) no local (${fmtMoney(Number(json.ajustes_total ?? 0))}) — erro de medição, não de preço.`);
      }
      if (json.divergencia_cobranca != null) {
        partes.push(`⚠️ Valor cobrado diverge do sistema (${fmtMoney(Number(json.divergencia_cobranca))}).`);
      }
      if (json.warning) setSaveError(json.warning);
      setSaveSuccess(partes.join(" "));
      await load();
    } catch { setSaveError("Erro de ligação."); }
    finally { setSaving(false); }
  }

  // Aceita a contraproposta do cliente (RPC admin_accept_counter_proposal)
  async function handleAcceptCounter() {
    if (!order) return;
    setSaving(true); setSaveError(null); setSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/app-pedidos/${id}/proposta`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_counter" }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Erro ao aceitar a contraproposta."); return; }
      setSaveSuccess(json.message ?? "Contraproposta aceite.");
      await load();
      onChanged?.();
    } catch {
      setSaveError("Erro de ligação.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!order) return;
    const isArchived = order.archived_at != null;
    setActionBusy("archive"); setSaveError(null); setSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/app-pedidos/${id}/archive`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !isArchived }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Erro ao arquivar."); return; }
      setSaveSuccess(isArchived ? "Pedido restaurado." : "Pedido arquivado.");
      await load();
      onChanged?.();
    } catch {
      setSaveError("Erro de ligação.");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDelete() {
    if (!order) return;
    const reasonErr = deleteReasonError(deleteReason);
    if (reasonErr) { setSaveError(reasonErr); return; }
    setActionBusy("delete"); setSaveError(null); setSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/app-pedidos/${id}`, {
        method: "DELETE",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Erro ao eliminar."); return; }
      onChanged?.();
      onBack();
    } catch {
      setSaveError("Erro de ligação.");
    } finally {
      setActionBusy(null);
    }
  }

  const canApproveQuote = isQuoteApprovalAvailable(order?.status);
  const isArchived = order?.archived_at != null;
  const IL = "text-[10px] uppercase tracking-wider text-[#97AABD] block mb-1";
  const INP = "mt-0.5 h-9 w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 text-sm text-[#F5FAFF] outline-none transition focus:border-[#00BDEB]";
  const TA = "mt-0.5 w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 py-2 text-sm text-[#F5FAFF] outline-none transition focus:border-[#00BDEB] resize-none";

  if (loading) return <Spinner />;
  if (error) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
      {error} <button onClick={onBack} className="ml-2 underline">← Voltar</button>
    </div>
  );
  if (!order) return null;

  const statusCfg = INLINE_STATUS_CFG[order.status];
  const meta = curateMeta(order.details_meta);

  // Ficha do pedido do motor (request_facts) — contrato único entre a app,
  // o motor e a IA (NOTA-BRIDGE-MOTOR §3.2). Serve de origem alternativa
  // quando details_meta não traz itens.
  const facts = (motor?.request_facts ?? order.request_facts ?? null) as Record<string, unknown> | null;
  const carga = (facts?.carga ?? null) as Record<string, unknown> | null;
  const factsItems: Array<{ nome: string; qtd: number }> = Array.isArray(carga?.itens)
    ? (carga.itens as unknown[])
        .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
        .map((it) => ({
          nome: String(it.nome ?? it.name ?? "Item"),
          qtd: Number(it.qtd ?? it.qty ?? 1) || 1,
        }))
    : [];
  const factsVolume = typeof carga?.volume_m3 === "number" ? carga.volume_m3 : null;

  // Preço marginal e premissas (NOTA-BRIDGE §3): details.breakdown.
  // É o que a equipa diz ao cliente no local — e o que faz o preço subir
  // sozinho durante o trabalho. O operador tem de ver isto ANTES de aprovar.
  const breakdown = ((order.details_meta as Record<string, unknown> | null)?.breakdown ?? null) as Record<string, unknown> | null;
  const marginal = (breakdown?.marginal ?? null) as Record<string, unknown> | null;
  const inclui = Array.isArray(breakdown?.inclui) ? (breakdown.inclui as unknown[]).map(String) : [];
  const teto = typeof breakdown?.teto_sem_nova_aprovacao === "number"
    ? breakdown.teto_sem_nova_aprovacao
    : null;

  // Sugestões de justificação: saem dos factos do pedido e da direcção do
  // ajuste face ao valor do motor. Um texto que cita o 3.º andar sem elevador
  // do próprio cliente convence mais do que "devido às características".
  const sugestoes = suggestJustifications({
    proposalAmount: proposalAmount === "" ? null : Number(proposalAmount),
    referencePrice: displayPrice(order).value,
    engineFloor: motor?.trace?.engine_floor ?? null,
    facts: facts as RequestFacts | null,
    priceStatus: order.price_status ?? null,
  });
  const morada = meta?.pickupAddress ?? displayText(order.address_line, "");
  // A mensagem do cliente aparece muitas vezes duplicada em notes — mostrar uma vez
  const notesText = displayText(order.notes, "");
  const clientMessage = meta?.customerMessage ?? (notesText || null);
  const isUrgent = order.urgency === "urgent";

  return (
    <div className="space-y-4">
      {/* Cabeçalho do pedido */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#0C1C2E] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-[#12263B]"
        >
          ← Voltar
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-[#F5FAFF]">
              {displayText(order.category_name ?? order.category_slug, "Pedido")}
            </h3>
            {isUrgent && (
              <span className="rounded-full border border-[#EF5A67]/30 bg-[#EF5A67]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#EF5A67]">
                Urgente
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">
            #{order.id.slice(0, 8)} · criado {fmtDt(order.created_at)}
          </p>
        </div>
        <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-2">
          {/* "Aprovado" = cliente aceitou o preço. Ter preço calculado pelo
              motor NÃO é aprovação — senão o selo aparece até em recusados. */}
          {(isApprovedStatus(order.status) || Number(order.final_price ?? 0) > 0) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
              ✓ Aprovado
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#12263B] px-3 py-1.5 text-xs font-bold ${statusCfg?.color ?? "text-white"}`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {statusCfg?.label ?? order.status}
          </span>
        </span>
      </div>

      {saveError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{saveError}</div>}
      {saveSuccess && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{saveSuccess}</div>}

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        {/* Coluna principal — o que exige atenção e largura */}
        <div className="space-y-4">
          {/* ── ACÇÃO EM CURSO ───────────────────────────────────────────
              Fica no topo e na coluna larga: a proposta precisa de espaço
              para o valor, a justificação e as sugestões. Antes estava
              espremida em 280 px na lateral. */}

          {/* Bola do lado do cliente — o admin espera, não avança */}
          {isWaitingOnCustomer(order.status) && !nego?.awaitingAdmin && (
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.07] p-4">
              {order.status === "extra_review_requested" ? (
                <>
                  <p className="text-sm font-bold text-violet-300">Ajuste no local à espera do cliente</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    A equipa encontrou mais trabalho do que o orçamentado e o valor ultrapassou o
                    tecto acordado. <span className="text-white">Quem decide é o cliente</span>, na app —
                    não é uma fila do backoffice. Se ele aceitar, o trabalho retoma a execução.
                    Ajustes dentro do tecto são aplicados sozinhos e nunca passam por aqui.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-violet-300">À espera da decisão do cliente</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    A proposta{nego?.pending ? ` de ${fmtMoney(nego.pending.amount)}` : ""} está com o cliente.
                    Ele pode aceitar, contrapor{typeof nego?.customerCounters === "number" && typeof nego?.counterLimit === "number"
                      ? ` (usou ${nego.customerCounters} de ${nego.counterLimit})` : ""} ou cancelar.
                    O pedido não é visível aos profissionais.
                    {nego?.pending?.expires_at && (
                      <> Expira em {new Date(nego.pending.expires_at).toLocaleDateString("pt-PT")} — se
                      expirar, volta a <span className="text-slate-300">Em análise</span> para nova
                      proposta, não é cancelado.</>
                    )}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Proposta de horário à espera do cliente — não há tolerância
              automática: uma hora ou serve ou não serve, e só ele sabe */}
          {horario?.pending && (
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.07] p-4">
              <p className="text-sm font-bold text-violet-300">Nova hora proposta pelo profissional</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                {horario.pending.previous_for && (
                  <span className="text-sm text-slate-500 line-through">{fmtDt(horario.pending.previous_for)}</span>
                )}
                <span className="text-lg font-bold text-white">{fmtDt(horario.pending.proposed_for)}</span>
              </div>
              {horario.pending.reason && (
                <p className="mt-1.5 text-xs italic leading-relaxed text-slate-300">&ldquo;{horario.pending.reason}&rdquo;</p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Proposta por <span className="text-white">{horario.pending.partner_name ?? "profissional"}</span> ·
                à espera da decisão do cliente. <span className="text-white">A data agendada só muda se ele aceitar</span> —
                não há aplicação automática como nos ajustes de preço.
              </p>
            </div>
          )}

          {/* Contraproposta do cliente à espera de decisão do admin */}
          {nego?.awaitingAdmin && nego.pending && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="text-sm font-bold text-emerald-300">Contraproposta do cliente</p>
                <p className="text-2xl font-bold text-white">{fmtMoney(nego.pending.amount)}</p>
              </div>
              {nego.pending.message && (
                <p className="mt-1.5 text-xs italic leading-relaxed text-slate-300">&ldquo;{nego.pending.message}&rdquo;</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={handleAcceptCounter} disabled={saving}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50">
                  {saving ? "A aceitar..." : "Aceitar contraproposta"}
                </button>
                <span className="text-[11px] text-slate-500">
                  ou contrapõe abaixo — o admin não tem limite de rondas.
                </span>
              </div>
            </div>
          )}

          {/* Avanço de fase */}
          {!canApproveQuote && !isTerminalStatus(order.status) && nextPhase(order.status) && (
            <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.07] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-cyan-300">Fase seguinte</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    De <span className="font-semibold text-white">{INLINE_STATUS_CFG[order.status]?.label ?? order.status}</span>
                    {" → "}
                    <span className="font-semibold text-cyan-300">{INLINE_STATUS_CFG[nextPhase(order.status)!.next as AppStatus]?.label ?? nextPhase(order.status)!.next}</span>.
                    A operação fica registada na Auditoria.
                  </p>
                </div>
                <button type="button" onClick={handleAdvancePhase} disabled={saving}
                  className="rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
                  {saving ? "A avançar..." : nextPhase(order.status)!.actionLabel}
                </button>
              </div>
            </div>
          )}

          {/* Enviar proposta ao cliente — precisa da coluna larga */}
          {canApproveQuote && (
            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.07] p-4">
              <p className="text-sm font-bold text-violet-300">
                {nego?.awaitingAdmin ? "Contrapor ao cliente" : "Enviar proposta ao cliente"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                O cliente decide antes de o pedido ser publicado. Ao enviar, fica em{" "}
                <span className="font-semibold text-violet-300">Proposta no cliente</span> e{" "}
                <span className="font-semibold text-white">nenhum profissional o vê</span> até ele aceitar e pagar a reserva.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                <div>
                  <label className={IL}>Valor da proposta (€)</label>
                  <input type="number" step="0.01" min="0" value={proposalAmount}
                    onChange={(e) => setProposalAmount(e.target.value)} className={INP} />
                  {sugestoes.direction !== "same" && (
                    <p className={`mt-1.5 text-[11px] font-semibold ${sugestoes.direction === "up" ? "text-amber-300" : "text-emerald-300"}`}>
                      {sugestoes.direction === "up" ? "▲" : "▼"} {sugestoes.deltaEur > 0 ? "+" : ""}
                      {fmtMoney(sugestoes.deltaEur)} ({sugestoes.deltaPct > 0 ? "+" : ""}{sugestoes.deltaPct}%)
                      <span className="block font-normal text-slate-500">face ao motor</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className={IL}>Justificação para o cliente (obrigatória)</label>
                  <textarea value={proposalMessage} onChange={(e) => setProposalMessage(e.target.value)} rows={4}
                    placeholder="Ex: Ajustámos para baixo — o acesso é fácil e não precisa de segundo operador."
                    className={TA} />
                  <p className="mt-1 text-[10px] text-slate-500">
                    {proposalMessage.trim().length < PROPOSAL_MESSAGE_MIN_LENGTH
                      ? `Faltam ${PROPOSAL_MESSAGE_MIN_LENGTH - proposalMessage.trim().length} caracteres — o cliente vê esta explicação.`
                      : "O cliente vê esta explicação junto ao valor."}
                  </p>
                </div>
              </div>

              {sugestoes.belowFloorWarning && (
                <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-300">
                  {sugestoes.belowFloorWarning}
                </p>
              )}

              {sugestoes.suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#97AABD]">
                    {sugestoes.direction === "up" ? "Porque é mais caro"
                      : sugestoes.direction === "down" ? "Porque é mais barato"
                      : "Explicar o valor"}
                    <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-600">— clica para usar</span>
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {sugestoes.suggestions.map((sg) => {
                      const usada = proposalMessage.includes(sg.text);
                      return (
                        <button key={sg.id} type="button"
                          onClick={() => setProposalMessage((prev) => {
                            const base = prev.trim();
                            if (base.includes(sg.text)) return base.replace(sg.text, "").replace(/\s{2,}/g, " ").trim();
                            return base ? `${base} ${sg.text}` : sg.text;
                          })}
                          className={`rounded-lg border px-2.5 py-2 text-left transition ${
                            usada ? "border-violet-400/50 bg-violet-500/[0.14]"
                              : "border-white/[0.07] bg-[#12263B]/60 hover:border-violet-400/30 hover:bg-violet-500/[0.07]"
                          }`}>
                          <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                            sg.tone === "increase" ? "text-amber-300" : sg.tone === "decrease" ? "text-emerald-300" : "text-slate-400"
                          }`}>{usada ? "✓ " : ""}{sg.basis}</span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-300">{sg.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button type="button" onClick={handleSendProposal}
                disabled={saving || !validateProposal(proposalAmount, proposalMessage).ok}
                className="mt-3 w-full rounded-lg bg-violet-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "A enviar..." : nego?.awaitingAdmin ? "Enviar contraproposta" : "Enviar proposta ao cliente"}
              </button>
            </div>
          )}
          {/* Resumo do serviço */}
          <div className={CARD}>
            <p className={CARD_TITLE}>Resumo do serviço</p>
            {meta && meta.items.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                {meta.items.map((it, i) => (
                  <div key={i} className={`flex items-center gap-3 bg-[#12263B]/60 px-3 py-2.5 ${i < meta.items.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#00BDEB]/10 text-xs font-bold text-[#00BDEB]">
                      {it.qty}×
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#F5FAFF]">{it.name}</p>
                      {it.volume != null && <p className="text-[10px] text-slate-500">{it.volume} m³ por unidade</p>}
                    </div>
                    <div className="text-right">
                      {it.subtotal != null && <p className="text-sm font-semibold text-[#F5FAFF]">{fmtMoney(it.subtotal)}</p>}
                      {it.unitPrice != null && it.qty > 1 && (
                        <p className="text-[10px] text-slate-500">{fmtMoney(it.unitPrice)}/un</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : factsItems.length > 0 ? (
              /* Sem details_meta, os itens vêm da ficha do motor
                 (request_facts.carga.itens) — antes mostrava só "—" */
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                {factsItems.map((it, i) => (
                  <div key={i} className={`flex items-center gap-3 bg-[#12263B]/60 px-3 py-2.5 ${i < factsItems.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#00BDEB]/10 text-xs font-bold text-[#00BDEB]">
                      {it.qtd}×
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#F5FAFF]">{it.nome}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">{displayText(order.details)}</p>
            )}
            {(() => {
              // Total s/IVA: usar o total do orçamento automático; quando vem a 0
              // (ou ausente) mas os itens têm subtotais, somar os itens.
              const itemsSum = (meta?.items ?? []).reduce((acc, it) => acc + (it.subtotal ?? 0), 0);
              const displayTotal = meta?.totalSemIva != null && meta.totalSemIva > 0
                ? meta.totalSemIva
                : itemsSum > 0 ? itemsSum : null;
              // Preço do motor: NUNCA ler só o total — total = 0 já não
              // significa "sem preço" (NOTA-BRIDGE-MOTOR §3.1)
              const p = displayPrice(order);
              const tone = p.kind === "revisao"
                ? { border: "border-amber-500/25", bg: "bg-amber-500/[0.07]", text: "text-amber-300" }
                : p.kind === "intervalo"
                ? { border: "border-sky-500/25", bg: "bg-sky-500/[0.07]", text: "text-sky-300" }
                : { border: "border-emerald-500/25", bg: "bg-emerald-500/[0.07]", text: "text-emerald-300" };
              return (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {displayTotal != null && <FactChip label="Total s/ IVA" value={fmtMoney(displayTotal)} />}
                    {(meta?.estimatedVolume ?? factsVolume) != null && (
                      <FactChip label="Volume est." value={`${meta?.estimatedVolume ?? factsVolume} m³`} />
                    )}
                    {meta?.bags != null && meta.bags > 0 && <FactChip label="Sacos" value={String(meta.bags)} />}
                  </div>
                  {p.kind !== "legado" && (
                    <div className={`mt-3 rounded-xl border ${tone.border} ${tone.bg} px-3 py-2.5`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${tone.text}`}>{p.label}</p>
                          {p.value != null && (
                            <p className="text-[10px] text-slate-400">
                              {p.min !== p.max
                                ? `${fmtMoney(withVat(p.min!))} – ${fmtMoney(withVat(p.max!))} c/ IVA`
                                : `${fmtMoney(withVat(p.value))} c/ IVA`}
                            </p>
                          )}
                        </div>
                        <p className={`whitespace-nowrap text-lg font-bold ${tone.text}`}>{p.text}</p>
                      </div>
                      {p.needsReview && (
                        <p className="mt-2 text-[10px] leading-relaxed text-amber-200/70">
                          O motor marcou este pedido para decisão humana — o valor é referência,
                          não um preço fechado. Confirma antes de propor ao cliente.
                        </p>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Local e acesso */}
          <div className={CARD}>
            <p className={CARD_TITLE}>Local e acesso</p>
            {morada && <p className="text-sm leading-relaxed text-[#F5FAFF]">{morada}</p>}
            {(displayText(order.city, "") || displayText(order.region, "")) && (
              <p className="mt-0.5 text-xs text-slate-500">
                {[displayText(order.city, ""), displayText(order.region, "")].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {meta?.floor != null && <FactChip label="Andar" value={meta.floor === "0" ? "R/C" : `${meta.floor}º`} />}
              {meta?.elevator != null && (
                <FactChip label="Elevador" value={meta.elevator ? "Sim" : "Não"} tone={meta.elevator ? "ok" : "warn"} />
              )}
              {meta?.parkingAvailable != null && (
                <FactChip
                  label="Estacionamento"
                  value={meta.parkingAvailable ? (meta.parkingDistanceM != null ? `a ${meta.parkingDistanceM} m` : "Sim") : "Não"}
                  tone={meta.parkingAvailable ? "ok" : "warn"}
                />
              )}
            </div>
          </div>

          {/* Fotografias */}
          {order.photos && order.photos.length > 0 && (
            <div className={CARD}>
              <p className={CARD_TITLE}>Fotografias ({order.photos.length})</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {order.photos.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.08] bg-[#12263B] outline-none transition focus-visible:border-[#00BDEB]"
                    title="Ver fotografia"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Fotografia ${i + 1} do pedido`}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {photoIdx !== null && order.photos && order.photos.length > 0 && (
            <PhotoLightbox
              photos={order.photos}
              index={Math.min(photoIdx, order.photos.length - 1)}
              onClose={() => setPhotoIdx(null)}
              onNavigate={setPhotoIdx}
            />
          )}

          {/* Mensagem do cliente */}
          {clientMessage && (
            <div className={CARD}>
              <p className={CARD_TITLE}>Mensagem do cliente</p>
              <blockquote className="border-l-2 border-[#00BDEB]/40 pl-3 text-sm italic leading-relaxed text-slate-300">
                {clientMessage}
              </blockquote>
            </div>
          )}

          {/* Avaliação automática */}
          {meta && (meta.riskFlags.length > 0 || meta.quoteStatus || meta.confidenceScore != null) && (
            <div className={CARD}>
              <p className={CARD_TITLE}>Avaliação automática</p>
              <div className="flex flex-wrap items-center gap-2">
                {meta.riskFlags.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-[#F6B84A]/25 bg-[#F6B84A]/[0.08] px-2.5 py-1 text-xs font-semibold text-[#F6B84A]">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                    </svg>
                    {RISK_FLAG_LABELS[f] ?? f.replace(/_/g, " ")}
                  </span>
                ))}
                {meta.quoteStatus && (
                  <FactChip
                    label="Orçamento"
                    value={QUOTE_STATUS_LABELS[meta.quoteStatus] ?? meta.quoteStatus.replace(/_/g, " ")}
                    tone={meta.quoteStatus === "ok" ? "ok" : "warn"}
                  />
                )}
                {meta.confidenceScore != null && (
                  <FactChip label="Confiança" value={`${meta.confidenceScore}/100`} tone={meta.confidenceScore >= 80 ? "ok" : "neutral"} />
                )}
              </div>
            </div>
          )}

          {/* O que o orçamento cobre e o que custa cada unidade a mais.
              Sem isto, o operador aprova sem saber que o valor pode subir
              sozinho no local — e é apanhado de surpresa. */}
          {(marginal || inclui.length > 0 || teto != null) && (
            <div className={CARD}>
              <p className={CARD_TITLE}>O que este orçamento cobre</p>

              {inclui.length > 0 && (
                <ul className="space-y-1">
                  {inclui.map((linha, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#F5FAFF]">
                      <span className="mt-0.5 text-emerald-400">✓</span>
                      <span>{linha}</span>
                    </li>
                  ))}
                </ul>
              )}

              {marginal && (
                <div className="mt-3 rounded-xl border border-[#00BDEB]/20 bg-[#00BDEB]/[0.05] p-3">
                  <p className="text-xs font-bold text-[#00BDEB]">Cada unidade a mais</p>
                  <p className="mt-1 text-sm text-[#F5FAFF]">
                    Até <span className="font-bold">{String(marginal.incluidas ?? "—")}</span>{" "}
                    {String(marginal.unidade_plural ?? marginal.unidade ?? "unidades")} incluídos ·
                    cada {String(marginal.unidade ?? "unidade")} adicional{" "}
                    <span className="font-bold">{fmtMoney(Number(marginal.valor_adicional ?? 0))}</span>
                    <span className="text-[10px] text-slate-500"> s/IVA</span>
                  </p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                    É isto que a equipa diz ao cliente no local. O profissional declara quantas
                    unidades encontrou — nunca um valor — e o preço recalcula-se sozinho.
                  </p>
                </div>
              )}

              {teto != null && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-300/90">
                  Tecto sem nova aprovação: <span className="font-bold">{fmtMoney(teto)}</span>.
                  Abaixo disto o ajuste é aplicado automaticamente e o preço final muda sem
                  passar por aqui; acima, vai à decisão do cliente.
                </p>
              )}
            </div>
          )}

          {/* Notas escritas pelo cliente no wizard (§3.2) — até agora eram
              descartadas e nunca chegavam a quem executa o serviço */}
          {(() => {
            const notas = typeof facts?.notas_cliente === "string" ? facts.notas_cliente.trim() : "";
            const local = (facts?.local ?? null) as Record<string, unknown> | null;
            const semCoordenadas = local != null && local.lat == null;
            if (!notas && !semCoordenadas) return null;
            return (
              <div className={CARD}>
                <p className={CARD_TITLE}>Notas do cliente</p>
                {notas && (
                  <p className="text-sm italic leading-relaxed text-[#F5FAFF]">&ldquo;{notas}&rdquo;</p>
                )}
                {semCoordenadas && (
                  <p className={`${notas ? "mt-2 " : ""}text-[11px] leading-relaxed text-amber-300`}>
                    Morada escrita à mão (sem coordenadas) — o motor não calcula a deslocação
                    e nunca fecha preço; sai sempre como estimativa.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Motor de preços — o raciocínio, não só o número (§3.3) */}
          {motor?.trace && (
            <div className={CARD}>
              <p className={CARD_TITLE}>
                Motor de preços
                {motor.trace.engine_source && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    motor.trace.engine_source === "gemini"
                      ? "bg-violet-500/15 text-violet-300"
                      : "bg-white/[0.06] text-slate-400"
                  }`}>
                    {motor.trace.engine_source === "gemini" ? "com IA" : "determinístico"}
                  </span>
                )}
              </p>

              {(() => {
                const t = motor.trace!;
                // O que o cliente viu: displayPrice sobre a cotação, não o
                // total cru (que pode vir a 0 com o valor no intervalo)
                const mostrado = displayPrice(motor.quote ?? order).value;
                const abaixo = isBelowFloor(motor.outcome?.price_approved ?? mostrado, t.engine_floor);
                const cells = [
                  { label: "Piso", value: t.engine_floor, sub: "abaixo disto há prejuízo", tone: "text-red-300" },
                  { label: "Sugestão IA", value: t.gemini_price, sub: t.gemini_price == null ? "IA não respondeu" : "antes do clamp", tone: "text-violet-300" },
                  { label: "Mostrado", value: mostrado, sub: "o que o cliente viu", tone: "text-white" },
                  { label: "Teto", value: t.engine_ceiling, sub: "limite superior", tone: "text-slate-300" },
                ];
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {cells.map((c) => (
                        <div key={c.label} className="rounded-xl border border-white/[0.06] bg-[#12263B]/50 p-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
                          <p className={`mt-1 text-sm font-bold ${c.value == null ? "text-slate-600" : c.tone}`}>
                            {c.value == null ? "—" : fmtMoney(Number(c.value))}
                          </p>
                          <p className="mt-0.5 text-[9px] leading-tight text-slate-600">{c.sub}</p>
                        </div>
                      ))}
                    </div>

                    {abaixo === true && (
                      <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                        <p className="text-xs font-bold text-red-300">Preço abaixo do piso anti-prejuízo</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-red-200/80">
                          Este trabalho está a ser cobrado abaixo do custo calculado pelo motor.
                        </p>
                      </div>
                    )}

                    {typeof t.engine_confidence === "number" && (
                      <p className="mt-2 text-[10px] text-slate-500">
                        Confiança do motor: {Math.round(t.engine_confidence * 100)}%
                      </p>
                    )}

                    {Array.isArray(t.engine_reasons) && t.engine_reasons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(t.engine_reasons as unknown[]).map((r, i) => (
                          <span key={i} className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] text-slate-400">
                            {typeof r === "string" ? r : JSON.stringify(r)}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Registo de execução — conjunto de treino do motor (§3.4) */}
          {motor?.outcome?.approved_at && (
            <div className={CARD}>
              <p className={CARD_TITLE}>Resultado real do trabalho</p>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                Sem estes números o motor não aprende — é a diferença entre calibrar com
                dados e calibrar com intuição. Preencher quando o trabalho fechar.
              </p>

              {motor.outcome.executed_at ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-sm font-bold text-emerald-300">
                      Cobrado {fmtMoney(Number(motor.outcome.price_executed))}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      aprovado {fmtMoney(Number(motor.outcome.price_approved))}
                    </span>
                    {typeof motor.outcome.desvio_pct === "number" && (
                      <span className={`text-[11px] font-semibold ${
                        Math.abs(motor.outcome.desvio_pct) > 20 ? "text-amber-300" : "text-slate-400"
                      }`}>
                        desvio {motor.outcome.desvio_pct > 0 ? "+" : ""}{motor.outcome.desvio_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {/* Decomposição: negociação (mercado) vs ajuste (medição) */}
                  {(motor.outcome.ajustes_contagem ?? 0) > 0 && (
                    <p className="mt-1.5 text-[11px] text-violet-300">
                      {motor.outcome.ajustes_contagem} ajuste{(motor.outcome.ajustes_contagem ?? 0) > 1 ? "s" : ""} no local
                      {motor.outcome.ajustes_total != null && ` · ${fmtMoney(motor.outcome.ajustes_total)}`}
                      <span className="text-slate-500"> — erro de medição, não de preço</span>
                    </p>
                  )}
                  {motor.outcome.valor_cobrado_real != null && (
                    <p className="mt-1 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2 py-1 text-[11px] text-amber-300">
                      Cobrança fora da plataforma: o profissional cobrou {fmtMoney(motor.outcome.valor_cobrado_real)},
                      o sistema dizia {fmtMoney(Number(motor.outcome.price_executed))}.
                    </p>
                  )}
                  {(motor.outcome.horas_reais != null || motor.outcome.pessoas_reais != null) && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {motor.outcome.horas_reais != null && `${motor.outcome.horas_reais}h`}
                      {motor.outcome.horas_reais != null && motor.outcome.pessoas_reais != null && " · "}
                      {motor.outcome.pessoas_reais != null && `${motor.outcome.pessoas_reais} pessoas`}
                    </p>
                  )}
                  {motor.outcome.ajustes_no_local && (
                    <p className="mt-1 text-[11px] italic text-slate-400">&ldquo;{motor.outcome.ajustes_no_local}&rdquo;</p>
                  )}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <label className={IL}>Valor do sistema (€ s/IVA)</label>
                    <input type="number" step="0.01" min="0" value={execPrice}
                      onChange={(e) => setExecPrice(e.target.value)} className={INP} />
                    <p className="mt-0.5 text-[9px] leading-tight text-slate-600">
                      Já inclui ajustes aplicados no local. Confirma ou corrige.
                    </p>
                  </div>
                  <div>
                    <label className={IL}>Horas reais</label>
                    <input type="number" step="0.5" min="0" value={execHoras}
                      onChange={(e) => setExecHoras(e.target.value)} className={INP} />
                  </div>
                  <div>
                    <label className={IL}>Pessoas</label>
                    <input type="number" step="1" min="0" value={execPessoas}
                      onChange={(e) => setExecPessoas(e.target.value)} className={INP} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={IL}>Cobrou valor diferente? (opcional)</label>
                    <input type="number" step="0.01" min="0" value={execCobradoReal}
                      onChange={(e) => setExecCobradoReal(e.target.value)} className={INP}
                      placeholder="Deixa vazio se cobrou o valor acima" />
                    <p className="mt-0.5 text-[9px] leading-tight text-slate-600">
                      No pagamento em mão, o que o profissional cobrou pode não ser o do sistema.
                      Preencher só quando divergir — é assim que se detecta cobrança fora da plataforma.
                    </p>
                  </div>
                  <div className="sm:col-span-3">
                    <label className={IL}>Ajustes no local (opcional)</label>
                    <textarea value={execAjustes} onChange={(e) => setExecAjustes(e.target.value)}
                      rows={2} placeholder="Ex: apareceu um sofá extra; escada mais estreita do que o previsto."
                      className={TA} />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleRecordExecution}
                      disabled={saving || execPrice === "" || Number(execPrice) <= 0}
                      className="w-full rounded-lg bg-[#00BDEB] px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "A registar..." : "Registar resultado real"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Motor indisponível */}
          {motor?.unavailable && motor.notice && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <p className="text-xs font-bold text-amber-300">Motor de preços indisponível</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{motor.notice}</p>
            </div>
          )}

          {/* Histórico de propostas de horário */}
          {horario && horario.proposals.length > 0 && (
            <div className={CARD}>
              <p className={CARD_TITLE}>Propostas de horário</p>
              <div className="space-y-2">
                {horario.proposals.map((sp) => (
                  <div key={sp.id} className={`rounded-xl border p-3 ${
                    sp.status === "pending" ? "border-violet-500/20 bg-violet-500/[0.05]" : "border-white/[0.06] bg-[#12263B]/50"
                  }`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {sp.partner_name ?? "Profissional"}
                      </span>
                      <span className="text-[10px] text-slate-600">· {fmtDt(sp.created_at)}</span>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        sp.status === "pending"  ? "bg-violet-500/15 text-violet-300"
                        : sp.status === "accepted" ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/[0.06] text-slate-400"
                      }`}>
                        {SCHEDULE_STATUS_LABEL[sp.status] ?? sp.status}
                      </span>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-bold text-white">{fmtDt(sp.proposed_for)}</span>
                      {sp.previous_for && (
                        <span className="text-xs text-slate-600 line-through">{fmtDt(sp.previous_for)}</span>
                      )}
                    </p>
                    {sp.reason && (
                      <p className="mt-1 text-[11px] italic leading-relaxed text-slate-400">&ldquo;{sp.reason}&rdquo;</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Negociação de preço — rondas com o cliente */}
          {nego && nego.rounds.length > 0 && (
            <div className={CARD}>
              <p className={CARD_TITLE}>
                Negociação de preço
                {typeof nego.customerCounters === "number" && typeof nego.counterLimit === "number" && (
                  <span className="ml-2 font-normal text-slate-500">
                    · cliente usou {nego.customerCounters} de {nego.counterLimit} contrapropostas
                  </span>
                )}
              </p>
              <div className="space-y-2">
                {nego.rounds.map((r, i) => {
                  const anterior = nego.rounds[i + 1];
                  const isAdmin = r.actor === "admin";
                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl border p-3 ${isAdmin ? "border-violet-500/20 bg-violet-500/[0.05]" : "border-white/[0.07] bg-[#12263B]/50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isAdmin ? "text-violet-300" : "text-[#00BDEB]"}`}>
                          {isAdmin ? "CLYON" : "Cliente"}
                        </span>
                        <span className="text-[10px] text-slate-600">· ronda {r.round} · {fmtDt(r.created_at)}</span>
                        <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          r.status === "pending"  ? "bg-amber-500/15 text-amber-300"
                          : r.status === "accepted" ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/[0.06] text-slate-400"
                        }`}>
                          {PROPOSAL_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </div>
                      <p className="mt-1.5 flex items-baseline gap-2">
                        <span className="text-base font-bold text-white">{fmtMoney(r.amount)}</span>
                        {anterior && anterior.amount !== r.amount && (
                          <span className="text-xs text-slate-600 line-through">{fmtMoney(anterior.amount)}</span>
                        )}
                      </p>
                      {r.message && (
                        <p className="mt-1 text-[11px] italic leading-relaxed text-slate-400">&ldquo;{r.message}&rdquo;</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dependência do Bridge ainda não disponível */}
          {nego?.unavailable && nego.notice && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <p className="text-xs font-bold text-amber-300">Negociação de preço indisponível</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{nego.notice}</p>
            </div>
          )}

          {/* Detalhes técnicos colapsados */}
          {meta && <TechnicalDetails rest={meta.rest} />}

          {/* Histórico de operações */}
          {ops.length > 0 && (
            <div className={CARD}>
              <p className={CARD_TITLE}>Histórico de operações</p>
              <div className="space-y-2">
                {ops.map((op) => (
                  <div key={op.id} className="rounded-xl border border-white/[0.05] bg-[#12263B]/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-300">{op.colab_nome}</span>
                      <span className="text-[10px] text-slate-600">{fmtDt(op.created_at)}</span>
                    </div>
                    {op.status_from && op.status_to && (
                      <p className="mt-1 text-xs text-slate-500">
                        {INLINE_STATUS_CFG[op.status_from]?.label ?? op.status_from} → <span className="text-cyan-400">{INLINE_STATUS_CFG[op.status_to]?.label ?? op.status_to}</span>
                      </p>
                    )}
                    {op.reason && <p className="mt-1 text-xs text-amber-300">Motivo: {op.reason}</p>}
                    {op.note && <p className="mt-1 text-xs text-slate-400 italic">{op.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          <div className={CARD}>
            <p className={CARD_TITLE}>Cliente</p>
            <p className="text-sm font-medium text-white">{displayText(order.client_name)}</p>
            {typeof order.client_phone === "string" && order.client_phone && (
              <p className="mt-0.5 text-xs text-slate-500">{order.client_phone}</p>
            )}
            {typeof order.client_email === "string" && order.client_email && (
              <p className="text-xs text-slate-500 break-all">{order.client_email}</p>
            )}

            {/* Contactar cliente */}
            {((typeof order.client_phone === "string" && order.client_phone) ||
              (typeof order.client_email === "string" && order.client_email)) && (
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {typeof order.client_phone === "string" && order.client_phone && (
                  <>
                    <a
                      href={buildWhatsappLink(order.client_phone, order.id, displayText(order.category_name ?? order.category_slug, "pedido"))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 rounded-lg border border-[#19C37D]/25 bg-[#19C37D]/[0.08] px-2 py-2 text-[10px] font-semibold text-[#19C37D] transition hover:bg-[#19C37D]/[0.15]"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </a>
                    <a
                      href={`tel:${order.client_phone}`}
                      className="flex flex-col items-center gap-1 rounded-lg border border-white/[0.08] bg-[#12263B] px-2 py-2 text-[10px] font-semibold text-[#00BDEB] transition hover:bg-[#12263B]/70"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Chamar
                    </a>
                  </>
                )}
                {typeof order.client_email === "string" && order.client_email && (
                  <a
                    href={`mailto:${order.client_email}?subject=${encodeURIComponent(`CLYON — pedido #${order.id.slice(0, 8)}`)}`}
                    className="flex flex-col items-center gap-1 rounded-lg border border-white/[0.08] bg-[#12263B] px-2 py-2 text-[10px] font-semibold text-[#00BDEB] transition hover:bg-[#12263B]/70"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                )}
              </div>
            )}
          </div>

          <div className={CARD}>
            <p className={CARD_TITLE}>Dados do pedido</p>
            <div className="space-y-3">
              <div>
                <label className={IL}>Urgência</label>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={INP}>
                  <option value="normal" className="bg-[#0C1C2E]">Normal</option>
                  <option value="urgent" className="bg-[#0C1C2E]">Urgente</option>
                  <option value="flexible" className="bg-[#0C1C2E]">Flexível</option>
                </select>
              </div>
              <div>
                <label className={IL}>Valor do orçamento (€)</label>
                <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={INP} />
              </div>
              <div>
                <label className={IL}>Data/hora agendada</label>
                <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className={INP} />
              </div>
              <div>
                <label className={IL}>Nota interna</label>
                <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} placeholder="Nota registada no histórico..." className={TA} />
              </div>

              {/* Override manual — recolhido: a via normal é o botão de fase
                  seguinte na coluna principal. Aqui é excepção, não rotina. */}
              <details className="rounded-lg border border-white/[0.06] bg-[#0C1C2E]/60">
                <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#97AABD] transition hover:text-slate-300">
                  ⚙ Forçar estado
                </summary>
                <div className="space-y-2 border-t border-white/[0.06] p-3">
                  <select value={status} onChange={(e) => setStatus(e.target.value as AppStatus)} className={INP}>
                    {INLINE_VALID_STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-[#0C1C2E]">{INLINE_STATUS_CFG[s].label}</option>
                    ))}
                  </select>
                  {needsReason && (
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                      placeholder="Motivo do cancelamento / rejeição (obrigatório)…" className={TA} />
                  )}
                  <p className="text-[10px] leading-relaxed text-slate-600">
                    Salta a validação da sequência e fica marcado como forçado na Auditoria.
                  </p>
                </div>
              </details>
            </div>
            <button onClick={handleSave} disabled={saving} className="mt-4 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
              {saving ? "A guardar..." : "Guardar"}
            </button>
          </div>

          {/* Acções de administração */}
          <div className={CARD}>
            <p className={CARD_TITLE}>Acções de administração</p>
            {isArchived && (
              <p className="mb-3 rounded-lg border border-[#F6B84A]/20 bg-[#F6B84A]/[0.06] px-3 py-2 text-[11px] text-[#F6B84A]">
                Este pedido está arquivado — não aparece nas listas operacionais.
              </p>
            )}
            <button
              onClick={handleArchive}
              disabled={actionBusy !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#12263B] py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-[#12263B]/70 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {actionBusy === "archive" ? "A processar..." : isArchived ? "Restaurar pedido" : "Arquivar pedido"}
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => { setConfirmDelete(true); setSaveError(null); }}
                disabled={actionBusy !== null}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#EF5A67]/25 py-2.5 text-sm font-semibold text-[#EF5A67] transition hover:bg-[#EF5A67]/[0.08] disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar pedido
              </button>
            ) : (
              <div className="mt-3 rounded-xl border border-[#EF5A67]/25 bg-[#EF5A67]/[0.05] p-3">
                <p className="text-xs font-bold text-[#EF5A67]">Eliminar definitivamente?</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Esta acção é irreversível. Um instantâneo do pedido fica registado em Auditoria. Considera arquivar em vez de eliminar.
                </p>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={2}
                  placeholder="Motivo da eliminação (obrigatório)…"
                  className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[#0C1C2E] px-3 py-2 text-sm text-[#F5FAFF] outline-none transition focus:border-[#EF5A67] resize-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => { setConfirmDelete(false); setDeleteReason(""); }}
                    disabled={actionBusy !== null}
                    className="flex-1 rounded-lg border border-white/[0.1] bg-[#12263B] py-2 text-xs font-semibold text-slate-300 transition hover:bg-[#12263B]/70 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={actionBusy !== null || !deleteReason.trim()}
                    className="flex-1 rounded-lg bg-[#EF5A67] py-2 text-xs font-bold text-white transition hover:bg-[#EF5A67]/85 disabled:opacity-50"
                  >
                    {actionBusy === "delete" ? "A eliminar..." : "Eliminar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STATUS_LABELS ──────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", received: "Recebido", in_review: "Em análise",
  awaiting_customer_approval: "Proposta no cliente",
  awaiting_deposit: "Aguarda depósito", assignment_pending: "A atribuir",
  partner_selected: "Parceiro", confirmed: "Confirmado",
  in_route: "A caminho", arrived: "Chegou", in_execution: "Em execução",
  extra_review_requested: "Ajuste no cliente", awaiting_confirmation: "Ag. confirmação",
  completed: "Concluído", in_dispute: "Disputa", canceled: "Cancelado", rejected: "Rejeitado",
};


// ── Visão Geral ────────────────────────────────────────────────────────────
type VisaoGeral = {
  stats: {
    total: number; open: number; inProgress: number; completed: number;
    cancelled: number; urgent: number; unassigned: number; scheduledToday: number;
    new7d?: number; revenue30d?: number; partnersActive?: number;
  };
  recent: Array<{ id: string; slug: string; status: string; created_at: string; profiles?: { name?: string } | null }>;
};

function TabVisaoGeral({ authHeader }: { authHeader: Record<string, string> }) {
  const [data, setData] = useState<VisaoGeral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/app-clyon/visao-geral", { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setData(json);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;
  if (!data) return null;

  const { stats, recent } = data;
  const cards = [
    { label: "Total",           value: stats.total,          color: "text-white" },
    { label: "Abertos",         value: stats.open,           color: "text-yellow-400" },
    { label: "Em curso",        value: stats.inProgress,     color: "text-blue-400" },
    { label: "Concluídos",      value: stats.completed,      color: "text-emerald-400" },
    { label: "Cancelados",      value: stats.cancelled,      color: "text-slate-500" },
    { label: "Urgentes",        value: stats.urgent,         color: "text-red-400" },
    { label: "Sem atribuição",  value: stats.unassigned,     color: "text-orange-400" },
    { label: "Agendados hoje",  value: stats.scheduledToday, color: "text-cyan-400" },
  ];
  const highlightCards = [
    { label: "Novos (7 dias)",       value: stats.new7d ?? 0,                             color: "text-cyan-300",    hint: "Pedidos criados" },
    { label: "Receita 30d (est.)",   value: fmtMoney(stats.revenue30d ?? 0),              color: "text-emerald-300", hint: "Estimativas de concluídos" },
    { label: "Profissionais activos",value: stats.partnersActive ?? 0,                    color: "text-violet-300",  hint: "Disponíveis agora" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {highlightCards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
            <p className={`mt-1.5 text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="mt-0.5 text-[10px] text-slate-600">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
            <p className={`mt-1.5 text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02]">
          <div className="border-b border-white/[0.05] px-4 py-3">
            <p className="text-xs font-semibold text-slate-400">Pedidos recentes — abertos/urgentes</p>
          </div>
          {recent.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-white/[0.03] px-4 py-3 last:border-0">
              <span className="font-mono text-xs text-slate-600">{r.id.slice(0, 8)}</span>
              <span className="flex-1 text-sm text-white">{r.profiles?.name ?? "—"}</span>
              <span className="text-xs text-slate-400">{r.slug}</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-300">
                {STATUS_LABELS[r.status] ?? r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Agenda (semana segunda→domingo, Europe/Lisbon) ────────────────────────
type AgendaOrder = {
  id: string; title: string; status: string; urgency: string;
  scheduled_for: string; city: string; client_name: string | null;
};

const WEEKDAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const TZ = "Europe/Lisbon";

// Devolve o ano/mês/dia em Lisboa como { y, m, d } — evita drift UTC.
function lisbonParts(d: Date): { y: number; m: number; d: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // weekday em en-GB curto: Mon=1..Sun=7 em ISO. Fazemos manualmente.
  const wdMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: wdMap[get("weekday")] ?? 1,
  };
}

function lisbonDateStr(d: Date): string {
  const { y, m, d: dd } = lisbonParts(d);
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// Segunda-feira da semana que contém `d`, em Europe/Lisbon.
// Retorna uma Date UTC-safe ancorada ao meio-dia local de Lisboa (evita DST edge).
function getMonday(d: Date): Date {
  const { y, m, d: dd, weekday } = lisbonParts(d);
  // Constrói meio-dia local de Lisboa. new Date(YYYY-MM-DDT12:00) usa TZ local do runtime,
  // mas como só usamos lisbonDateStr para o output, chega para calcular offsets de dia.
  const base = new Date(Date.UTC(y, m - 1, dd, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() - (weekday - 1));
  return base;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function fmtWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmtD = (dt: Date) => new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, day: "2-digit", month: "short" }).format(dt);
  return `${fmtD(monday)} — ${fmtD(sunday)}`;
}

function TabAgenda({ authHeader }: { authHeader: Record<string, string> }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [orders, setOrders] = useState<AgendaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const from = lisbonDateStr(weekStart);
    const to = lisbonDateStr(addDays(weekStart, 7));
    try {
      const res = await fetch(`/api/admin/app-clyon/agenda?from=${from}&to=${to}`, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setOrders(json.orders ?? []);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, weekStart]);

  useEffect(() => { load(); }, [load]);

  const prevWeek = () => setWeekStart((w) => addDays(w, -7));
  const nextWeek = () => setWeekStart((w) => addDays(w, 7));
  const goToday = () => setWeekStart(getMonday(new Date()));

  const todayStr = lisbonDateStr(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = lisbonDateStr(date);
    const dayOrders = orders.filter((o) => lisbonDateStr(new Date(o.scheduled_for)) === dateStr);
    const isToday = dateStr === todayStr;
    return { date, dateStr, label: WEEKDAY_LABELS[i], dayOrders, isToday };
  });

  const totalWeek = orders.length;

  return (
    <div className="space-y-4">
      {/* Navegação da semana */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.08] transition">
            ←
          </button>
          <button onClick={goToday} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.08] transition">
            Hoje
          </button>
          <button onClick={nextWeek} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.08] transition">
            →
          </button>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{fmtWeekRange(weekStart)}</p>
          <p className="text-[10px] text-slate-500">{totalWeek} agendamento{totalWeek !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {loading ? <Spinner /> : error ? <ErrBox msg={error} onRetry={load} /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {days.map((d) => (
            <div
              key={d.dateStr}
              className={`rounded-[18px] border p-3 min-h-[120px] ${
                d.isToday
                  ? "border-cyan-400/30 bg-cyan-500/[0.04]"
                  : "border-white/[0.07] bg-white/[0.02]"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${d.isToday ? "text-cyan-400" : "text-slate-500"}`}>
                  {d.label}
                </span>
                <span className={`text-xs font-semibold ${d.isToday ? "text-cyan-400" : "text-slate-400"}`}>
                  {lisbonParts(d.date).d}
                </span>
              </div>
              {d.dayOrders.length === 0 ? (
                <p className="text-[10px] text-slate-600 italic">Sem agendamentos</p>
              ) : (
                <div className="space-y-1.5">
                  {d.dayOrders.map((o) => (
                    <div key={o.id} className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-cyan-400">
                          {new Date(o.scheduled_for).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })}
                        </span>
                        {o.urgency === "urgent" && (
                          <span className="text-[9px] font-bold text-red-400">URG</span>
                        )}
                      </div>
                      <p className="text-[11px] text-white truncate">{o.client_name ?? "—"}</p>
                      <p className="text-[10px] text-slate-500 truncate">{o.title}</p>
                      {o.city && <p className="text-[10px] text-slate-600">{o.city}</p>}
                      <span className="mt-0.5 inline-block rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-400">
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Profissionais (partners app) ──────────────────────────────────────────
// O que aqui se edita é o que o cliente vê no perfil do profissional na app.
type PartnerProfile = {
  id: string; user_id: string | null;
  trade_name: string | null; legal_name: string | null; kind: string | null;
  status: string | null; tier: string | null; trust_score: number | null;
  earning_share: number | null; jobs_completed: number | null;
  full_name: string | null; email: string | null; phone: string | null;
  avatar_url: string | null; created_at: string | null;
  regions: string[]; service_categories: string[];
  services: string[]; services_active: number;
  docs_total: number; docs_approved: number; docs_pending: number; docs_rejected: number;
  verified: boolean; verification_reason: string | null; missing_badge_docs: string[];
  description_needs_attention: boolean;
  rating_avg: number; rating_count: number; has_vehicle: boolean | null;
};
type PartnerStats = { total: number; approved: number; pending: number; docs_pending: number; sem_descricao: number };

type PartnerDoc = {
  id: string; doc_type: string; status: string; notes: string | null;
  file_url: string | null; storage_path: string | null;
  uploaded_at: string | null; approved_at: string | null; rejected_at: string | null;
};
type PartnerService = {
  id: string; category_slug: string; active: boolean;
  accepts_urgent: boolean; has_equipment: boolean; has_experience: boolean;
  verified_at: string | null;
};
type PartnerDetail = {
  partner: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  services: PartnerService[];
  documents: PartnerDoc[];
  reviews: Array<{ id: string; rating: number; comment: string | null; status: string; created_at: string }>;
  verification: { verified: boolean; missingDocs: string[]; reason: string | null };
  description_state: { needsAttention: boolean; canCopyFromBio: boolean; message: string | null };
  stats: { bookings_total: number; bookings_active: number; rating_avg: number | null; rating_count: number };
};

const PARTNER_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Candidatura submetida", cls: "bg-amber-500/15 text-amber-300" },
  in_review: { label: "Em análise",            cls: "bg-amber-500/15 text-amber-300" },
  approved:  { label: "Aprovado",              cls: "bg-emerald-500/15 text-emerald-300" },
  rejected:  { label: "Rejeitado",             cls: "bg-red-500/15 text-red-300" },
  suspended: { label: "Suspenso",              cls: "bg-red-500/15 text-red-300" },
};

const DOC_LABELS: Record<string, string> = {
  id: "Documento de identificação", nif: "NIF",
  activity: "Início de actividade", iban: "Comprovativo de IBAN",
};

// Painel de gestão de um profissional — o que aqui se muda é o que o cliente
// passa a ver na app.
function ProfissionalPanel({
  id, authHeader, onBack, onChanged,
}: {
  id: string; authHeader: Record<string, string>;
  onBack: () => void; onChanged?: () => void;
}) {
  const [d, setD] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [earningShare, setEarningShare] = useState("");
  const [docReject, setDocReject] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/app-clyon/profissionais/${id}`, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao carregar."); return; }
      setD(json as PartnerDetail);
      const p = json.partner as Record<string, unknown>;
      setDescricao(typeof p.description === "string" ? p.description : "");
      setTradeName(typeof p.trade_name === "string" ? p.trade_name : "");
      setEarningShare(p.earning_share != null ? String(p.earning_share) : "");
      setReason(""); setDocReject({});
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [id, authHeader]);

  useEffect(() => { load(); }, [load]);

  const patch = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setErrMsg(null); setMsg(null);
    try {
      const res = await fetch(`/api/admin/app-clyon/profissionais/${id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setErrMsg(json.error ?? "Erro ao guardar."); return; }
      let extra = "";
      if (json.verification && !json.verification.verified && json.verification.reason) {
        extra = ` ${json.verification.reason}`;
      }
      setMsg(ok + extra);
      await load(); onChanged?.();
    } catch { setErrMsg("Erro de ligação."); }
    finally { setBusy(false); }
  };

  const post = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setErrMsg(null); setMsg(null);
    try {
      const res = await fetch(`/api/admin/app-clyon/profissionais/${id}`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setErrMsg(json.error ?? "Erro."); return; }
      let extra = "";
      if (json.verification?.reason) extra = ` ${json.verification.reason}`;
      else if (json.verification?.verified) extra = " O selo de verificado já aparece no app.";
      setMsg(ok + extra);
      await load(); onChanged?.();
    } catch { setErrMsg("Erro de ligação."); }
    finally { setBusy(false); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;
  if (!d) return null;

  const p = d.partner;
  const estado = String(p.status ?? "");
  const cfg = PARTNER_STATUS_CFG[estado];
  const nome = String(p.trade_name ?? d.profile?.full_name ?? "Profissional");
  const IL2 = "text-[10px] uppercase tracking-wider text-[#97AABD] block mb-1";
  const INP2 = "h-9 w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 text-sm text-[#F5FAFF] outline-none focus:border-[#00BDEB]";
  const TA2 = "w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 py-2 text-sm text-[#F5FAFF] outline-none focus:border-[#00BDEB] resize-none";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="rounded-lg border border-white/[0.08] bg-[#12263B] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#00BDEB]/40">
          ← Voltar
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[#F5FAFF]">{nome}</h3>
            {d.verification.verified && (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">✓ Verificado</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {d.profile?.full_name ? String(d.profile.full_name) : "—"}
            {d.profile?.email ? ` · ${d.profile.email}` : ""}
            {d.profile?.phone ? ` · ${d.profile.phone}` : ""}
          </p>
        </div>
        {cfg && (
          <span className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold ${cfg.cls}`}>{cfg.label}</span>
        )}
      </div>

      {errMsg && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{errMsg}</div>}
      {msg && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{msg}</div>}

      {/* Selo de verificado — aprovar não chega */}
      {!d.verification.verified && d.verification.reason && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-xs font-bold text-amber-300">Selo de verificado não aparece no app</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{d.verification.reason}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {/* Apresentação pública — o bug bio vs description */}
          <div className={CARD}>
            <p className={CARD_TITLE}>Apresentação pública</p>
            {d.description_state.needsAttention && d.description_state.message && (
              <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                <p className="text-[11px] leading-relaxed text-amber-200/90">{d.description_state.message}</p>
                {d.description_state.canCopyFromBio && (
                  <button
                    onClick={() => post({ action: "copy_bio" }, "Bio copiada para a descrição pública.")}
                    disabled={busy}
                    className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    Copiar bio para a descrição
                  </button>
                )}
              </div>
            )}
            <label className={IL2}>Descrição que o cliente vê</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className={TA2}
              placeholder="Ex: Recolhas e mudanças na Margem Sul há 15 anos. Equipa própria e carrinha de 12 m³." />
            {typeof p.bio === "string" && p.bio.trim() && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
                Bio escrita pelo profissional (não visível ao cliente): &ldquo;{p.bio}&rdquo;
              </p>
            )}
            <label className={`${IL2} mt-3`}>Nome comercial</label>
            <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} className={INP2} />
            <button
              onClick={() => patch({ description: descricao.trim(), trade_name: tradeName.trim() }, "Perfil público actualizado.")}
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-[#00BDEB] py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? "A guardar..." : "Guardar apresentação"}
            </button>
          </div>

          {/* Documentos */}
          <div className={CARD}>
            <p className={CARD_TITLE}>Documentos ({d.documents.length})</p>
            {d.documents.length === 0 ? (
              <p className="text-xs text-slate-500">O profissional ainda não submeteu documentos.</p>
            ) : (
              <div className="space-y-2">
                {d.documents.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-white/[0.07] bg-[#12263B]/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[#F5FAFF]">{DOC_LABELS[doc.doc_type] ?? doc.doc_type}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        doc.status === "approved" ? "bg-emerald-500/15 text-emerald-300"
                        : doc.status === "rejected" ? "bg-red-500/15 text-red-300"
                        : "bg-amber-500/15 text-amber-300"
                      }`}>{doc.status}</span>
                      {(doc.doc_type === "id" || doc.doc_type === "nif") && (
                        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[9px] text-sky-300">exigido para o selo</span>
                      )}
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          className="ml-auto text-[11px] font-semibold text-[#00BDEB] hover:underline">Abrir</a>
                      )}
                    </div>
                    {doc.notes && <p className="mt-1 text-[10px] italic text-slate-500">&ldquo;{doc.notes}&rdquo;</p>}
                    {doc.status !== "approved" && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => post({ action: "document", document_id: doc.id, status: "approved" }, "Documento aprovado.")}
                          disabled={busy}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                        >Aprovar</button>
                        <input
                          value={docReject[doc.id] ?? ""}
                          onChange={(e) => setDocReject((m) => ({ ...m, [doc.id]: e.target.value }))}
                          placeholder="Motivo para rejeitar…"
                          className="h-8 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#0C1C2E] px-2 text-[11px] text-white outline-none focus:border-red-400"
                        />
                        <button
                          onClick={() => post({ action: "document", document_id: doc.id, status: "rejected", notes: docReject[doc.id] }, "Documento rejeitado.")}
                          disabled={busy || !(docReject[doc.id] ?? "").trim()}
                          className="rounded-lg border border-red-500/30 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                        >Rejeitar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Serviços */}
          <div className={CARD}>
            <p className={CARD_TITLE}>Serviços ({d.services.length})</p>
            {d.services.length === 0 ? (
              <p className="text-xs text-slate-500">Sem serviços declarados — este profissional não recebe oportunidades.</p>
            ) : (
              <div className="space-y-1.5">
                {d.services.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-[#12263B]/50 px-3 py-2">
                    <span className="text-sm text-[#F5FAFF]">{s.category_slug}</span>
                    {s.has_equipment && <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-slate-400">equipamento</span>}
                    {s.has_experience && <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-slate-400">experiência</span>}
                    {s.accepts_urgent && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300">urgentes</span>}
                    {s.verified_at && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-300">verificado</span>}
                    <div className="ml-auto flex gap-1.5">
                      <button
                        onClick={() => post({ action: "service", service_id: s.id, verified: !s.verified_at }, s.verified_at ? "Verificação removida." : "Serviço verificado.")}
                        disabled={busy}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:border-sky-400/40 disabled:opacity-50"
                      >{s.verified_at ? "Retirar verificação" : "Verificar"}</button>
                      <button
                        onClick={() => post({ action: "service", service_id: s.id, active: !s.active }, s.active ? "Serviço desactivado." : "Serviço activado.")}
                        disabled={busy}
                        className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50 ${
                          s.active ? "border-red-500/25 text-red-300 hover:bg-red-500/10" : "border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10"
                        }`}
                      >{s.active ? "Desactivar" : "Activar"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Avaliações */}
          {d.reviews.length > 0 && (
            <div className={CARD}>
              <p className={CARD_TITLE}>
                Avaliações
                {d.stats.rating_avg != null && (
                  <span className="ml-2 font-normal text-amber-300">★ {d.stats.rating_avg} · {d.stats.rating_count}</span>
                )}
              </p>
              <div className="space-y-2">
                {d.reviews.slice(0, 6).map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/[0.06] bg-[#12263B]/50 p-3">
                    <div className="flex items-center gap-2">
                      {/* Normalizado: reviews.rating passa a 0-10 quando a
                          migração das avaliações correr (REVIEW_SCALE_MAX) */}
                      <span className="text-xs text-amber-300">
                        {"★".repeat(Math.min(5, Math.max(0, Math.round(toFiveStars(r.rating) ?? 0))))}
                      </span>
                      <span className="text-[10px] text-slate-600">{fmtDt(r.created_at)}</span>
                      <span className="ml-auto rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] text-slate-400">{r.status}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-[11px] leading-relaxed text-slate-300">&ldquo;{r.comment}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral — decisões administrativas */}
        <div className="space-y-4">
          <div className={CARD}>
            <p className={CARD_TITLE}>Estado da candidatura</p>
            <div className="space-y-2">
              {estado !== "approved" && (
                <button
                  onClick={() => patch({ status: "approved" }, "Profissional aprovado.")}
                  disabled={busy}
                  className="w-full rounded-lg bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >Aprovar profissional</button>
              )}
              {estado !== "in_review" && estado !== "approved" && (
                <button
                  onClick={() => patch({ status: "in_review" }, "Passou a Em análise.")}
                  disabled={busy}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#12263B] py-2 text-xs font-semibold text-slate-300 hover:border-[#00BDEB]/40 disabled:opacity-50"
                >Marcar em análise</button>
              )}
              <label className={`${IL2} mt-2`}>Motivo (obrigatório para rejeitar ou suspender)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                placeholder="O profissional vê este motivo…" className={TA2} />
              <div className="flex gap-2">
                <button
                  onClick={() => patch({ status: "rejected", reason }, "Profissional rejeitado.")}
                  disabled={busy || !reason.trim() || estado === "rejected"}
                  className="flex-1 rounded-lg border border-red-500/30 py-2 text-[11px] font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                >Rejeitar</button>
                <button
                  onClick={() => patch({ status: "suspended", reason }, "Profissional suspenso.")}
                  disabled={busy || !reason.trim() || estado === "suspended"}
                  className="flex-1 rounded-lg border border-amber-500/30 py-2 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                >Suspender</button>
              </div>
              {typeof p.rejection_reason === "string" && p.rejection_reason && (
                <p className="text-[10px] leading-relaxed text-red-300/80">Rejeitado: &ldquo;{p.rejection_reason}&rdquo;</p>
              )}
              {typeof p.suspension_reason === "string" && p.suspension_reason && (
                <p className="text-[10px] leading-relaxed text-amber-300/80">Suspenso: &ldquo;{p.suspension_reason}&rdquo;</p>
              )}
            </div>
          </div>

          <div className={CARD}>
            <p className={CARD_TITLE}>Condições comerciais</p>
            <label className={IL2}>Quota do profissional (0 a 1)</label>
            <input type="number" step="0.01" min="0.01" max="1" value={earningShare}
              onChange={(e) => setEarningShare(e.target.value)} className={INP2} />
            <p className="mt-1 text-[10px] text-slate-600">
              {earningShare && Number(earningShare) > 0
                ? `${Math.round(Number(earningShare) * 100)}% do valor do trabalho para o profissional.`
                : "Fracção do valor que fica para o profissional (ex: 0.65 = 65%)."}
            </p>
            <button
              onClick={() => patch({ earning_share: Number(earningShare) }, "Quota actualizada.")}
              disabled={busy || !earningShare || Number(earningShare) <= 0 || Number(earningShare) > 1}
              className="mt-2 w-full rounded-lg bg-[#00BDEB] py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >Guardar quota</button>
          </div>

          <div className={CARD}>
            <p className={CARD_TITLE}>Resumo</p>
            <div className="space-y-1.5 text-[11px]">
              <p className="text-slate-400">Trabalhos: <span className="text-white">{d.stats.bookings_active}</span> activos de {d.stats.bookings_total}</p>
              <p className="text-slate-400">Tipo: <span className="text-white">{String(p.kind ?? "—")}</span></p>
              <p className="text-slate-400">Escalão: <span className="text-white">{String(p.tier ?? "—")}</span></p>
              <p className="text-slate-400">Confiança: <span className="text-white">{p.trust_score != null ? String(p.trust_score) : "—"}</span></p>
              {Array.isArray(p.regions) && p.regions.length > 0 && (
                <p className="text-slate-400">Zonas: <span className="text-white">{(p.regions as string[]).join(", ")}</span></p>
              )}
              {typeof p.base_address === "string" && p.base_address && (
                <p className="text-slate-400">Base: <span className="text-white">{p.base_address}</span>
                  {p.base_radius_km != null && <span className="text-slate-500"> · raio {String(p.base_radius_km)} km</span>}
                </p>
              )}
              <p className="text-slate-400">Veículo: <span className="text-white">{p.has_vehicle ? "sim" : "não"}</span>
                {p.vehicle_capacity_m3 != null && <span className="text-slate-500"> · {String(p.vehicle_capacity_m3)} m³</span>}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabProfissionais({ authHeader }: { authHeader: Record<string, string> }) {
  const [profiles, setProfiles] = useState<PartnerProfile[]>([]);
  const [stats, setStats] = useState<PartnerStats>({ total: 0, approved: 0, pending: 0, docs_pending: 0, sem_descricao: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter !== "todos") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/app-clyon/profissionais?${params}`, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setProfiles(json.profiles ?? []);
      setStats(json.stats ?? { total: 0, approved: 0, pending: 0, docs_pending: 0, sem_descricao: 0 });
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return (
      <ProfissionalPanel
        id={selected}
        authHeader={authHeader}
        onBack={() => setSelected(null)}
        onChanged={load}
      />
    );
  }

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  const FILTROS: Array<{ k: string; label: string }> = [
    { k: "todos", label: "Todos" },
    { k: "pending", label: "Candidaturas" },
    { k: "in_review", label: "Em análise" },
    { k: "approved", label: "Aprovados" },
    { k: "suspended", label: "Suspensos" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Aprovados</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{stats.approved}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">A aguardar decisão</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">{stats.pending}</p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sem apresentação</p>
          <p className="mt-1 text-2xl font-bold text-violet-300">{stats.sem_descricao}</p>
          <p className="mt-0.5 text-[9px] leading-tight text-slate-600">o cliente vê texto genérico</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button key={f.k} onClick={() => setStatusFilter(f.k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === f.k ? "bg-[#00BDEB] text-slate-950" : "border border-white/[0.08] bg-[#12263B] text-slate-300 hover:border-[#00BDEB]/40"
            }`}>{f.label}</button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); }} className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome comercial, nome, e-mail ou telefone…"
          className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-400" />
        <button type="submit" className="rounded-xl bg-cyan-500/20 px-4 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/30">Pesquisar</button>
        {q && <button type="button" onClick={() => { setSearch(""); setQ(""); }} className="text-xs text-slate-500 hover:text-slate-300">Limpar</button>}
      </form>

      {profiles.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600">Sem profissionais para este filtro.</p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
          {profiles.map((p, i) => {
            const cfg = PARTNER_STATUS_CFG[String(p.status ?? "")];
            return (
              <button key={p.id} onClick={() => setSelected(p.id)}
                className={`w-full px-4 py-3 text-left transition hover:bg-white/[0.03] ${i < profiles.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-300">
                    {(p.trade_name ?? p.full_name ?? p.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">{p.trade_name ?? p.full_name ?? "—"}</p>
                      {p.verified && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold text-sky-300">✓ Verificado</span>}
                      {cfg && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${cfg.cls}`}>{cfg.label}</span>}
                      {p.description_needs_attention && (
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-300">sem apresentação</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {p.full_name && p.trade_name ? `${p.full_name} · ` : ""}{p.email ?? "—"}{p.phone ? ` · ${p.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-right">
                    {p.rating_count > 0 && (
                      <span className="text-xs text-amber-300">★ {p.rating_avg} <span className="text-slate-600">({p.rating_count})</span></span>
                    )}
                    {p.docs_pending > 0 && (
                      <span className="text-[10px] text-amber-400">{p.docs_pending} doc{p.docs_pending > 1 ? "s" : ""} pendente{p.docs_pending > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
                {p.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1 pl-13">
                    {p.services.slice(0, 6).map((s) => (
                      <span key={s} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-400">{s}</span>
                    ))}
                    {p.services.length > 6 && <span className="text-[10px] text-slate-600">+{p.services.length - 6}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-600">A mostrar {profiles.length} profissiona{profiles.length === 1 ? "l" : "is"}.</p>
    </div>
  );
}

// ── Equipa interna (colaboradores) ─────────────────────────────────────────
type Assistente = { id: number; nome: string; funcao: string; isAdmin: number };

function TabEquipa({ authHeader }: { authHeader: Record<string, string> }) {
  const [list, setList] = useState<Assistente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/assistentes", { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setList(json.assistentes ?? []);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
      {list.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-600">Sem colaboradores encontrados.</p>
      ) : list.map((a, i) => (
        <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${i < list.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-400">
            {a.nome.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{a.nome}</p>
            <p className="text-xs text-slate-500">{a.funcao}</p>
          </div>
          {a.isAdmin === 1 && (
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">Admin</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Catálogo ───────────────────────────────────────────────────────────────
type Category = {
  slug: string; name: string; icon: string | null;
  description: string | null; is_active: boolean;
  sort_order: number | null; request_count: number;
};

function TabCatalogo({ authHeader }: { authHeader: Record<string, string> }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/app-clyon/catalogo", { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setCats(json.categories ?? []);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  async function toggle(cat: Category) {
    setToggling(cat.slug);
    try {
      const res = await fetch(`/api/admin/app-clyon/catalogo/${cat.slug}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ active: !cat.is_active }),
      });
      if (res.ok) setCats((p) => p.map((c) => c.slug === cat.slug ? { ...c, is_active: !c.is_active } : c));
      else { const j = await res.json(); setError(j.error ?? "Erro."); }
    } catch { setError("Erro de ligação."); }
    finally { setToggling(null); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  const totalCats = cats.length;
  const activeCats = cats.filter((c) => c.is_active).length;
  const archivedCats = totalCats - activeCats;
  const totalPedidos = cats.reduce((s, c) => s + (c.request_count ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Cabeçalho com estatísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Categorias</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">{totalCats}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Activas</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{activeCats}</p>
        </div>
        <div className="rounded-2xl border border-slate-500/20 bg-slate-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Arquivadas</p>
          <p className="mt-1 text-2xl font-bold text-slate-300">{archivedCats}</p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pedidos totais</p>
          <p className="mt-1 text-2xl font-bold text-violet-300">{totalPedidos}</p>
        </div>
      </div>

      {cats.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600">
          Sem categorias em <code className="rounded bg-white/[0.05] px-1 py-0.5">service_categories</code>.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          {cats.map((cat, i) => (
            <div
              key={cat.slug}
              className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-4 transition ${
                i < cats.length - 1 ? "border-b border-white/[0.04]" : ""
              } ${!cat.is_active ? "opacity-60" : "hover:bg-white/[0.02]"}`}
            >
              {/* Ícone */}
              <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
                cat.is_active ? "bg-cyan-500/[0.08] text-cyan-300" : "bg-white/[0.04] text-slate-500"
              }`}>
                <CategoryIcon name={cat.icon} className="h-5 w-5" />
              </div>

              {/* Nome + slug + descrição opcional */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white truncate">{cat.name}</p>
                  {!cat.is_active && (
                    <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Arquivada
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-slate-600">{cat.slug}</p>
                {cat.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">{cat.description}</p>
                )}
              </div>

              {/* Contagem de pedidos */}
              <div className="text-right">
                <p className={`text-lg font-bold ${cat.request_count > 0 ? "text-white" : "text-slate-600"}`}>
                  {cat.request_count}
                </p>
                <p className="text-[10px] text-slate-500">
                  {cat.request_count === 1 ? "pedido" : "pedidos"}
                </p>
              </div>

              {/* Botão Arquivar / Activar — largura fixa */}
              <button
                onClick={() => toggle(cat)}
                disabled={toggling === cat.slug}
                className={`flex w-24 flex-shrink-0 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                  cat.is_active
                    ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                    : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                }`}
              >
                {toggling === cat.slug ? "…" : cat.is_active ? "Arquivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-3 py-2 text-xs text-amber-300/70">
        Arquivar uma categoria não elimina o histórico — apenas impede novos pedidos dessa categoria.
      </p>
    </div>
  );
}

// ── Cupons ─────────────────────────────────────────────────────────────────
type Cupon = {
  id: string; code: string; discount_type: "percent" | "fixed"; discount_value: number;
  currency_code: string; starts_at: string | null; ends_at: string | null;
  usage_limit: number | null; usage_count: number;
  minimum_order_amount: number | null; per_account_limit: number | null;
  active: boolean; created_at: string;
};

type CuponForm = {
  code: string; discount_type: "percent" | "fixed"; discount_value: string;
  ends_at: string; usage_limit: string; per_account_limit: string; minimum_order_amount: string;
};

const EMPTY_FORM: CuponForm = { code: "", discount_type: "percent", discount_value: "", ends_at: "", usage_limit: "", per_account_limit: "", minimum_order_amount: "" };

function TabCupons({ authHeader }: { authHeader: Record<string, string> }) {
  const [cupons, setCupons] = useState<Cupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CuponForm>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/app-clyon/cupons", { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setCupons(json.cupons ?? []);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  function openEdit(c: Cupon) {
    setEditingId(c.id);
    setShowCreate(false);
    setForm({
      code: c.code, discount_type: c.discount_type, discount_value: String(c.discount_value),
      ends_at: c.ends_at ? c.ends_at.slice(0, 10) : "", usage_limit: c.usage_limit != null ? String(c.usage_limit) : "",
      per_account_limit: c.per_account_limit != null ? String(c.per_account_limit) : "",
      minimum_order_amount: c.minimum_order_amount != null ? String(c.minimum_order_amount) : "",
    });
    setSaveError(null);
  }

  function openCreate() {
    setEditingId(null);
    setShowCreate(true);
    setForm(EMPTY_FORM);
    setSaveError(null);
  }

  function closePanel() {
    setEditingId(null);
    setShowCreate(false);
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
      };
      if (form.ends_at) payload.ends_at = form.ends_at;
      if (form.usage_limit) payload.usage_limit = Number(form.usage_limit);
      if (form.per_account_limit) payload.per_account_limit = Number(form.per_account_limit);
      if (form.minimum_order_amount) payload.minimum_order_amount = Number(form.minimum_order_amount);

      const url = editingId ? `/api/admin/app-clyon/cupons/${editingId}` : "/api/admin/app-clyon/cupons";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Erro ao guardar."); return; }
      closePanel();
      await load();
    } catch { setSaveError("Erro de ligação."); }
    finally { setSaving(false); }
  }

  async function toggleActive(c: Cupon) {
    try {
      await fetch(`/api/admin/app-clyon/cupons/${c.id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      setCupons((prev) => prev.map((x) => x.id === c.id ? { ...x, active: !x.active } : x));
    } catch { /* will show on next load */ }
  }

  const panelOpen = showCreate || editingId !== null;
  const activeCupons = cupons.filter((c) => c.active);
  const totalUsage = cupons.reduce((s, c) => s + c.usage_count, 0);
  const totalDiscount = cupons.reduce((s, c) => {
    if (c.discount_type === "fixed") return s + c.discount_value * c.usage_count;
    return s;
  }, 0);

  const INP = "h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-400";
  const LBL = "text-[10px] uppercase tracking-wider text-slate-500 block mb-1";

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Activos</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">{activeCupons.length}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">{cupons.length} total criados</p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Utilizações</p>
          <p className="mt-1 text-2xl font-bold text-violet-300">{totalUsage}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">total acumulado</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Desconto aplicado</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{totalDiscount > 0 ? `${totalDiscount.toFixed(0)} €` : "—"}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">valor fixo acumulado</p>
        </div>
      </div>

      {/* Header com botão novo */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">{cupons.length} cupões</p>
        <button onClick={openCreate} className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition">
          + Novo cupão
        </button>
      </div>

      <div className={`grid gap-5 ${panelOpen ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        {/* Tabela */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          {cupons.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-600">Sem cupões criados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-3 py-3 text-left">Desconto</th>
                    <th className="px-3 py-3 text-left">Validade</th>
                    <th className="px-3 py-3 text-left">Utilizações</th>
                    <th className="px-3 py-3 text-center">Lim/conta</th>
                    <th className="px-3 py-3 text-center">Estado</th>
                    <th className="px-3 py-3 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {cupons.map((c) => {
                    const usagePct = c.usage_limit ? Math.min(100, (c.usage_count / c.usage_limit) * 100) : 0;
                    const isExpired = c.ends_at ? new Date(c.ends_at) < new Date() : false;
                    return (
                      <tr key={c.id} className={`border-b border-white/[0.03] transition hover:bg-white/[0.02] ${!c.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-bold text-white">{c.code}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-200">
                            {c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value} €`}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {c.ends_at ? (
                            <span className={`text-xs ${isExpired ? "text-red-400" : "text-slate-400"}`}>
                              {new Date(c.ends_at).toLocaleDateString("pt-PT")}
                              {isExpired && <span className="ml-1 text-[9px]">(expirado)</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">Sem limite</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">{c.usage_count}{c.usage_limit ? `/${c.usage_limit}` : ""}</span>
                            {c.usage_limit && (
                              <div className="w-16 rounded-full bg-white/[0.06]" style={{ height: 4 }}>
                                <div className={`h-full rounded-full transition-all ${usagePct >= 90 ? "bg-red-400" : usagePct >= 60 ? "bg-amber-400" : "bg-cyan-400"}`} style={{ width: `${usagePct}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs text-slate-400">{c.per_account_limit ?? "∞"}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            c.active
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-slate-500/15 text-slate-400"
                          }`}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.active ? "bg-emerald-400" : "bg-slate-500"}`} />
                            {c.active ? "Activo" : "Pausado"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-400 transition" title="Editar">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => toggleActive(c)} className={`rounded-lg p-1.5 transition ${c.active ? "text-slate-500 hover:bg-red-500/10 hover:text-red-400" : "text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-400"}`} title={c.active ? "Pausar" : "Activar"}>
                              {c.active ? (
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Painel lateral de edição/criação */}
        {panelOpen && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-white">{editingId ? "Editar cupão" : "Novo cupão"}</p>
              <button onClick={closePanel} className="rounded-lg p-1 text-slate-500 hover:text-white transition">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className={LBL}>Código</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="EX: PROMO20" required className={INP} disabled={!!editingId} />
              </div>
              <div>
                <label className={LBL}>Tipo de desconto</label>
                <select value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as "percent" | "fixed" }))} className={INP}>
                  <option value="percent" className="bg-[#0C1C2E]">Percentagem (%)</option>
                  <option value="fixed" className="bg-[#0C1C2E]">Valor fixo (€)</option>
                </select>
              </div>
              <div>
                <label className={LBL}>Valor</label>
                <input type="number" step="0.01" min="0.01" value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} required placeholder={form.discount_type === "percent" ? "20" : "5.00"} className={INP} />
              </div>
              <div>
                <label className={LBL}>Validade</label>
                <input type="date" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} className={INP} />
              </div>
              <div>
                <label className={LBL}>Limite de usos (global)</label>
                <input type="number" min="1" value={form.usage_limit} onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))} placeholder="Ilimitado" className={INP} />
              </div>
              <div>
                <label className={LBL}>Limite por conta</label>
                <input type="number" min="1" value={form.per_account_limit} onChange={(e) => setForm((f) => ({ ...f, per_account_limit: e.target.value }))} placeholder="Ilimitado" className={INP} />
              </div>
              <div>
                <label className={LBL}>Valor mínimo de pedido (€)</label>
                <input type="number" step="0.01" min="0" value={form.minimum_order_amount} onChange={(e) => setForm((f) => ({ ...f, minimum_order_amount: e.target.value }))} placeholder="0.00" className={INP} />
              </div>
              {saveError && <p className="text-xs text-red-300">{saveError}</p>}
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition">
                {saving ? "A guardar..." : editingId ? "Guardar alterações" : "Criar cupão"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Moedas e preços ────────────────────────────────────────────────────────

// Regras de custo em créditos por trabalho aceite (credit_fee_rules do Bridge).
// O painel edita DADOS; calculate_job_credit_cost é a única fonte do custo.
type CreditFeeRule = {
  id: string;
  min_job_amount_cents: number;
  max_job_amount_cents: number | null;
  fee_credits: number;
  active: boolean;
  updated_at?: string;
};

function CreditFeeRulesSection({ authHeader }: { authHeader: Record<string, string> }) {
  const [rules, setRules] = useState<CreditFeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editFee, setEditFee] = useState<Record<string, string>>({});
  const [showNew, setShowNew] = useState(false);
  const [newMin, setNewMin] = useState("");
  const [newMax, setNewMax] = useState("");
  const [newFee, setNewFee] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/app-clyon/credit-fee-rules", { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao carregar regras."); return; }
      setRules(json.rules ?? []);
      setEditFee({});
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  const post = async (payload: Record<string, unknown>, okMsg: string) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const res = await fetch("/api/admin/app-clyon/credit-fee-rules", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao guardar."); return; }
      setSuccess(okMsg);
      await load();
    } catch { setError("Erro de ligação."); }
    finally { setBusy(false); }
  };

  const eur = (cents: number | null) =>
    cents == null ? "sem limite" : `${(cents / 100).toLocaleString("pt-PT", { minimumFractionDigits: 0 })} €`;

  return (
    <div className="rounded-2xl border border-[#00BDEB]/20 bg-[#00BDEB]/[0.03] p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#00BDEB]">Custo por trabalho aceite (créditos)</p>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="rounded-lg border border-white/[0.08] bg-[#12263B] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#00BDEB]/40"
        >
          {showNew ? "Cancelar" : "+ Nova banda"}
        </button>
      </div>
      <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
        Créditos descontados ao profissional quando aceita um trabalho, por banda de valor do serviço.
        O custo é calculado pela função <code className="rounded bg-white/[0.04] px-1 py-0.5 text-slate-400">calculate_job_credit_cost</code> na
        base de dados — este ecrã edita apenas as bandas. Bandas activas não se podem sobrepor.
      </p>

      {error && <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{success}</div>}

      {showNew && (
        <div className="mb-4 grid gap-3 rounded-xl border border-white/[0.07] bg-[#0C1C2E] p-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#97AABD]">Valor mín. (€)</label>
            <input type="number" min="0" step="1" value={newMin} onChange={(e) => setNewMin(e.target.value)} placeholder="0"
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 text-sm text-white outline-none focus:border-[#00BDEB]" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#97AABD]">Valor máx. (€) — vazio = sem limite</label>
            <input type="number" min="0" step="1" value={newMax} onChange={(e) => setNewMax(e.target.value)} placeholder="sem limite"
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 text-sm text-white outline-none focus:border-[#00BDEB]" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#97AABD]">Créditos</label>
            <input type="number" min="1" step="1" value={newFee} onChange={(e) => setNewFee(e.target.value)} placeholder="7"
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 text-sm text-white outline-none focus:border-[#00BDEB]" />
          </div>
          <div className="flex items-end">
            <button
              disabled={busy || !newFee}
              onClick={() => post({
                action: "create",
                min_job_amount_cents: Math.round(Number(newMin || 0) * 100),
                max_job_amount_cents: newMax === "" ? null : Math.round(Number(newMax) * 100),
                fee_credits: Number(newFee),
                active: true,
              }, "Banda criada.").then(() => { setShowNew(false); setNewMin(""); setNewMax(""); setNewFee(""); })}
              className="h-9 w-full rounded-lg bg-[#00BDEB] px-3 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? "A criar..." : "Criar banda"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">A carregar…</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-amber-300">Nenhuma regra encontrada — sem regras activas, os trabalhos não são cobrados.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {rules.map((r, i) => (
            <div key={r.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${r.active ? "bg-[#12263B]/60" : "bg-[#0C1C2E]/40 opacity-60"} ${i < rules.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
              <span className={`inline-flex h-2 w-2 flex-shrink-0 rounded-full ${r.active ? "bg-emerald-400" : "bg-slate-600"}`} />
              <span className="min-w-[150px] text-sm text-white">
                {eur(r.min_job_amount_cents)} → {eur(r.max_job_amount_cents)}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min="1" step="1"
                  value={editFee[r.id] ?? String(r.fee_credits)}
                  onChange={(e) => setEditFee((m) => ({ ...m, [r.id]: e.target.value }))}
                  className="h-8 w-20 rounded-lg border border-white/[0.08] bg-[#12263B] px-2 text-center text-sm font-bold text-[#00BDEB] outline-none focus:border-[#00BDEB]"
                />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">créditos</span>
              </div>
              {(editFee[r.id] !== undefined && editFee[r.id] !== String(r.fee_credits)) && (
                <button
                  disabled={busy}
                  onClick={() => post({ action: "update", id: r.id, fee_credits: Number(editFee[r.id]) }, "Custo actualizado.")}
                  className="rounded-lg bg-[#00BDEB] px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                >
                  Guardar
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => post({ action: "update", id: r.id, active: !r.active }, r.active ? "Regra desactivada." : "Regra activada.")}
                className={`ml-auto rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${r.active ? "border-red-500/25 text-red-300 hover:bg-red-500/10" : "border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10"} disabled:opacity-50`}
              >
                {r.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabMoedas({ authHeader }: { authHeader: Record<string, string> }) {
  return (
    <div className="space-y-5">
      {/* Custo em créditos por trabalho aceite */}
      <CreditFeeRulesSection authHeader={authHeader} />

      {/* Moeda principal */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-lg font-bold text-emerald-300">€</div>
          <div>
            <p className="text-sm font-bold text-white">EUR — Euro</p>
            <p className="text-xs text-slate-400">Moeda principal activa</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold text-emerald-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Activa
          </span>
        </div>
      </div>

      {/* Detalhes da moeda */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Código ISO",     value: "EUR",          sub: "International Standard" },
          { label: "Símbolo",        value: "€",            sub: "Sufixo no preço" },
          { label: "Casas decimais", value: "2",            sub: "Cêntimos" },
          { label: "Formato",        value: "1 234,56 €",   sub: "Separador vírgula" },
        ].map((r) => (
          <div key={r.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{r.label}</p>
            <p className="mt-1.5 text-lg font-bold text-white">{r.value}</p>
            <p className="mt-0.5 text-[10px] text-slate-600">{r.sub}</p>
          </div>
        ))}
      </div>

      {/* Regras de preço */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Regras de preço</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Arredondamento</p>
            <p className="text-sm font-semibold text-white">0,01 € (cêntimo)</p>
            <p className="text-[10px] text-slate-600">Arredondamento ao cêntimo mais próximo</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">IVA incluído</p>
            <p className="text-sm font-semibold text-white">Sim — 23%</p>
            <p className="text-[10px] text-slate-600">Todos os preços incluem IVA a 23%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Preço mínimo</p>
            <p className="text-sm font-semibold text-white">Não definido</p>
            <p className="text-[10px] text-slate-600">Sem valor mínimo de pedido</p>
          </div>
        </div>
      </div>

      {/* Multi-moeda */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-sm text-violet-400">⊕</div>
          <div>
            <p className="text-sm font-semibold text-white">Multi-moeda</p>
            <p className="text-xs text-slate-500">A tabela <code className="rounded bg-white/[0.04] px-1 py-0.5 text-slate-400">cupons.currency_code</code> já aceita qualquer código ISO. A activação de uma segunda moeda requer configuração adicional no backend de pagamentos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pagamentos (clientes app) ─────────────────────────────────────────────
type PagamentosData = {
  stats: {
    total_paid: number; total_manual: number; total_earnings: number; total_platform_fee?: number;
    count_paid: number; count_manual: number; count_earnings: number;
  };
  payments: Array<{ id: string; request_id?: string; customer_id?: string; partner_id?: string;
    amount: number; net_service_total?: number; platform_fee?: number;
    status?: string; method?: string; provider?: string; failure_reason?: string; created_at: string }>;
  manual: Array<{ id: string; request_id?: string; booking_id?: string; amount: number;
    method?: string; status?: string; internal_note?: string; paid_at?: string; created_at: string }>;
  earnings: Array<{ id: string; partner_id?: string; request_id?: string; payment_id?: string;
    partner_amount: number; gross_amount?: number; status?: string; paid_at?: string; created_at: string }>;
  days: number;
};

function fmtMoney(v: number, cur = "EUR") {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur }).format(v);
}

// ── Conciliação de pagamentos ─────────────────────────────────────────────
// Um pedido não avança quando o cliente carrega em "Pagar reserva" — fica em
// "Aguarda depósito" até o dinheiro chegar. Com a euPago (27-07-2026) o MB WAY
// e o Multibanco fecham-se sozinhos por webhook; sobra a transferência
// bancária, que ninguém vê senão no extracto. É essa que se destrava aqui.
type PaymentRef = {
  reference: string | null;
  method: string;
  method_label: string;
  valor_esperado: number | null;
  valor_recebido: number | null;
  diferenca: number | null;
  conciliada: boolean;
  emitida_em: string | null;
  paid_at: string | null;
  cliente: string | null;
  account_code: string | null;
  phone: string | null;
  request_id: string | null;
  estado_do_pedido: string | null;
  category_slug: string | null;
  confirmado_por: string | null;
  provider: string | null;
  entidade: string | null;
  referencia_mb: string | null;
  comissao: number | null;
  expires_at: string | null;
  automatico: boolean;
};

function ReconciliacaoReferencias({ authHeader }: { authHeader: Record<string, string> }) {
  const [refs, setRefs] = useState<PaymentRef[]>([]);
  const [stats, setStats] = useState({ total: 0, conciliadas: 0, por_conciliar: 0, a_aguardar_operador: 0, valor_por_conciliar: 0, com_divergencia: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const [soPendentes, setSoPendentes] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [nota, setNota] = useState("");
  const [aConfirmar, setAConfirmar] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setNotice(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (soPendentes) params.set("pendentes", "1");
      const res = await fetch(`/api/admin/app-clyon/referencias?${params}`, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setNotice(json.error ?? "Erro ao carregar."); return; }
      if (json.unavailable) { setNotice(json.notice ?? null); setRefs([]); return; }
      setRefs(json.references ?? []);
      setStats(json.stats ?? { total: 0, conciliadas: 0, por_conciliar: 0, a_aguardar_operador: 0, valor_por_conciliar: 0, com_divergencia: 0 });
    } catch { setNotice("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, q, soPendentes]);

  useEffect(() => { load(); }, [load]);

  async function confirmar(r: PaymentRef) {
    if (!r.reference) return;
    setAConfirmar(true); setErro(null); setSucesso(null);
    try {
      const res = await fetch("/api/admin/app-clyon/referencias", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: r.reference,
          valor_recebido: valorRecebido === "" ? null : Number(valorRecebido),
          nota: nota.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setErro(json.error ?? "Não foi possível confirmar."); return; }
      setSucesso(json.message ?? "Pagamento confirmado.");
      setAberta(null); setValorRecebido(""); setNota("");
      await load();
    } catch { setErro("Erro de ligação."); }
    finally { setAConfirmar(false); }
  }

  return (
    <div className="rounded-2xl border border-[#00BDEB]/25 bg-[#00BDEB]/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00BDEB]">Conciliação de pagamentos</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            Cola a referência do extracto para encontrar o pedido. <span className="text-white">Confirmar
            o pagamento é o que publica o trabalho aos profissionais</span> — sem isso fica parado
            em Aguarda depósito. MB WAY e Multibanco fecham-se sozinhos pela euPago.
          </p>
        </div>
        {stats.por_conciliar > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-right">
            <p className="text-lg font-bold text-amber-300">{fmtMoney(stats.valor_por_conciliar)}</p>
            <p className="text-[10px] text-amber-200/70">
              {stats.por_conciliar} por conciliar
              {stats.a_aguardar_operador > 0 && stats.a_aguardar_operador !== stats.por_conciliar
                ? ` · ${stats.a_aguardar_operador} contigo`
                : ""}
            </p>
          </div>
        )}
      </div>

      {notice && (
        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-[11px] leading-relaxed text-amber-300">{notice}</p>
      )}
      {erro && (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] leading-relaxed text-red-300">{erro}</p>
      )}
      {sucesso && (
        <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">{sucesso}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setQ(busca.trim()); }} className="flex min-w-0 flex-1 gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value.toUpperCase())}
            placeholder="Referência do extracto — ex: AAAAM01"
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 font-mono text-sm uppercase tracking-wider text-white outline-none focus:border-cyan-400" />
          <button type="submit" className="rounded-xl bg-cyan-500/20 px-4 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30">Procurar</button>
          {q && <button type="button" onClick={() => { setBusca(""); setQ(""); }} className="text-xs text-slate-500 hover:text-slate-300">Limpar</button>}
        </form>
        <button onClick={() => setSoPendentes((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            soPendentes ? "bg-[#00BDEB] text-slate-950" : "border border-white/[0.08] bg-[#12263B] text-slate-300 hover:border-[#00BDEB]/40"
          }`}>
          {soPendentes ? "Só por conciliar" : "Todas"}
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-slate-500">A carregar…</p>
      ) : refs.length === 0 ? (
        <p className="mt-4 text-xs text-slate-600">
          {q ? "Nenhuma referência encontrada." : soPendentes ? "Nada por conciliar." : "Ainda não há referências emitidas."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {refs.map((r) => {
            const estaAberta = aberta === r.reference;
            const divergente = r.diferenca != null && Math.abs(r.diferenca) > 0.01;
            return (
              <div key={String(r.reference)} className={`rounded-xl border p-3 ${
                r.conciliada ? "border-white/[0.06] bg-[#12263B]/40"
                  : r.automatico ? "border-white/[0.08] bg-[#12263B]/40"
                  : "border-amber-500/20 bg-amber-500/[0.04]"
              }`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-base font-bold tracking-wider text-white">{r.reference ?? "—"}</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-300">{r.method_label}</span>
                  {r.conciliada ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      Recebido{r.paid_at ? ` · ${new Date(r.paid_at).toLocaleDateString("pt-PT")}` : ""}
                    </span>
                  ) : r.automatico ? (
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                      A aguardar euPago
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">Por conciliar</span>
                  )}
                  <span className="ml-auto text-right">
                    <span className="text-sm font-bold text-white">{r.valor_esperado != null ? fmtMoney(r.valor_esperado) : "—"}</span>
                    {divergente && (
                      <span className="block text-[10px] text-red-300">
                        recebido {fmtMoney(r.valor_recebido ?? 0)} ({r.diferenca! > 0 ? "+" : ""}{fmtMoney(r.diferenca!)})
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="text-slate-300">{r.cliente ?? "—"}</span>
                  {r.account_code && <span className="font-mono text-[10px] text-[#00BDEB]">{r.account_code}</span>}
                  {r.phone && <span>{r.phone}</span>}
                  {r.request_id && <span className="font-mono text-[10px]">#{String(r.request_id).slice(0, 8)}</span>}
                  {r.estado_do_pedido && (
                    <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px]">
                      {STATUS_LABELS[r.estado_do_pedido] ?? r.estado_do_pedido}
                    </span>
                  )}
                  {/* Referência Multibanco: é o que o cliente digita no ATM */}
                  {r.entidade && r.referencia_mb && (
                    <span className="font-mono text-[10px] text-slate-400">
                      MB {r.entidade} · {r.referencia_mb}
                    </span>
                  )}
                  {r.confirmado_por && <span>por {r.confirmado_por}</span>}
                  {r.comissao != null && r.comissao > 0 && <span>comissão {fmtMoney(r.comissao)}</span>}
                </div>

                {!r.conciliada && r.automatico && (
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                    Confirma-se sozinha quando a euPago avisar
                    {r.expires_at ? ` — a referência expira a ${new Date(r.expires_at).toLocaleDateString("pt-PT")}` : ""}.
                    Só confirmes à mão se o dinheiro entrou e o webhook falhou.
                  </p>
                )}

                {!r.conciliada && !r.automatico && (
                  estaAberta ? (
                    <div className="mt-3 rounded-lg border border-white/[0.07] bg-[#0C1C2E] p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#97AABD]">Valor recebido (€)</label>
                          <input type="number" step="0.01" min="0" value={valorRecebido}
                            onChange={(e) => setValorRecebido(e.target.value)}
                            placeholder={r.valor_esperado != null ? String(r.valor_esperado) : ""}
                            className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 text-sm text-white outline-none focus:border-[#00BDEB]" />
                          <p className="mt-0.5 text-[9px] text-slate-600">Vazio usa o esperado. Se receberes menos, escreve o real — fica registado.</p>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#97AABD]">Nota (opcional)</label>
                          <input value={nota} onChange={(e) => setNota(e.target.value)}
                            placeholder="Ex: recebido no Revolut"
                            className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#12263B] px-3 text-sm text-white outline-none focus:border-[#00BDEB]" />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => confirmar(r)} disabled={aConfirmar}
                          className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                          {aConfirmar ? "A confirmar..." : "Confirmar recebimento e publicar"}
                        </button>
                        <button onClick={() => { setAberta(null); setValorRecebido(""); setNota(""); }}
                          disabled={aConfirmar}
                          className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAberta(r.reference); setValorRecebido(""); setNota(""); setErro(null); setSucesso(null); }}
                      className="mt-2 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10">
                      Confirmar recebimento
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
        Confirmar é idempotente — carregar duas vezes não duplica nem republica.
        Recebimento: MB WAY/Revolut <span className="text-slate-400">931632622</span> ·
        IBAN <span className="text-slate-400">LT72 3250 0157 4466 0473</span>
      </p>
    </div>
  );
}

function TabPagamentos({ authHeader }: { authHeader: Record<string, string> }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<PagamentosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"payments" | "manual" | "earnings">("payments");
  const [showLegacy, setShowLegacy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/app-clyon/pagamentos?days=${days}`, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) {
        const detailStr = json.details && typeof json.details === "object"
          ? Object.entries(json.details).map(([k, v]) => `${k}: ${v}`).join(" · ")
          : "";
        setError(`${json.error ?? "Erro."}${detailStr ? ` — ${detailStr}` : ""}`);
        return;
      }
      setData(json);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, days]);

  useEffect(() => { load(); }, [load]);

  if (showLegacy) {
    return (
      <div className="space-y-3">
        <button onClick={() => setShowLegacy(false)} className="text-xs text-cyan-400 hover:underline">← Voltar aos pagamentos do app</button>
        <PagamentosPanel authHeader={authHeader} />
      </div>
    );
  }

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;
  if (!data) return null;

  const rows =
    tab === "payments" ? data.payments :
    tab === "manual"   ? data.manual :
                         data.earnings;

  return (
    <div className="space-y-5">
      {/* Reconciliação primeiro: é o trabalho diário, os relatórios vêm depois */}
      <ReconciliacaoReferencias authHeader={authHeader} />

      <div className="flex items-center gap-1.5 flex-wrap">
        {[7, 30, 90, 180].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              days === d ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {d} dias
          </button>
        ))}
        <button
          onClick={() => setShowLegacy(true)}
          className="ml-auto rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition"
          title="Ver pagamentos internos a assistentes"
        >
          Pagamentos internos (legado)
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recebido de clientes</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{fmtMoney(data.stats.total_paid)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">{data.stats.count_paid} pagamentos</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pagamentos manuais</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">{fmtMoney(data.stats.total_manual)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">{data.stats.count_manual} registos</p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">A pagar a profissionais</p>
          <p className="mt-1 text-2xl font-bold text-violet-300">{fmtMoney(data.stats.total_earnings)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">{data.stats.count_earnings} earnings</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.05]">
        {[
          { k: "payments" as const, label: "Recebidos", count: data.payments.length },
          { k: "manual" as const, label: "Manuais",    count: data.manual.length },
          { k: "earnings" as const, label: "Earnings",  count: data.earnings.length },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition ${
              tab === t.k ? "border-[#00BDEB] text-[#00BDEB]" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label} <span className="ml-1 rounded-full bg-white/[0.06] px-1.5 text-[10px]">{t.count}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600">
          Sem registos em <code>{tab === "payments" ? "payments" : tab === "manual" ? "manual_payments" : "professional_earnings"}</code> nos últimos {days} dias.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
          {rows.map((r: any, i) => {
            // amount efectivo consoante o tipo de linha
            const displayAmount =
              tab === "earnings"
                ? Number(r.partner_amount ?? 0)
                : Number(r.net_service_total ?? r.amount ?? 0);
            const displayNote =
              tab === "manual"   ? r.internal_note :
              tab === "payments" ? r.failure_reason :
                                    null;
            return (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i < rows.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                <span className="font-mono text-[10px] text-slate-600 w-16 truncate">{String(r.id).slice(0, 8)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{fmtMoney(displayAmount)}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {r.request_id ? `Pedido ${String(r.request_id).slice(0, 8)}` : ""}
                    {r.partner_id ? ` · Partner ${String(r.partner_id).slice(0, 8)}` : ""}
                    {r.customer_id ? ` · Cliente ${String(r.customer_id).slice(0, 8)}` : ""}
                    {r.method ? ` · ${r.method}` : ""}
                    {r.provider ? ` · ${r.provider}` : ""}
                    {displayNote ? ` · ${displayNote}` : ""}
                  </p>
                </div>
                {r.status && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    ["paid", "captured", "succeeded", "completed"].includes(String(r.status))
                      ? "bg-emerald-500/15 text-emerald-300" :
                    ["pending", "authorized", "available"].includes(String(r.status))
                      ? "bg-amber-500/15 text-amber-300" :
                    ["failed", "refunded", "canceled"].includes(String(r.status))
                      ? "bg-red-500/15 text-red-300" :
                    "bg-slate-500/15 text-slate-400"
                  }`}>{r.status}</span>
                )}
                <span className="text-[10px] text-slate-600 flex-shrink-0">
                  {new Date(r.created_at).toLocaleDateString("pt-PT")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Contas (clientes app) ─────────────────────────────────────────────────
type ClientAccount = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  // Codigo publico e permanente da conta — entra nas referencias de pagamento
  account_code?: string | null;
  created_at: string; orders_count: number; last_order_at: string | null; active_30d: boolean;
};
type AccountsStats = { total: number; active_30d: number; no_orders: number };

function TabContas({ authHeader }: { authHeader: Record<string, string> }) {
  const [accounts, setAccounts] = useState<ClientAccount[]>([]);
  const [stats, setStats] = useState<AccountsStats>({ total: 0, active_30d: 0, no_orders: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = q ? `/api/admin/app-clyon/contas?q=${encodeURIComponent(q)}` : "/api/admin/app-clyon/contas";
      const res = await fetch(url, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setAccounts(json.accounts ?? []);
      setStats(json.stats ?? { total: 0, active_30d: 0, no_orders: 0 });
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, q]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setQ(search.trim()); }

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total clientes</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Activos (30 dias)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{stats.active_30d}</p>
        </div>
        <div className="rounded-2xl border border-slate-500/20 bg-slate-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sem pedidos</p>
          <p className="mt-1 text-2xl font-bold text-slate-300">{stats.no_orders}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, e-mail, telefone ou código de conta…"
          className="flex-1 h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-400"
        />
        <button type="submit" className="rounded-xl bg-cyan-500/20 px-4 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition">Pesquisar</button>
        {q && <button type="button" onClick={() => { setSearch(""); setQ(""); }} className="text-xs text-slate-500 hover:text-slate-300">Limpar</button>}
      </form>

      {accounts.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-600">Sem contas de clientes encontradas.</p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
          {accounts.map((a, i) => (
            <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${i < accounts.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
                {(a.full_name ?? a.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">{a.full_name ?? "—"}</p>
                  {a.account_code && (
                    <span className="rounded bg-[#00BDEB]/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-[#00BDEB]">
                      {a.account_code}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500">{a.email ?? "—"} {a.phone ? `· ${a.phone}` : ""}</p>
              </div>
              <div className="hidden sm:block text-right flex-shrink-0">
                <p className="text-xs font-bold text-white">{a.orders_count}</p>
                <p className="text-[10px] text-slate-600">pedido{a.orders_count !== 1 ? "s" : ""}</p>
              </div>
              {a.active_30d && (
                <span className="flex-shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Activo</span>
              )}
              <span className="text-[10px] text-slate-600 flex-shrink-0">
                {a.last_order_at ? new Date(a.last_order_at).toLocaleDateString("pt-PT") : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-600">{accounts.length} contas visíveis · Contas são criadas via app CLYON (Supabase Auth).</p>
    </div>
  );
}

// ── Métricas ───────────────────────────────────────────────────────────────
type Metricas = {
  summary: { total: number; completed: number; cancelled: number; completionRate: number | null; cancellationRate: number | null };
  byStatus: Record<string, number>;
  topCategories: { slug: string; count: number }[];
  topCities: { city: string; count: number }[];
  timeSeries: { date: string; count: number }[];
};

function MBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="w-32 flex-shrink-0 truncate text-xs text-slate-400">{label}</p>
      <div className="flex-1 rounded-full bg-white/[0.04]" style={{ height: 5 }}>
        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="w-7 text-right text-xs font-bold text-white">{count}</p>
    </div>
  );
}

function TabMetricas({ authHeader }: { authHeader: Record<string, string> }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/app-clyon/metricas?days=${days}`, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setData(json);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, days]);

  useEffect(() => { load(); }, [load]);

  const maxStatus = Math.max(...Object.values(data?.byStatus ?? {}), 1);
  const maxCat    = Math.max(...(data?.topCategories.map((c) => c.count) ?? [1]), 1);
  const maxCity   = Math.max(...(data?.topCities.map((c) => c.count) ?? [1]), 1);
  const maxDay    = Math.max(...(data?.timeSeries.map((t) => t.count) ?? [1]), 1);

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${days === d ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30" : "text-slate-500 hover:text-slate-300"}`}>
            {d} dias
          </button>
        ))}
      </div>
      {loading && <Spinner />}
      {error && <ErrBox msg={error} onRetry={load} />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total",             value: data.summary.total,             accent: "text-white" },
              { label: "Concluídos",        value: data.summary.completed,         accent: "text-emerald-400" },
              { label: "Taxa conclusão",    value: data.summary.completionRate != null ? `${data.summary.completionRate}%` : "N/D", accent: "text-emerald-400" },
              { label: "Taxa cancelamento", value: data.summary.cancellationRate != null ? `${data.summary.cancellationRate}%` : "N/D", accent: "text-red-400" },
            ].map((c) => (
              <div key={c.label} className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
                <p className={`mt-1.5 text-2xl font-bold ${c.accent}`}>{c.value}</p>
              </div>
            ))}
          </div>
          {data.timeSeries.length > 0 && (
            <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Volume diário</p>
              <div className="flex h-20 items-end gap-px overflow-x-auto">
                {data.timeSeries.map((t) => (
                  <div key={t.date} title={`${t.date}: ${t.count}`}
                    className="flex-shrink-0 rounded-sm bg-cyan-500/60 hover:bg-cyan-400 transition"
                    style={{ width: Math.max(4, Math.floor(560 / data.timeSeries.length)), height: `${Math.max(4, (t.count / maxDay) * 80)}px` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Por estado</p>
            <div className="space-y-2">
              {Object.entries(data.byStatus).sort(([, a], [, b]) => b - a).map(([st, count]) => (
                <MBar key={st} label={STATUS_LABELS[st] ?? st} count={count} max={maxStatus} />
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Top categorias</p>
              {data.topCategories.length === 0 ? <p className="text-xs text-slate-600">Sem dados.</p> : (
                <div className="space-y-2">{data.topCategories.map((c) => <MBar key={c.slug} label={c.slug} count={c.count} max={maxCat} />)}</div>
              )}
            </div>
            <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Top localidades</p>
              {data.topCities.length === 0 ? <p className="text-xs text-slate-600">Sem dados.</p> : (
                <div className="space-y-2">{data.topCities.map((c) => <MBar key={c.city} label={c.city} count={c.count} max={maxCity} />)}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Auditoria ──────────────────────────────────────────────────────────────
type AuditEntry = {
  id: string; request_id: string | null; colab_nome: string; action_type: string;
  status_from: string | null; status_to: string | null;
  reason: string | null; note: string | null; created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  status_change: "Mudança de estado", note: "Nota", update: "Actualização",
  archive: "Arquivado", unarchive: "Restaurado", delete_request: "Eliminado",
};

function TabAuditoria({ authHeader }: { authHeader: Record<string, string> }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"ops" | "admin">("ops");
  const [colabFilter, setColabFilter] = useState("");
  const [colabQ, setColabQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), source });
      if (colabQ) params.set("colab", colabQ);
      if (actionFilter) params.set("action_type", actionFilter);
      const res = await fetch(`/api/admin/app-clyon/auditoria?${params}`, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setEntries(json.ops ?? []);
      setTotal(json.total ?? 0);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, page, source, colabQ, actionFilter]);

  useEffect(() => { load(); }, [load]);

  function applyColab(e: React.FormEvent) { e.preventDefault(); setPage(1); setColabQ(colabFilter.trim()); }

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-white/[0.05]">
        {[
          { k: "ops" as const, label: "Operações em pedidos" },
          { k: "admin" as const, label: "Acções admin" },
        ].map((s) => (
          <button
            key={s.k}
            onClick={() => { setSource(s.k); setPage(1); }}
            className={`border-b-2 px-4 py-2 text-xs font-semibold transition ${
              source === s.k ? "border-[#00BDEB] text-[#00BDEB]" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={applyColab} className="flex flex-1 gap-2">
          <input
            value={colabFilter}
            onChange={(e) => setColabFilter(e.target.value)}
            placeholder="Filtrar por colaborador…"
            className="flex-1 h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-white outline-none focus:border-cyan-400"
          />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-white outline-none"
          >
            <option value="" className="bg-[#0C1C2E]">Todas acções</option>
            {source === "ops"
              ? <>
                  <option value="status_change" className="bg-[#0C1C2E]">Mudança de estado</option>
                  <option value="note" className="bg-[#0C1C2E]">Nota</option>
                  <option value="update" className="bg-[#0C1C2E]">Actualização</option>
                </>
              : <>
                  <option value="create" className="bg-[#0C1C2E]">Criação</option>
                  <option value="update" className="bg-[#0C1C2E]">Actualização</option>
                  <option value="delete" className="bg-[#0C1C2E]">Eliminação</option>
                </>}
          </select>
          <button type="submit" className="rounded-xl bg-cyan-500/20 px-4 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition">Filtrar</button>
        </form>
        <button onClick={load} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400 hover:text-white transition">↻</button>
      </div>

      <p className="text-xs text-slate-500">{total} entrada{total !== 1 ? "s" : ""} · fonte: <code className="text-slate-400">{source === "ops" ? "service_request_ops" : "admin_audit_log"}</code></p>

      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-600">Não existem entradas para a fonte e os filtros seleccionados.</p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
          {entries.map((e, i) => (
            <div key={e.id} className={`px-4 py-3 ${i < entries.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-300">{e.colab_nome}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">{ACTION_LABELS[e.action_type] ?? e.action_type}</span>
                {e.status_from && e.status_to && (
                  <span className="text-[10px] text-slate-500">
                    {STATUS_LABELS[e.status_from] ?? e.status_from} → <span className="text-cyan-400">{STATUS_LABELS[e.status_to] ?? e.status_to}</span>
                  </span>
                )}
                <span className="ml-auto text-[10px] text-slate-600">{fmtDt(e.created_at)}</span>
              </div>
              {e.request_id && <p className="mt-1 font-mono text-[10px] text-slate-600">Pedido: {e.request_id.slice(0, 8)}…</p>}
              {e.reason && <p className="mt-0.5 text-xs text-amber-300">Motivo: {e.reason}</p>}
              {e.note && <p className="mt-0.5 text-xs text-slate-400 italic">{e.note}</p>}
            </div>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:text-white">←</button>
          <span className="text-xs text-slate-500">{page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:text-white">→</button>
        </div>
      )}
    </div>
  );
}

// ── Shell principal ────────────────────────────────────────────────────────
export default function AppClyonEmbedded({
  authHeader,
  activeTab: externalTab,
  onTabChange,
  activePedidoId: externalPedidoId,
  onPedidoChange,
}: {
  authHeader: Record<string, string>;
  activeTab?: AppClyonTab;
  onTabChange?: (tab: AppClyonTab) => void;
  activePedidoId?: string | null;
  onPedidoChange?: (id: string | null) => void;
}) {
  const [internalTab, setInternalTab] = useState<AppClyonTab>("visao-geral");
  const [internalPedidoId, setInternalPedidoId] = useState<string | null>(null);
  const [pedidosRefresh, setPedidosRefresh] = useState(0);

  const tab = externalTab ?? internalTab;
  const selectedOrderId = externalPedidoId !== undefined ? externalPedidoId : internalPedidoId;

  function handleTabChange(newTab: AppClyonTab) {
    if (onTabChange) onTabChange(newTab);
    else setInternalTab(newTab);
    if (newTab !== "pedidos") {
      if (onPedidoChange) onPedidoChange(null);
      else setInternalPedidoId(null);
    }
  }

  function handlePedidoChange(id: string | null) {
    if (onPedidoChange) onPedidoChange(id);
    else setInternalPedidoId(id);
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-cyan-400/10 bg-[#06111F]">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-[#0C1C2E] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00BDEB]">App CLYON</p>
        <h2 className="mt-0.5 text-lg font-bold text-white">Gestão da Aplicação</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex overflow-x-auto border-b border-white/[0.05] px-4 scrollbar-none">
        {CLYON_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`flex-shrink-0 border-b-2 px-4 py-3 text-xs font-semibold transition ${
              tab === t.id
                ? "border-[#00BDEB] text-[#00BDEB]"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className={tab === "pedidos" && selectedOrderId ? "" : "p-5"}>
        {tab === "visao-geral"   && <TabVisaoGeral authHeader={authHeader} />}
        {tab === "pedidos" && !selectedOrderId && (
          <AppPedidosClient
            key={pedidosRefresh}
            externalAuthHeader={authHeader}
            onRowClick={(id) => handlePedidoChange(id)}
          />
        )}
        {tab === "pedidos" && selectedOrderId && (
          <div className="flex flex-col md:flex-row">
            <div className="hidden md:block md:w-[40%] md:border-r md:border-white/[0.06] overflow-y-auto max-h-[80vh]">
              <AppPedidosClient
                key={pedidosRefresh}
                externalAuthHeader={authHeader}
                onRowClick={(id) => handlePedidoChange(id)}
                compact
                selectedId={selectedOrderId}
              />
            </div>
            <div className="w-full md:w-[60%] p-5 overflow-y-auto max-h-[80vh]">
              <PedidoInlinePanel
                id={selectedOrderId}
                authHeader={authHeader}
                onBack={() => handlePedidoChange(null)}
                onChanged={() => setPedidosRefresh((n) => n + 1)}
              />
            </div>
          </div>
        )}
        {tab === "agenda"        && <TabAgenda authHeader={authHeader} />}
        {tab === "profissionais" && <TabProfissionais authHeader={authHeader} />}
        {tab === "catalogo"      && <TabCatalogo authHeader={authHeader} />}
        {tab === "cupons"        && <TabCupons authHeader={authHeader} />}
        {tab === "moedas"        && <TabMoedas authHeader={authHeader} />}
        {tab === "pagamentos"    && <TabPagamentos authHeader={authHeader} />}
        {tab === "contas"        && <TabContas authHeader={authHeader} />}
        {tab === "metricas"      && <TabMetricas authHeader={authHeader} />}
        {tab === "auditoria"     && <TabAuditoria authHeader={authHeader} />}
      </div>
    </div>
  );
}
