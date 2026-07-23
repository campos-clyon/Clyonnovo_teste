"use client";

import { useCallback, useEffect, useState } from "react";
import AppPedidosClient from "@/app/admin/app-pedidos/AppPedidosClient";
import PagamentosPanel from "@/components/admin/PagamentosPanel";
import { CLYON_TABS, type AppClyonTab } from "@/components/admin/app-clyon/navigation";

export type { AppClyonTab };

// ── Tipos partilhados ──────────────────────────────────────────────────────
type AppStatus =
  | "draft" | "received" | "in_review" | "awaiting_deposit" | "assignment_pending"
  | "partner_selected" | "confirmed" | "in_route" | "arrived" | "in_execution"
  | "extra_review_requested" | "awaiting_confirmation" | "completed"
  | "in_dispute" | "canceled" | "rejected";

type InlineOrder = {
  id: string; status: AppStatus; urgency: string;
  details: unknown; notes: unknown;
  address_line: unknown; city: unknown; region: unknown;
  category_slug: string | null; estimated_price: number | null;
  scheduled_for: string | null; photos: string[]; created_at: string;
  client_name: unknown; client_email: unknown; client_phone: unknown;
  category_name: unknown; category_icon: string | null;
  details_meta?: Record<string, unknown> | null;
};

function displayText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ");
    return joined || fallback;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) {
        parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      }
    }
    return parts.length > 0 ? parts.join("; ") : fallback;
  }
  return String(value) || fallback;
}

type OpsEntry = {
  id: string; action_type: string; status_from: string | null; status_to: string | null;
  reason: string | null; note: string | null; colab_nome: string; created_at: string;
};

const INLINE_STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "text-slate-400" },
  received: { label: "Recebido", color: "text-amber-400" },
  in_review: { label: "Em análise", color: "text-amber-400" },
  awaiting_deposit: { label: "Aguarda depósito", color: "text-amber-400" },
  assignment_pending: { label: "A atribuir", color: "text-amber-400" },
  partner_selected: { label: "Parceiro atribuído", color: "text-amber-400" },
  confirmed: { label: "Confirmado", color: "text-sky-400" },
  in_route: { label: "A caminho", color: "text-sky-400" },
  arrived: { label: "Chegou", color: "text-sky-400" },
  in_execution: { label: "Em execução", color: "text-sky-400" },
  extra_review_requested: { label: "Revisão extra", color: "text-sky-400" },
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
}: {
  id: string;
  authHeader: Record<string, string>;
  onBack: () => void;
}) {
  const [order, setOrder] = useState<InlineOrder | null>(null);
  const [ops, setOps] = useState<OpsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<AppStatus>("received");
  const [urgency, setUrgency] = useState("normal");
  const [price, setPrice] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const needsReason = status === "canceled" || status === "rejected";

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [orderRes, opsRes] = await Promise.all([
        fetch(`/api/admin/app-pedidos/${id}`, { headers: authHeader }),
        fetch(`/api/admin/app-clyon/pedidos/${id}/ops`, { headers: authHeader }),
      ]);
      const orderJson = await orderRes.json();
      if (!orderRes.ok) { setError(orderJson.error ?? "Erro ao carregar pedido."); return; }
      const opsJson = await opsRes.json();
      const o = orderJson.order as InlineOrder;
      setOrder(o);
      setOps(opsJson.ops ?? []);
      setStatus(o.status);
      setUrgency(o.urgency ?? "normal");
      setPrice(o.estimated_price != null ? String(o.estimated_price) : "");
      setScheduledFor(o.scheduled_for ? String(o.scheduled_for).slice(0, 16) : "");
      setAdminNote(""); setReason("");
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [id, authHeader]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!order) return;
    setSaving(true); setSaveError(null); setSaveOk(false);
    const payload: Record<string, unknown> = {};
    if (status !== order.status) payload.status = status;
    if (urgency !== order.urgency) payload.urgency = urgency;
    const origPrice = order.estimated_price != null ? String(order.estimated_price) : "";
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
      setSaveOk(true);
      await load();
    } catch { setSaveError("Erro de ligação."); }
    finally { setSaving(false); }
  }

  const IL = "text-[10px] uppercase tracking-wider text-slate-500 block mb-1";
  const INP = "mt-0.5 h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-400";
  const TA = "mt-0.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 resize-none";

  if (loading) return <Spinner />;
  if (error) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
      {error} <button onClick={onBack} className="ml-2 underline">← Voltar</button>
    </div>
  );
  if (!order) return null;

  const statusCfg = INLINE_STATUS_CFG[order.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] transition"
        >
          ← Voltar
        </button>
        <span className="font-mono text-xs text-slate-600">{order.id}</span>
        <span className={`ml-auto text-xs font-bold ${statusCfg?.color ?? "text-white"}`}>
          {statusCfg?.label ?? order.status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        {/* Coluna principal */}
        <div className="space-y-4">
          {/* Pedido original */}
          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pedido original do cliente (só leitura)</p>
            <dl className="space-y-2 text-sm">
              {[
                ["Categoria", displayText(order.category_name ?? order.category_slug)],
                ["Morada", displayText(order.address_line)],
                ["Cidade", displayText(order.city)],
                ["Região", displayText(order.region)],
                ["Descrição", displayText(order.details)],
                ["Notas", displayText(order.notes)],
                ["Criado", fmtDt(order.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-24 flex-shrink-0 text-slate-500">{k}</dt>
                  <dd className="flex-1 text-slate-200 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Histórico de operações */}
          {ops.length > 0 && (
            <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Histórico de operações</p>
              <div className="space-y-2">
                {ops.map((op) => (
                  <div key={op.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
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
          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="text-sm font-medium text-white">{displayText(order.client_name)}</p>
            {typeof order.client_phone === "string" && order.client_phone && (
              <a href={`tel:${order.client_phone}`} className="mt-2 flex items-center gap-1.5 text-xs text-cyan-400 hover:underline">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {order.client_phone}
              </a>
            )}
            {typeof order.client_email === "string" && order.client_email && (
              <a href={`mailto:${order.client_email}`} className="mt-1 flex items-center gap-1.5 text-xs text-cyan-400 hover:underline">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {order.client_email}
              </a>
            )}
          </div>

          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Operação</p>
            <div className="space-y-3">
              <div>
                <label className={IL}>Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as AppStatus)} className={INP}>
                  {INLINE_VALID_STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-[#0C1C2E]">{INLINE_STATUS_CFG[s].label}</option>
                  ))}
                </select>
              </div>
              {needsReason && (
                <div>
                  <label className={IL}>Motivo (obrigatório)</label>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Razão do cancelamento / rejeição..." className={TA} />
                </div>
              )}
              <div>
                <label className={IL}>Urgência</label>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={INP}>
                  <option value="normal" className="bg-[#0C1C2E]">Normal</option>
                  <option value="urgent" className="bg-[#0C1C2E]">Urgente</option>
                  <option value="flexible" className="bg-[#0C1C2E]">Flexível</option>
                </select>
              </div>
              <div>
                <label className={IL}>Orçamento confirmado (€)</label>
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
            </div>
            {saveError && <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{saveError}</div>}
            {saveOk && <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">Guardado com sucesso.</div>}
            <button onClick={handleSave} disabled={saving} className="mt-4 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
              {saving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STATUS_LABELS ──────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", received: "Recebido", in_review: "Em análise",
  awaiting_deposit: "Aguarda depósito", assignment_pending: "A atribuir",
  partner_selected: "Parceiro", confirmed: "Confirmado",
  in_route: "A caminho", arrived: "Chegou", in_execution: "Em execução",
  extra_review_requested: "Revisão extra", awaiting_confirmation: "Ag. confirmação",
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

function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmtD = (d: Date) => d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  return `${fmtD(monday)} — ${fmtD(sunday)}`;
}

function TabAgenda({ authHeader }: { authHeader: Record<string, string> }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [orders, setOrders] = useState<AgendaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const from = weekStart.toISOString().slice(0, 10);
    const to = addDays(weekStart, 7).toISOString().slice(0, 10);
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

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayOrders = orders.filter((o) => o.scheduled_for.slice(0, 10) === dateStr);
    const isToday = dateStr === new Date().toISOString().slice(0, 10);
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
                  {d.date.getDate()}
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
type PartnerProfile = {
  id: string; full_name: string | null; email: string | null; phone: string | null; created_at: string;
  availability_status: string | null; onboarding_status: string | null;
  services: string[]; docs_total: number; docs_verified: number; docs_pending: number;
  rating_avg: number; rating_count: number;
};
type PartnerStats = { total: number; active: number; docs_pending: number };

function TabProfissionais({ authHeader }: { authHeader: Record<string, string> }) {
  const [profiles, setProfiles] = useState<PartnerProfile[]>([]);
  const [stats, setStats] = useState<PartnerStats>({ total: 0, active: 0, docs_pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = q ? `/api/admin/app-clyon/profissionais?q=${encodeURIComponent(q)}` : "/api/admin/app-clyon/profissionais";
      const res = await fetch(url, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setProfiles(json.profiles ?? []);
      setStats(json.stats ?? { total: 0, active: 0, docs_pending: 0 });
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, q]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(search.trim());
  }

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Disponíveis</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Docs pendentes</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">{stats.docs_pending}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome ou e-mail…"
          className="flex-1 h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-400"
        />
        <button type="submit" className="rounded-xl bg-cyan-500/20 px-4 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition">Pesquisar</button>
        {q && <button type="button" onClick={() => { setSearch(""); setQ(""); }} className="text-xs text-slate-500 hover:text-slate-300">Limpar</button>}
      </form>

      {profiles.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600">Sem profissionais registados. Verifica <code>partner_profiles</code> ou <code>user_roles</code> em Supabase.</p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
          {profiles.map((p, i) => (
            <div key={p.id} className={`px-4 py-3 ${i < profiles.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-300">
                  {(p.full_name ?? p.email ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate">{p.full_name ?? "—"}</p>
                    {p.availability_status && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        p.availability_status === "available" || p.availability_status === "online"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-500/15 text-slate-400"
                      }`}>
                        {p.availability_status}
                      </span>
                    )}
                    {p.onboarding_status && p.onboarding_status !== "completed" && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                        {p.onboarding_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{p.email ?? "—"} {p.phone ? `· ${p.phone}` : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
                  {p.rating_count > 0 && (
                    <span className="text-xs text-amber-300">★ {p.rating_avg} <span className="text-slate-600">({p.rating_count})</span></span>
                  )}
                  <span className="text-[10px] text-slate-600">{new Date(p.created_at).toLocaleDateString("pt-PT")}</span>
                </div>
              </div>
              {(p.services.length > 0 || p.docs_total > 0) && (
                <div className="mt-2 flex items-center gap-3 flex-wrap pl-13 ml-13">
                  {p.services.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.services.slice(0, 5).map((s) => (
                        <span key={s} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-400">{s}</span>
                      ))}
                      {p.services.length > 5 && <span className="text-[10px] text-slate-600">+{p.services.length - 5}</span>}
                    </div>
                  )}
                  {p.docs_total > 0 && (
                    <span className="text-[10px] text-slate-500">
                      Docs: <span className="text-emerald-400">{p.docs_verified}</span>/<span className="text-white">{p.docs_total}</span>
                      {p.docs_pending > 0 && <span className="text-amber-400"> · {p.docs_pending} pendente{p.docs_pending > 1 ? "s" : ""}</span>}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-600">Total visível: {profiles.length}</p>
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

  return (
    <div className="space-y-4">
      {cats.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600">Sem categorias em <code>service_categories</code>.</p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
          {cats.map((cat, i) => (
            <div key={cat.slug} className={`flex items-center gap-3 px-4 py-3 ${i < cats.length - 1 ? "border-b border-white/[0.04]" : ""} ${!cat.is_active ? "opacity-50" : ""}`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-lg">{cat.icon || "📦"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{cat.name}</p>
                <p className="text-[10px] font-mono text-slate-600">{cat.slug}</p>
              </div>
              <span className="text-xs font-bold text-white">{cat.request_count}</span>
              <span className="text-[10px] text-slate-600 mr-2">pedidos</span>
              <button
                onClick={() => toggle(cat)}
                disabled={toggling === cat.slug}
                className={`flex-shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${cat.is_active ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
              >
                {toggling === cat.slug ? "..." : cat.is_active ? "Arquivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-amber-300/60">Arquivar não apaga histórico — apenas impede novos pedidos dessa categoria.</p>
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
function TabMoedas() {
  return (
    <div className="space-y-5">
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
  stats: { total_paid: number; total_manual: number; total_earnings: number; count_paid: number; count_manual: number; count_earnings: number };
  payments: Array<{ id: string; request_id?: string; amount: number; currency?: string; status?: string; method?: string; created_at: string }>;
  manual: Array<{ id: string; request_id?: string; amount: number; currency?: string; method?: string; note?: string; created_at: string }>;
  earnings: Array<{ id: string; partner_id?: string; request_id?: string; amount: number; currency?: string; status?: string; created_at: string }>;
  days: number;
};

function fmtMoney(v: number, cur = "EUR") {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur }).format(v);
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
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
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
          {rows.map((r: any, i) => (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i < rows.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
              <span className="font-mono text-[10px] text-slate-600 w-16 truncate">{String(r.id).slice(0, 8)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{fmtMoney(Number(r.amount ?? 0), r.currency || "EUR")}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {r.request_id ? `Pedido ${String(r.request_id).slice(0, 8)}` : ""}
                  {r.partner_id ? ` · Partner ${String(r.partner_id).slice(0, 8)}` : ""}
                  {r.method ? ` · ${r.method}` : ""}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              {r.status && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  r.status === "paid" || r.status === "succeeded" ? "bg-emerald-500/15 text-emerald-300" :
                  r.status === "pending" ? "bg-amber-500/15 text-amber-300" :
                  r.status === "failed" ? "bg-red-500/15 text-red-300" :
                  "bg-slate-500/15 text-slate-400"
                }`}>{r.status}</span>
              )}
              <span className="text-[10px] text-slate-600 flex-shrink-0">
                {new Date(r.created_at).toLocaleDateString("pt-PT")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contas (clientes app) ─────────────────────────────────────────────────
type ClientAccount = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
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
          placeholder="Pesquisar por nome ou e-mail…"
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
                <p className="text-sm font-medium text-white truncate">{a.full_name ?? "—"}</p>
                <p className="text-xs text-slate-500 truncate">{a.email ?? "—"} {a.phone ? `· ${a.phone}` : ""}</p>
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
  id: string; request_id: string; colab_nome: string; action_type: string;
  status_from: string | null; status_to: string | null;
  reason: string | null; note: string | null; created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  status_change: "Mudança de estado", note: "Nota", update: "Actualização",
};

function TabAuditoria({ authHeader }: { authHeader: Record<string, string> }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/app-clyon/auditoria?page=${page}&limit=${LIMIT}`, { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setEntries(json.ops ?? []);
      setTotal(json.total ?? 0);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader, page]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{total} entradas no registo de auditoria</p>
        <button onClick={load} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 hover:text-white transition">↻ Actualizar</button>
      </div>
      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-600">Sem entradas de auditoria. A tabela <code>service_request_ops</code> pode estar vazia ou não existir.</p>
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
              <p className="mt-1 font-mono text-[10px] text-slate-600">Pedido: {e.request_id.slice(0, 8)}…</p>
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
            externalAuthHeader={authHeader}
            onRowClick={(id) => handlePedidoChange(id)}
          />
        )}
        {tab === "pedidos" && selectedOrderId && (
          <div className="flex flex-col md:flex-row">
            <div className="hidden md:block md:w-[40%] md:border-r md:border-white/[0.06] overflow-y-auto max-h-[80vh]">
              <AppPedidosClient
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
              />
            </div>
          </div>
        )}
        {tab === "agenda"        && <TabAgenda authHeader={authHeader} />}
        {tab === "profissionais" && <TabProfissionais authHeader={authHeader} />}
        {tab === "catalogo"      && <TabCatalogo authHeader={authHeader} />}
        {tab === "cupons"        && <TabCupons authHeader={authHeader} />}
        {tab === "moedas"        && <TabMoedas />}
        {tab === "pagamentos"    && <TabPagamentos authHeader={authHeader} />}
        {tab === "contas"        && <TabContas authHeader={authHeader} />}
        {tab === "metricas"      && <TabMetricas authHeader={authHeader} />}
        {tab === "auditoria"     && <TabAuditoria authHeader={authHeader} />}
      </div>
    </div>
  );
}
