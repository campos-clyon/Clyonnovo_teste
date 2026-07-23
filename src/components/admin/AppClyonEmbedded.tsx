"use client";

import { useCallback, useEffect, useState } from "react";
import AppPedidosClient from "@/app/admin/app-pedidos/AppPedidosClient";

// ── Tipos partilhados ──────────────────────────────────────────────────────
type AppStatus =
  | "draft" | "received" | "in_review" | "awaiting_deposit" | "assignment_pending"
  | "partner_selected" | "confirmed" | "in_route" | "arrived" | "in_execution"
  | "extra_review_requested" | "awaiting_confirmation" | "completed"
  | "in_dispute" | "canceled" | "rejected";

type InlineOrder = {
  id: string; status: AppStatus; urgency: string;
  details: string | null; notes: string | null;
  address_line: string | null; city: string | null; region: string | null;
  category_slug: string | null; estimated_price: number | null;
  scheduled_for: string | null; photos: string[]; created_at: string;
  client_name: string | null; client_email: string | null; client_phone: string | null;
  category_name: string | null; category_icon: string | null;
};

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

  // Campos editáveis
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

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-cyan-500" />
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
      {error} <button onClick={onBack} className="ml-2 underline">← Voltar</button>
    </div>
  );

  if (!order) return null;

  const statusCfg = INLINE_STATUS_CFG[order.status];

  return (
    <div className="space-y-4">
      {/* Header do detalhe */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.07]"
        >
          ← Pedidos
        </button>
        <span className="font-mono text-xs text-slate-600">#{order.id.slice(0, 8)}</span>
        <span className={`text-xs font-semibold ${statusCfg?.color ?? "text-slate-400"}`}>
          {statusCfg?.label ?? order.status}
        </span>
        {order.urgency === "urgent" && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">URGENTE</span>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        {/* Coluna principal */}
        <div className="space-y-4">

          {/* Dados originais do cliente — só leitura */}
          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Pedido original
              <span className="ml-1.5 font-normal normal-case text-slate-700">(só leitura)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className={IL}>Título / detalhes</span>
                <p className="text-sm text-white">{order.details || "—"}</p>
              </div>
              <div>
                <span className={IL}>Categoria</span>
                <p className="text-sm text-white">
                  {order.category_icon && <span className="mr-1">{order.category_icon}</span>}
                  {order.category_name || order.category_slug || "—"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className={IL}>Descrição</span>
                <p className="text-sm text-slate-300">{order.notes || "—"}</p>
              </div>
              <div>
                <span className={IL}>Morada</span>
                <p className="text-sm text-white">{order.address_line || "—"}</p>
                <p className="text-xs text-slate-500">{[order.city, order.region].filter(Boolean).join(", ")}</p>
              </div>
              <div>
                <span className={IL}>Criado em</span>
                <p className="text-sm text-white">{fmtDt(order.created_at)}</p>
              </div>
              <div>
                <span className={IL}>Orçamento indicativo</span>
                <p className="text-sm text-white">
                  {order.estimated_price != null
                    ? new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(order.estimated_price)
                    : "—"}
                </p>
              </div>
              <div>
                <span className={IL}>Data preferida</span>
                <p className="text-sm text-white">
                  {order.scheduled_for ? fmtDt(String(order.scheduled_for)) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Histórico de operações */}
          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02]">
            <div className="border-b border-white/[0.05] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Histórico de operações</p>
            </div>
            {ops.length === 0 ? (
              <p className="px-4 py-6 text-xs text-slate-600">Sem operações registadas.</p>
            ) : (
              <div>
                {ops.map((op) => (
                  <div key={op.id} className="border-b border-white/[0.03] px-4 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {op.action_type === "status_change" && (
                          <p className="text-xs text-white">
                            <span className="text-slate-500">{INLINE_STATUS_CFG[op.status_from ?? ""]?.label ?? op.status_from}</span>
                            {" → "}
                            <span className={INLINE_STATUS_CFG[op.status_to ?? ""]?.color ?? "text-white"}>
                              {INLINE_STATUS_CFG[op.status_to ?? ""]?.label ?? op.status_to}
                            </span>
                          </p>
                        )}
                        {op.reason && (
                          <p className="mt-0.5 text-xs text-amber-300/80">Motivo: {op.reason}</p>
                        )}
                        {op.note && (
                          <p className="mt-0.5 text-xs text-slate-300">{op.note}</p>
                        )}
                        {op.action_type === "update" && !op.note && (
                          <p className="text-xs text-slate-500">Campos operacionais actualizados</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[10px] text-slate-600">{op.colab_nome}</p>
                        <p className="text-[10px] text-slate-700">{fmtDt(op.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral — operação */}
        <div className="space-y-4">
          {/* Cliente */}
          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="text-sm font-medium text-white">{order.client_name || "—"}</p>
            {order.client_phone && (
              <a href={`tel:${order.client_phone}`} className="mt-2 flex items-center gap-1.5 text-xs text-cyan-400 hover:underline">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {order.client_phone}
              </a>
            )}
            {order.client_email && (
              <a href={`mailto:${order.client_email}`} className="mt-1 flex items-center gap-1.5 text-xs text-cyan-400 hover:underline">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {order.client_email}
              </a>
            )}
          </div>

          {/* Painel de operação */}
          <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Operação</p>
            <div className="space-y-3">
              <div>
                <label className={IL}>Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as AppStatus)} className={INP}>
                  {INLINE_VALID_STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-[#0A1220]">{INLINE_STATUS_CFG[s].label}</option>
                  ))}
                </select>
              </div>

              {needsReason && (
                <div>
                  <label className={IL}>Motivo (obrigatório)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Razão do cancelamento / rejeição..."
                    className={TA}
                  />
                </div>
              )}

              <div>
                <label className={IL}>Urgência</label>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={INP}>
                  <option value="normal" className="bg-[#0A1220]">Normal</option>
                  <option value="urgent" className="bg-[#0A1220]">Urgente</option>
                  <option value="flexible" className="bg-[#0A1220]">Flexível</option>
                </select>
              </div>

              <div>
                <label className={IL}>Orçamento confirmado (€)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={price} onChange={(e) => setPrice(e.target.value)}
                  className={INP}
                />
              </div>

              <div>
                <label className={IL}>Data/hora agendada</label>
                <input
                  type="datetime-local"
                  value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
                  className={INP}
                />
              </div>

              <div>
                <label className={IL}>Nota interna</label>
                <textarea
                  value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder="Nota registada no histórico..."
                  className={TA}
                />
              </div>
            </div>

            {saveError && (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {saveError}
              </div>
            )}
            {saveOk && (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Guardado com sucesso.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {saving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type AppClyonTab = "visao-geral" | "pedidos" | "agenda" | "equipa" | "catalogo" | "config" | "metricas";

const TABS: { id: AppClyonTab; label: string }[] = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "pedidos",     label: "Pedidos" },
  { id: "agenda",      label: "Agenda" },
  { id: "equipa",      label: "Equipa" },
  { id: "catalogo",    label: "Catálogo" },
  { id: "config",      label: "Configuração" },
  { id: "metricas",    label: "Métricas" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", received: "Recebido", in_review: "Em análise",
  awaiting_deposit: "Aguarda depósito", assignment_pending: "A atribuir",
  partner_selected: "Parceiro", confirmed: "Confirmado",
  in_route: "A caminho", arrived: "Chegou", in_execution: "Em execução",
  extra_review_requested: "Revisão extra", awaiting_confirmation: "Ag. confirmação",
  completed: "Concluído", in_dispute: "Disputa", canceled: "Cancelado", rejected: "Rejeitado",
};

const COVERAGE_ZONES = [
  "Lisboa", "Almada", "Setúbal", "Seixal", "Barreiro", "Montijo",
  "Sesimbra", "Palmela", "Moita", "Alcochete", "Loures", "Amadora",
  "Sintra", "Cascais", "Oeiras", "Vila Franca de Xira",
];

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

// ── Visão Geral ────────────────────────────────────────────────────────────
type VisaoGeral = {
  stats: {
    total: number; open: number; inProgress: number; completed: number;
    cancelled: number; urgent: number; unassigned: number; scheduledToday: number;
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
    { label: "Total",           value: stats.total,         color: "text-white" },
    { label: "Abertos",         value: stats.open,          color: "text-yellow-400" },
    { label: "Em curso",        value: stats.inProgress,    color: "text-blue-400" },
    { label: "Concluídos",      value: stats.completed,     color: "text-emerald-400" },
    { label: "Cancelados",      value: stats.cancelled,     color: "text-slate-500" },
    { label: "Urgentes",        value: stats.urgent,        color: "text-red-400" },
    { label: "Sem atribuição",  value: stats.unassigned,    color: "text-orange-400" },
    { label: "Agendados hoje",  value: stats.scheduledToday, color: "text-cyan-400" },
  ];

  return (
    <div className="space-y-5">
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

// ── Agenda ─────────────────────────────────────────────────────────────────
type AgendaOrder = {
  id: string; slug: string; status: string; scheduled_for: string;
  address?: string | null; city?: string | null;
  profiles?: { name?: string; phone?: string } | null;
};

function TabAgenda({ authHeader }: { authHeader: Record<string, string> }) {
  const [orders, setOrders] = useState<AgendaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/app-clyon/agenda", { headers: authHeader });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro."); return; }
      setOrders(json.orders ?? []);
    } catch { setError("Erro de ligação."); }
    finally { setLoading(false); }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error) return <ErrBox msg={error} onRetry={load} />;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-2xl">📅</p>
        <p className="mt-3 text-sm font-semibold text-white">Sem pedidos agendados</p>
        <p className="mt-1 text-xs text-slate-500">Quando pedidos tiverem data definida aparecem aqui.</p>
      </div>
    );
  }

  // Agrupar por dia
  const byDay: Record<string, AgendaOrder[]> = {};
  for (const o of orders) {
    const day = o.scheduled_for.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(o);
  }

  return (
    <div className="space-y-4">
      {Object.entries(byDay).map(([day, list]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {new Date(day + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <div className="overflow-hidden rounded-[18px] border border-white/[0.07]">
            {list.map((o) => (
              <div key={o.id} className="flex items-center gap-3 border-b border-white/[0.03] px-4 py-3 last:border-0">
                <span className="min-w-[48px] text-sm font-bold text-cyan-400">
                  {new Date(o.scheduled_for).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{o.profiles?.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">{o.slug} · {o.city ?? "—"}</p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-300">
                  {STATUS_LABELS[o.status] ?? o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Equipa ─────────────────────────────────────────────────────────────────
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
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Gestão detalhada de colaboradores disponível no tab <strong className="text-slate-300">Equipa</strong> do painel principal.
      </p>
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
        body: JSON.stringify({ is_active: !cat.is_active }),
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
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-lg">
                {cat.icon || "📦"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{cat.name}</p>
                <p className="text-[10px] font-mono text-slate-600">{cat.slug}</p>
              </div>
              <span className="text-xs font-bold text-white">{cat.request_count}</span>
              <span className="text-[10px] text-slate-600 mr-2">pedidos</span>
              <button
                onClick={() => toggle(cat)}
                disabled={toggling === cat.slug}
                className={`flex-shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  cat.is_active
                    ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                    : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                }`}
              >
                {toggling === cat.slug ? "..." : cat.is_active ? "Arquivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-amber-300/60">
        Arquivar não apaga histórico — apenas impede novos pedidos dessa categoria.
      </p>
    </div>
  );
}

// ── Configuração ───────────────────────────────────────────────────────────
function TabConfig() {
  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
        <p className="text-sm font-semibold text-white">Zonas de cobertura</p>
        <p className="mb-3 text-xs text-slate-500">Fonte: código — sem tabela de configuração.</p>
        <div className="flex flex-wrap gap-2">
          {COVERAGE_ZONES.map((z) => (
            <span key={z} className="rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1 text-xs text-slate-300">{z}</span>
          ))}
        </div>
      </div>
      {[
        { title: "Regras de triagem e SLA", note: "N/D — sem tabela de SLA persistida." },
        { title: "Modelos de comunicação",  note: "N/D — modelos não têm persistência configurável." },
        { title: "Limites de orçamento",    note: "N/D — calculados em src/lib/pricing-helper.ts." },
      ].map((s) => (
        <div key={s.title} className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-sm font-semibold text-white">{s.title}</p>
          <p className="mt-1 text-xs text-slate-500">{s.note}</p>
        </div>
      ))}
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
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              days === d ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30" : "text-slate-500 hover:text-slate-300"
            }`}>{d} dias</button>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <ErrBox msg={error} onRetry={load} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total",             value: data.summary.total, accent: "text-white" },
              { label: "Concluídos",        value: data.summary.completed, accent: "text-emerald-400" },
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
                <div className="space-y-2">
                  {data.topCategories.map((c) => <MBar key={c.slug} label={c.slug} count={c.count} max={maxCat} />)}
                </div>
              )}
            </div>
            <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Top localidades</p>
              {data.topCities.length === 0 ? <p className="text-xs text-slate-600">Sem dados.</p> : (
                <div className="space-y-2">
                  {data.topCities.map((c) => <MBar key={c.city} label={c.city} count={c.count} max={maxCity} />)}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Shell principal ────────────────────────────────────────────────────────
export default function AppClyonEmbedded({ authHeader }: { authHeader: Record<string, string> }) {
  const [tab, setTab] = useState<AppClyonTab>("visao-geral");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-[28px] border border-cyan-400/10 bg-[#080F1A]">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-[#0A1220] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-500">App CLYON</p>
        <h2 className="mt-0.5 text-lg font-bold text-white">Gestão da Aplicação</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex overflow-x-auto border-b border-white/[0.05] px-4 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedOrderId(null); }}
            className={`flex-shrink-0 border-b-2 px-4 py-3 text-xs font-semibold transition ${
              tab === t.id
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="p-5">
        {tab === "visao-geral" && <TabVisaoGeral authHeader={authHeader} />}
        {tab === "pedidos" && !selectedOrderId && (
          <AppPedidosClient
            externalAuthHeader={authHeader}
            onRowClick={(id) => setSelectedOrderId(id)}
          />
        )}
        {tab === "pedidos" && selectedOrderId && (
          <PedidoInlinePanel
            id={selectedOrderId}
            authHeader={authHeader}
            onBack={() => setSelectedOrderId(null)}
          />
        )}
        {tab === "agenda"      && <TabAgenda authHeader={authHeader} />}
        {tab === "equipa"      && <TabEquipa authHeader={authHeader} />}
        {tab === "catalogo"    && <TabCatalogo authHeader={authHeader} />}
        {tab === "config"      && <TabConfig />}
        {tab === "metricas"    && <TabMetricas authHeader={authHeader} />}
      </div>
    </div>
  );
}
