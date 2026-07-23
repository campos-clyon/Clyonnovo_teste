"use client";

import { useCallback, useEffect, useState } from "react";
import AppClyonShell from "../AppClyonShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Metricas = {
  period: { days: number; since: string };
  summary: {
    total: number;
    completed: number;
    cancelled: number;
    completionRate: number | null;
    cancellationRate: number | null;
  };
  byStatus: Record<string, number>;
  topCategories: { slug: string; count: number }[];
  topCities: { city: string; count: number }[];
  timeSeries: { date: string; count: number }[];
};

const PERIOD_OPTIONS = [
  { value: 7,  label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", received: "Recebido", in_review: "Em análise",
  awaiting_deposit: "Aguarda depósito", assignment_pending: "A atribuir",
  partner_selected: "Parceiro atribuído", confirmed: "Confirmado",
  in_route: "A caminho", arrived: "Chegou", in_execution: "Em execução",
  extra_review_requested: "Revisão extra", awaiting_confirmation: "Aguarda confirmação",
  completed: "Concluído", in_dispute: "Em disputa", canceled: "Cancelado", rejected: "Rejeitado",
};

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="w-36 flex-shrink-0 truncate text-xs text-slate-400">{label}</p>
      <div className="flex-1 rounded-full bg-white/[0.04]" style={{ height: 6 }}>
        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="w-8 text-right text-xs font-bold text-white">{count}</p>
    </div>
  );
}

export default function MetricasAppClient() {
  const { authHeader, ready } = useAdminAuth({ skip: false });
  const [days, setDays] = useState(30);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/app-clyon/metricas?days=${days}`, { headers: authHeader });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro."); return; }
      setMetricas(data);
    } catch {
      setError("Erro de ligação.");
    } finally {
      setLoading(false);
    }
  }, [ready, authHeader, days]);

  useEffect(() => { load(); }, [load]);

  const maxCat = Math.max(...(metricas?.topCategories.map((c) => c.count) ?? [1]), 1);
  const maxCity = Math.max(...(metricas?.topCities.map((c) => c.count) ?? [1]), 1);
  const maxStatus = Math.max(...Object.values(metricas?.byStatus ?? {}), 1);

  // Mini gráfico temporal — barras simples
  const maxDay = Math.max(...(metricas?.timeSeries.map((t) => t.count) ?? [1]), 1);

  return (
    <AppClyonShell>
      <div className="px-5 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Métricas</h2>
            <p className="text-xs text-slate-500">Dados reais de <code className="text-slate-600">service_requests</code></p>
          </div>
          <div className="flex gap-1.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  days === opt.value
                    ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="h-6 w-6 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {metricas && (
          <div className="space-y-5">
            {/* Sumário */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total", value: metricas.summary.total, accent: "text-white" },
                { label: "Concluídos", value: metricas.summary.completed, accent: "text-emerald-400" },
                { label: "Taxa conclusão", value: metricas.summary.completionRate != null ? `${metricas.summary.completionRate}%` : "N/D", accent: "text-emerald-400" },
                { label: "Taxa cancelamento", value: metricas.summary.cancellationRate != null ? `${metricas.summary.cancellationRate}%` : "N/D", accent: "text-red-400" },
              ].map((c) => (
                <div key={c.label} className="rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
                  <p className={`mt-1.5 text-2xl font-bold ${c.accent}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Série temporal */}
            {metricas.timeSeries.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Volume diário (últimos {days} dias)
                </h3>
                <div className="flex h-24 items-end gap-0.5 overflow-x-auto">
                  {metricas.timeSeries.map((t) => (
                    <div
                      key={t.date}
                      title={`${t.date}: ${t.count}`}
                      className="flex-shrink-0 rounded-sm bg-cyan-500/60 transition hover:bg-cyan-400"
                      style={{
                        width: Math.max(4, Math.floor(640 / metricas.timeSeries.length)),
                        height: `${Math.max(4, (t.count / maxDay) * 96)}px`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Por estado */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Por estado</h3>
              <div className="space-y-2.5">
                {Object.entries(metricas.byStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([st, count]) => (
                    <Bar key={st} label={STATUS_LABELS[st] ?? st} count={count} max={maxStatus} />
                  ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Top categorias */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Top categorias
                </h3>
                {metricas.topCategories.length === 0 ? (
                  <p className="text-xs text-slate-600">Sem dados de categoria.</p>
                ) : (
                  <div className="space-y-2.5">
                    {metricas.topCategories.map((c) => (
                      <Bar key={c.slug} label={c.slug} count={c.count} max={maxCat} />
                    ))}
                  </div>
                )}
              </div>

              {/* Top cidades */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Top localidades
                </h3>
                {metricas.topCities.length === 0 ? (
                  <p className="text-xs text-slate-600">Sem dados de localidade.</p>
                ) : (
                  <div className="space-y-2.5">
                    {metricas.topCities.map((c) => (
                      <Bar key={c.city} label={c.city} count={c.count} max={maxCity} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-700">
              SLA/tempo até primeira acção: N/D — requer timestamp de acção administrativa ainda não registado.
              Carga por responsável: N/D — atribuição directa não modelada no esquema actual.
            </p>
          </div>
        )}
      </div>
    </AppClyonShell>
  );
}
