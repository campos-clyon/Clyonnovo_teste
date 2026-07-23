"use client";

import { useCallback, useEffect, useState } from "react";
import AppPedidosClient from "@/app/admin/app-pedidos/AppPedidosClient";

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
            onClick={() => setTab(t.id)}
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
        {tab === "pedidos"     && (
          <AppPedidosClient externalAuthHeader={authHeader} />
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
