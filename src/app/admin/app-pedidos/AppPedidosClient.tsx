"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppStatus =
  | "draft"
  | "received"
  | "in_review"
  | "awaiting_deposit"
  | "assignment_pending"
  | "partner_selected"
  | "confirmed"
  | "in_route"
  | "arrived"
  | "in_execution"
  | "extra_review_requested"
  | "awaiting_confirmation"
  | "completed"
  | "in_dispute"
  | "canceled"
  | "rejected";

type FilterGroup = "todos" | "abertos" | "em_curso" | "concluidos" | "cancelados";
type Urgency   = "normal" | "urgent" | "flexible";

const GROUP_STATUSES: Record<Exclude<FilterGroup, "todos">, AppStatus[]> = {
  abertos:     ["draft", "received", "in_review", "awaiting_deposit", "assignment_pending", "partner_selected"],
  em_curso:    ["confirmed", "in_route", "arrived", "in_execution", "extra_review_requested", "awaiting_confirmation"],
  concluidos:  ["completed"],
  cancelados:  ["canceled", "rejected", "in_dispute"],
};

type AppOrder = {
  id: string;
  title: string;
  description: string;
  location: string;
  district: string;
  city: string;
  urgency: Urgency;
  budget_range: string | null;
  preferred_date: string | null;
  status: AppStatus;
  photos: string[];
  created_at: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  category_name: string | null;
  category_icon: string | null;
  responses_count: number;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const AMBER  = { dot: "bg-amber-400",   badge: "bg-amber-400/10 border-amber-400/30 text-amber-300" };
const SKY    = { dot: "bg-sky-400",     badge: "bg-sky-400/10 border-sky-400/30 text-sky-300" };
const EMER   = { dot: "bg-emerald-400", badge: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300" };
const RED    = { dot: "bg-red-500",     badge: "bg-red-500/10 border-red-500/30 text-red-400" };
const SLATE  = { dot: "bg-slate-500",   badge: "bg-slate-500/10 border-slate-500/30 text-slate-400" };

const STATUS_CFG: Record<AppStatus, { label: string; dot: string; badge: string }> = {
  draft:                  { label: "Rascunho",        ...SLATE },
  received:               { label: "Recebido",        ...AMBER },
  in_review:              { label: "Em análise",      ...AMBER },
  awaiting_deposit:       { label: "Aguarda depósito",...AMBER },
  assignment_pending:     { label: "A atribuir",      ...AMBER },
  partner_selected:       { label: "Parceiro atribuído",...AMBER },
  confirmed:              { label: "Confirmado",      ...SKY },
  in_route:               { label: "A caminho",       ...SKY },
  arrived:                { label: "Chegou",          ...SKY },
  in_execution:           { label: "Em execução",     ...SKY },
  extra_review_requested: { label: "Revisão extra",   ...SKY },
  awaiting_confirmation:  { label: "Aguarda confirmação",...SKY },
  completed:              { label: "Concluído",       ...EMER },
  in_dispute:             { label: "Em disputa",      ...RED },
  canceled:               { label: "Cancelado",       ...RED },
  rejected:               { label: "Rejeitado",       ...RED },
};

const URGENCY_CFG: Record<Urgency, { label: string; color: string }> = {
  urgent:   { label: "Urgente",   color: "text-red-400" },
  normal:   { label: "Normal",    color: "text-slate-400" },
  flexible: { label: "Flexível",  color: "text-slate-500" },
};

const FILTER_TABS: { key: FilterGroup; label: string }[] = [
  { key: "todos",       label: "Todos" },
  { key: "abertos",     label: "Abertos" },
  { key: "em_curso",    label: "Em curso" },
  { key: "concluidos",  label: "Concluídos" },
  { key: "cancelados",  label: "Cancelados" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.received;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

// ─── OrderRow ────────────────────────────────────────────────────────────────

function OrderRow({ order, onClick }: { order: AppOrder; onClick: () => void }) {
  const urgency = URGENCY_CFG[order.urgency] ?? URGENCY_CFG.normal;
  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-4 border-b border-white/[0.04] px-5 py-4 transition hover:bg-white/[0.03]"
    >
      {/* ID curto + urgência */}
      <div className="w-16 flex-shrink-0">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${urgency.color}`}>
          {urgency.label !== "Normal" ? urgency.label : ""}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-600">
          #{order.id.slice(0, 8)}
        </p>
      </div>

      {/* Título + detalhes */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {order.category_icon && (
            <span className="text-base leading-none">{order.category_icon}</span>
          )}
          <p className="truncate text-sm font-medium text-white">
            {order.title}
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {order.category_name && <span className="mr-2 text-slate-600">{order.category_name}</span>}
          {order.city}{order.district ? `, ${order.district}` : ""}
        </p>
      </div>

      {/* Cliente */}
      <div className="hidden w-36 flex-shrink-0 md:block">
        <p className="truncate text-sm text-slate-300">{order.client_name ?? "—"}</p>
        <p className="truncate text-xs text-slate-600">{order.client_phone ?? order.client_email ?? ""}</p>
      </div>

      {/* Respostas */}
      <div className="hidden w-16 flex-shrink-0 text-center md:block">
        <p className="text-sm font-semibold text-white">{order.responses_count}</p>
        <p className="text-[10px] text-slate-600">respostas</p>
      </div>

      {/* Status + data */}
      <div className="flex-shrink-0 text-right">
        <StatusBadge status={order.status} />
        <p className="mt-1 text-[10px] text-slate-600">{fmt(order.created_at)}</p>
      </div>
    </div>
  );
}

// ─── DetailModal ─────────────────────────────────────────────────────────────

function DetailModal({
  order,
  authHeader,
  onClose,
  onUpdated,
}: {
  order: AppOrder;
  authHeader: Record<string, string>;
  onClose: () => void;
  onUpdated: (o: AppOrder) => void;
}) {
  const [status, setStatus] = useState<AppStatus>(order.status);
  const [saving, setSaving] = useState<null | "status" | "aprovar" | "rejeitar">(null);
  const [err, setErr] = useState<string | null>(null);

  const patch = async (payload: Record<string, unknown>, tag: typeof saving) => {
    setSaving(tag);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/app-pedidos/${order.id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Erro"); return; }
      const updated: AppOrder = { ...order, status: (data.order?.status as AppStatus) ?? status };
      onUpdated(updated);
      onClose();
    } catch {
      setErr("Erro de rede.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0F1729] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              #{order.id.slice(0, 8)}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-white">{order.title}</h2>
            <div className="mt-1">
              <StatusBadge status={order.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10"
          >
            Fechar
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="text-sm text-white">{order.client_name ?? "—"}</p>
            <p className="text-xs text-slate-500">{order.client_phone ?? order.client_email ?? ""}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Categoria</p>
            <p className="text-sm text-white">{order.category_name ?? "—"}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Localização</p>
            <p className="text-sm text-white">
              {order.location || "—"}
              {order.city && `, ${order.city}`}
              {order.district && `, ${order.district}`}
            </p>
          </div>
          {order.description && (
            <div className="md:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Descrição</p>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{order.description}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Urgência</p>
            <p className="text-sm text-white">{URGENCY_CFG[order.urgency]?.label ?? order.urgency}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Orçamento</p>
            <p className="text-sm text-white">{order.budget_range ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Criado em</p>
            <p className="text-sm text-white">{fmt(order.created_at)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Data preferida</p>
            <p className="text-sm text-white">{order.preferred_date ?? "—"}</p>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {err}
          </div>
        )}

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Acções</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={saving !== null}
              onClick={() => patch({ status: "assignment_pending" }, "aprovar")}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving === "aprovar" ? "A aprovar..." : "Aprovar"}
            </button>
            <button
              disabled={saving !== null}
              onClick={() => patch({ status: "rejected" }, "rejeitar")}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
            >
              {saving === "rejeitar" ? "A rejeitar..." : "Rejeitar"}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500">Alterar status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as AppStatus)}
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                {(Object.keys(STATUS_CFG) as AppStatus[]).map(s => (
                  <option key={s} value={s} className="bg-[#0F1729]">
                    {STATUS_CFG[s].label} ({s})
                  </option>
                ))}
              </select>
            </div>
            <button
              disabled={saving !== null || status === order.status}
              onClick={() => patch({ status }, "status")}
              className="h-10 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-50"
            >
              {saving === "status" ? "A guardar..." : "Guardar status"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AppPedidosClient({ externalAuthHeader }: { externalAuthHeader?: Record<string, string> } = {}) {
  const ownAuth = useAdminAuth({ skip: !!externalAuthHeader });
  const ready = externalAuthHeader ? true : ownAuth.ready;
  const authHeader = externalAuthHeader ?? ownAuth.authHeader;

  const [orders, setOrders]   = useState<AppOrder[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<FilterGroup>("todos");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<AppOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/app-pedidos?limit=200`, { headers: authHeader });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao carregar."); return; }
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }, [ready, authHeader]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Contagens por grupo para os tabs
  const countInGroup = (g: Exclude<FilterGroup, "todos">) =>
    orders.filter(o => GROUP_STATUSES[g].includes(o.status)).length;

  const openCount       = countInGroup("abertos");
  const inProgressCount = countInGroup("em_curso");
  const urgentCount     = orders.filter(o => o.urgency === "urgent" && GROUP_STATUSES.abertos.includes(o.status)).length;

  // Filtro por grupo + pesquisa local
  const filtered = orders.filter(o => {
    if (filter !== "todos" && !GROUP_STATUSES[filter].includes(o.status)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.title.toLowerCase().includes(q) ||
      (o.client_name ?? "").toLowerCase().includes(q) ||
      (o.client_phone ?? "").includes(q) ||
      (o.city ?? "").toLowerCase().includes(q) ||
      (o.category_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0A1220] pb-16">

      {/* Header */}
      <div className="border-b border-white/[0.05] px-5 py-5 md:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Pedidos — App Móvel</h1>
            <p className="text-xs text-slate-500">Pedidos enviados pelos clientes via app CLYON</p>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>

        {/* Métricas */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Total de pedidos" value={total} />
          <MetricCard label="Abertos"           value={openCount}       accent="text-amber-400" />
          <MetricCard label="Em curso"          value={inProgressCount} accent="text-sky-400" />
          <MetricCard label="Urgentes abertos"  value={urgentCount}     accent={urgentCount > 0 ? "text-red-400" : "text-slate-400"} />
        </div>
      </div>

      {/* Filtros + Pesquisa */}
      <div className="flex flex-col gap-3 border-b border-white/[0.04] px-5 py-3 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-1 overflow-x-auto">
          {FILTER_TABS.map(tab => {
            const count = tab.key === "todos"
              ? orders.length
              : countInGroup(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === tab.key
                    ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    filter === tab.key ? "bg-cyan-500/20 text-cyan-300" : "bg-white/5 text-slate-500"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <input
          type="search"
          placeholder="Pesquisar nome, telefone, cidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-white/20 md:w-56"
        />
      </div>

      {/* Lista */}
      <div className="px-0">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-cyan-500" />
          </div>
        )}

        {error && (
          <div className="mx-5 mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center text-sm text-slate-600">
            {search ? "Nenhum resultado para a pesquisa." : "Sem pedidos nesta categoria."}
          </div>
        )}

        {!loading && filtered.map(order => (
          <OrderRow key={order.id} order={order} onClick={() => setSelected(order)} />
        ))}

        {!loading && !error && filtered.length > 0 && (
          <p className="px-5 py-4 text-xs text-slate-600">
            A mostrar {filtered.length} de {total} pedido{total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {selected && (
        <DetailModal
          order={selected}
          authHeader={authHeader}
          onClose={() => setSelected(null)}
          onUpdated={(o) => {
            setOrders(prev => prev.map(p => p.id === o.id ? { ...p, status: o.status } : p));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
