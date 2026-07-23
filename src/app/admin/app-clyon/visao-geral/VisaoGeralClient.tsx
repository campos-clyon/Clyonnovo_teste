"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppClyonShell from "../AppClyonShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Stats = {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  urgent: number;
  unassigned: number;
  scheduledToday: number;
};

type RecentItem = {
  id: string;
  status: string;
  urgency: string;
  created_at: string;
  scheduled_for: string | null;
};

function StatCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number | string;
  accent?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", received: "Recebido", in_review: "Em análise",
  awaiting_deposit: "Aguarda depósito", assignment_pending: "A atribuir",
  partner_selected: "Parceiro atribuído", confirmed: "Confirmado",
  in_route: "A caminho", arrived: "Chegou", in_execution: "Em execução",
  extra_review_requested: "Revisão extra", awaiting_confirmation: "Aguarda confirmação",
  completed: "Concluído", in_dispute: "Em disputa", canceled: "Cancelado", rejected: "Rejeitado",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function VisaoGeralClient() {
  const { authHeader, ready } = useAdminAuth({ skip: false });
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/app-clyon/visao-geral", { headers: authHeader });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao carregar."); return; }
      setStats(data.stats);
      setRecent(data.recent ?? []);
    } catch {
      setError("Erro de ligação.");
    } finally {
      setLoading(false);
    }
  }, [ready, authHeader]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppClyonShell>
      <div className="px-5 py-6 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Visão Geral</h2>
            <p className="text-xs text-slate-500">Triagem diária — pedidos activos da aplicação</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && !stats && (
          <div className="flex items-center justify-center py-20">
            <svg className="h-6 w-6 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {stats && (
          <>
            {/* Cartões de métricas */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total de pedidos" value={stats.total} />
              <StatCard label="Abertos" value={stats.open} accent="text-amber-400"
                href="/admin/app-clyon/pedidos" />
              <StatCard label="Em curso" value={stats.inProgress} accent="text-sky-400"
                href="/admin/app-clyon/pedidos" />
              <StatCard label="Urgentes abertos" value={stats.urgent}
                accent={stats.urgent > 0 ? "text-red-400" : "text-slate-400"} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Sem atribuição" value={stats.unassigned} accent="text-orange-400" />
              <StatCard label="Agendados hoje" value={stats.scheduledToday} accent="text-cyan-400"
                href="/admin/app-clyon/agenda" />
              <StatCard label="Concluídos (total)" value={stats.completed} accent="text-emerald-400" />
              <StatCard label="Cancelados (total)" value={stats.cancelled} />
            </div>

            {/* Fila de pedidos recentes abertos/urgentes */}
            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Fila de triagem
                  <span className="ml-2 text-xs font-normal text-slate-500">— abertos e urgentes</span>
                </h3>
                <Link
                  href="/admin/app-clyon/pedidos"
                  className="text-xs text-cyan-400 hover:underline"
                >
                  Ver todos →
                </Link>
              </div>

              {recent.length === 0 ? (
                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] py-10 text-center text-sm text-slate-600">
                  Sem pedidos pendentes neste momento.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
                  {recent.map((item, i) => (
                    <Link
                      key={item.id}
                      href={`/admin/app-clyon/pedidos/${item.id}`}
                      className={`flex items-center gap-4 px-4 py-3 text-sm transition hover:bg-white/[0.03] ${
                        i < recent.length - 1 ? "border-b border-white/[0.04]" : ""
                      }`}
                    >
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${
                        item.urgency === "urgent" ? "bg-red-400" : "bg-amber-400"
                      }`} />
                      <span className="font-mono text-[11px] text-slate-600">
                        #{String(item.id).slice(0, 8)}
                      </span>
                      <span className="flex-1 text-xs text-slate-300">
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                      {item.urgency === "urgent" && (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                          URGENTE
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600">{fmt(item.created_at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppClyonShell>
  );
}
