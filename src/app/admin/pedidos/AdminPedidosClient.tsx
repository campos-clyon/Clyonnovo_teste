"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/hooks/useAdminAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pendente" | "atribuido" | "em_analise" | "precisa_info"
  | "estimativa_pronta" | "presencial_recomendado" | "aprovado"
  | "enviado_cliente" | "confirmado" | "em_execucao" | "concluido"
  | "cancelado" | "rejeitado";

type OrderPriority = "baixa" | "normal" | "alta" | "urgente";

type Order = {
  id: number;
  serviceType?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  urgency?: string | null;
  estimateTotal?: string | null;
  estimateMin?: string | null;
  estimateMax?: string | null;
  precoFinal?: string | null;
  precoFinalIva?: string | null;
  status: OrderStatus;
  priority?: OrderPriority | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
  dataAgendada?: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Config ───────────────────────────────────────────────────────────────────

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

const PRIORITY_CFG: Record<OrderPriority, { label: string; color: string }> = {
  baixa:   { label: "Baixa",   color: "text-slate-500" },
  normal:  { label: "Normal",  color: "text-slate-400" },
  alta:    { label: "Alta",    color: "text-amber-400" },
  urgente: { label: "Urgente", color: "text-red-400" },
};

const FILTER_TABS: { key: OrderStatus | "todos" | "sem_assistente"; label: string }[] = [
  { key: "todos",               label: "Total" },
  { key: "pendente",            label: "Novos" },
  { key: "atribuido",           label: "Atribuídos" },
  { key: "em_analise",          label: "Em análise" },
  { key: "sem_assistente",      label: "Sem assistente" },
  { key: "aprovado",            label: "Aprovados" },
  { key: "confirmado",          label: "Confirmados" },
  { key: "presencial_recomendado", label: "Presencial" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtEur(v?: string | null) {
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : `${n.toFixed(0)}€`;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG["pendente"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── PriorityDot ──────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority?: OrderPriority | null }) {
  const cfg = PRIORITY_CFG[priority ?? "normal"];
  if (priority === "baixa" || !priority) return null;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminPedidosClient() {
  const { token, ready, authHeader, user } = useAdminAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<OrderStatus | "todos" | "sem_assistente">("todos");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (activeTab !== "todos") params.set("status", activeTab);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/pedidos?${params}`, { headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar");
      setOrders(data.orders ?? []);
      setCounts(data.counts ?? {});
      setIsAdmin(!!data.isAdmin);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, authHeader, activeTab, debouncedSearch]);

  useEffect(() => { if (ready) fetchOrders(); }, [ready, fetchOrders]);

  // Métricas — counts["total"] já vem calculado pela API (não usar reduce para evitar duplicar)
  const total = counts["total"] ?? 0;
  const pendentes = (counts["pendente"] ?? 0) + (counts["atribuido"] ?? 0) + (counts["em_analise"] ?? 0);
  const confirmados = counts["confirmado"] ?? 0;
  const concluidos = counts["concluido"] ?? 0;
  const faturacaoTotal = useMemo(() => {
    return orders
      .filter((o) => ["concluido", "confirmado", "em_execucao"].includes(o.status))
      .reduce((sum, o) => sum + (parseFloat(o.precoFinalIva ?? o.precoFinal ?? o.estimateTotal ?? "0") || 0), 0);
  }, [orders]);

  if (!ready) return null;

  return (
    <div className="min-h-full px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pedidos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAdmin ? "Gestão de todos os pedidos do simulador" : `Os meus pedidos · ${user?.nome ?? ""}`}
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.07] transition"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-7">
        <MetricCard label="Total de pedidos" value={total} />
        <MetricCard label="Por tratar" value={pendentes} accent={pendentes > 0 ? "text-amber-400" : "text-white"} />
        <MetricCard label="Confirmados" value={confirmados} accent="text-green-400" />
        <MetricCard label="Facturação" value={faturacaoTotal > 0 ? `${faturacaoTotal.toFixed(0)}€` : "—"} accent="text-cyan-400" sub="pedidos activos" />
      </div>

      {/* Filtros + pesquisa */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => {
            const cnt = tab.key === "todos" ? total : (counts[tab.key] ?? 0);
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                {tab.label}
                {cnt > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-cyan-400/20 text-cyan-300" : "bg-white/10 text-slate-400"}`}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nome, telefone, morada..."
            className="w-full min-w-[240px] rounded-2xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* Lista */}
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <svg className="w-7 h-7 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[24px] border border-white/[0.06] bg-white/[0.02] py-20 text-center">
          <svg className="mb-3 w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm font-medium text-slate-400">Nenhum pedido encontrado</p>
          <p className="mt-1 text-xs text-slate-600">Tente ajustar os filtros ou a pesquisa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/pedidos/${order.id}`}
              className="flex items-center gap-4 rounded-[20px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition hover:border-cyan-400/20 hover:bg-white/[0.04] group"
            >
              {/* ID + prioridade */}
              <div className="flex-shrink-0 w-14 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">#</p>
                <p className="text-lg font-bold text-slate-300">{order.id}</p>
                <PriorityDot priority={order.priority} />
              </div>

              {/* Info principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white truncate">
                    {order.contactName ?? "Cliente"}
                  </p>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500 truncate">
                  {order.serviceType ?? "Serviço não especificado"}
                  {order.address ? ` · ${order.address}` : order.city ? ` · ${order.city}` : ""}
                </p>
                {order.assignedToName && (
                  <p className="mt-0.5 text-[10px] text-sky-400/80">
                    Assistente: {order.assignedToName}
                  </p>
                )}
              </div>

              {/* Valor + data */}
              <div className="flex-shrink-0 text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-200">
                  {fmtEur(order.precoFinalIva ?? order.precoFinal ?? order.estimateTotal) ?? "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{fmt(order.createdAt)}</p>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0">
                <svg className="w-4 h-4 text-slate-700 group-hover:text-cyan-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {orders.length > 0 && (
        <p className="mt-4 text-center text-[11px] text-slate-600">
          A mostrar {orders.length} pedido{orders.length !== 1 ? "s" : ""}
          {activeTab !== "todos" ? ` com estado "${STATUS_CFG[activeTab as OrderStatus]?.label ?? activeTab}"` : ""}
        </p>
      )}
    </div>
  );
}
