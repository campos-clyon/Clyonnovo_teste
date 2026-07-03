"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { FIELD_TRANSLATIONS } from "@/lib/translations";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "semana" | "mes" | "personalizado";

interface Resumo {
  totalPedidos:    number;
  totalAprovados:  number;
  taxaAprovacao:   number;
  receitaTotal:    number;
  tempoMedioMin:   number | null;
}

interface ServicoRow  { serviceType: string; total: number }
interface ZonaRow     { zona: string; total: number }
interface SemanalRow  { semana: string; total: number; aprovados: number }

interface MetricasData {
  periodo:       { start: string; end: string };
  resumo:        Resumo;
  porServico:    ServicoRow[];
  porLocalidade: ZonaRow[];
  semanal:       SemanalRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function fmtMin(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

function tService(v: string) {
  return FIELD_TRANSLATIONS.serviceType?.[v] ?? v;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-5 flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-[#0e1826] px-4 py-3 text-sm shadow-xl">
      <p className="mb-1 font-semibold text-slate-300">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Horizontal bar ──────────────────────────────────────────────────────────

function HBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 truncate text-xs text-slate-300">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#00B4D8]"
          style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-400">{count}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MetricasClient() {
  const { ready, authHeader } = useAdminAuth();

  const [period, setPeriod]   = useState<Period>("mes");
  const [from,   setFrom]     = useState("");
  const [to,     setTo]       = useState("");
  const [data,   setData]     = useState<MetricasData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchMetricas = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (period === "personalizado" && from && to) {
        params.set("from", from);
        params.set("to", to);
      }
      const res = await fetch(`/api/admin/metricas?${params}`, { headers: authHeader });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [ready, period, from, to, authHeader]);

  useEffect(() => { fetchMetricas(); }, [fetchMetricas]);

  // Today default for custom picker
  useEffect(() => {
    if (!from && !to) {
      const today = new Date().toISOString().slice(0, 10);
      const m1    = new Date(); m1.setMonth(m1.getMonth() - 1);
      setFrom(m1.toISOString().slice(0, 10));
      setTo(today);
    }
  }, []);  // eslint-disable-line

  if (!ready) return null;

  const r = data?.resumo;
  const maxServico    = data ? Math.max(...data.porServico.map(s => s.total), 1) : 1;
  const maxLocalidade = data ? Math.max(...data.porLocalidade.map(z => z.total), 1) : 1;

  const inputCls = "rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none";

  return (
    <div className="flex-1 overflow-y-auto bg-[#080F1A] min-h-full">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Métricas</h1>
            <p className="mt-1 text-sm text-slate-500">
              {data ? (
                <>
                  {new Date(data.periodo.start).toLocaleDateString("pt-PT")}
                  {" — "}
                  {new Date(data.periodo.end).toLocaleDateString("pt-PT")}
                </>
              ) : "A carregar período…"}
            </p>
          </div>

          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2">
            {(["semana", "mes", "personalizado"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-[14px] border px-4 py-1.5 text-xs font-semibold transition ${
                  period === p
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200"
                }`}
              >
                {p === "semana" ? "Esta semana" : p === "mes" ? "Este mês" : "Personalizado"}
              </button>
            ))}

            {period === "personalizado" && (
              <>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
                <span className="text-slate-600 text-xs">→</span>
                <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className={inputCls} />
                <button
                  onClick={fetchMetricas}
                  className="rounded-[14px] border border-[#0077B6]/40 bg-[#0077B6]/10 px-4 py-1.5 text-xs font-semibold text-[#00B4D8] hover:bg-[#0077B6]/20 transition"
                >
                  Aplicar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-[18px] border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
            Erro ao carregar métricas: {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-[22px] border border-white/[0.04] bg-white/[0.015] animate-pulse" />
            ))}
          </div>
        )}

        {/* Stat cards */}
        {!loading && r && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Pedidos recebidos"
              value={String(r.totalPedidos)}
              accent="text-white"
            />
            <StatCard
              label="Aprovados"
              value={String(r.totalAprovados)}
              accent="text-[#06D6A0]"
            />
            <StatCard
              label="Taxa de aprovação"
              value={`${r.taxaAprovacao}%`}
              sub={`${r.totalAprovados} de ${r.totalPedidos}`}
              accent="text-[#00B4D8]"
            />
            <StatCard
              label="Receita estimada"
              value={fmtEur(r.receitaTotal)}
              sub="pedidos aprovados"
              accent="text-[#06D6A0]"
            />
            <StatCard
              label="Tempo médio resposta"
              value={fmtMin(r.tempoMedioMin)}
              sub={r.tempoMedioMin ? "desde criação até 1.ª acção" : "sem dados"}
              accent="text-[#00B4D8]"
            />
          </div>
        )}

        {/* Bar chart */}
        {!loading && data && data.semanal.length > 0 && (
          <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-6">
            <h2 className="mb-5 text-sm font-semibold text-slate-300 uppercase tracking-[0.15em]">
              Pedidos por semana
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.semanal} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="semana"
                  tickFormatter={fmtDate}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
                  formatter={(v) => v === "total" ? "Total" : "Aprovados"}
                />
                <Bar dataKey="total"     name="total"     fill="#0077B6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="aprovados" name="aprovados" fill="#06D6A0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bottom two cols */}
        {!loading && data && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* Serviço mais pedido */}
            <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-6">
              <h2 className="mb-5 text-sm font-semibold text-slate-300 uppercase tracking-[0.15em]">
                Serviço mais pedido
              </h2>
              {data.porServico.length === 0 ? (
                <p className="text-sm text-slate-600">Sem dados para o período.</p>
              ) : (
                <div className="space-y-3">
                  {data.porServico.map((s) => (
                    <HBar
                      key={s.serviceType}
                      label={tService(s.serviceType)}
                      count={s.total}
                      max={maxServico}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Zona mais frequente */}
            <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-6">
              <h2 className="mb-5 text-sm font-semibold text-slate-300 uppercase tracking-[0.15em]">
                Zona mais frequente
              </h2>
              {data.porLocalidade.length === 0 ? (
                <p className="text-sm text-slate-600">Sem dados para o período.</p>
              ) : (
                <div className="space-y-3">
                  {data.porLocalidade.map((z) => (
                    <HBar
                      key={z.zona}
                      label={z.zona}
                      count={z.total}
                      max={maxLocalidade}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data && data.resumo.totalPedidos === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/[0.06] bg-white/[0.02]">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm">Sem pedidos no período seleccionado.</p>
          </div>
        )}

      </div>
    </div>
  );
}
