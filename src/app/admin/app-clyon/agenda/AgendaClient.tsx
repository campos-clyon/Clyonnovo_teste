"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppClyonShell from "../AppClyonShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type AgendaOrder = {
  id: string;
  title: string;
  city: string;
  region: string;
  status: string;
  urgency: string;
  scheduled_for: string;
  estimated_price: number | null;
  client_name: string | null;
  client_phone: string | null;
  created_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: "text-sky-400", in_route: "text-sky-400", arrived: "text-sky-400",
  in_execution: "text-sky-400", assignment_pending: "text-amber-400",
  partner_selected: "text-amber-400",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: "Europe/Lisbon",
  });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const h = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
  return h === "00:00" ? null : h; // Se hora for meia-noite, provável que só data foi definida
}

export default function AgendaClient() {
  const { authHeader, ready } = useAdminAuth({ skip: false });
  const [orders, setOrders] = useState<AgendaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/app-clyon/agenda", { headers: authHeader });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao carregar."); return; }
      setOrders(data.orders ?? []);
    } catch {
      setError("Erro de ligação.");
    } finally {
      setLoading(false);
    }
  }, [ready, authHeader]);

  useEffect(() => { load(); }, [load]);

  // Agrupar por dia
  const grouped = orders.reduce<Record<string, AgendaOrder[]>>((acc, o) => {
    const day = String(o.scheduled_for).slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(o);
    return acc;
  }, {});

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <AppClyonShell>
      <div className="px-5 py-6 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Agenda</h2>
            <p className="text-xs text-slate-500">Trabalhos confirmados e pendentes de agendamento · fuso Europe/Lisbon</p>
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

        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="h-6 w-6 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] py-14 text-center">
            <p className="text-sm text-slate-500">Sem trabalhos agendados.</p>
            <p className="mt-1 text-xs text-slate-700">
              Pedidos com data confirmada aparecerão aqui.
            </p>
          </div>
        )}

        {!loading && Object.entries(grouped).map(([day, items]) => {
          const isToday = day === todayStr;
          return (
            <div key={day} className="mb-6">
              <div className={`mb-2 flex items-center gap-2`}>
                <span className={`text-xs font-bold ${isToday ? "text-cyan-400" : "text-slate-400"}`}>
                  {isToday ? "HOJE · " : ""}{fmtDate(day + "T00:00:00")}
                </span>
                <span className="text-xs text-slate-700">({items.length} trabalho{items.length !== 1 ? "s" : ""})</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
                {items.map((o, i) => {
                  const timeLabel = fmtTime(o.scheduled_for);
                  return (
                    <Link
                      key={o.id}
                      href={`/admin/app-clyon/pedidos/${o.id}`}
                      className={`flex items-center gap-4 px-4 py-3.5 transition hover:bg-white/[0.03] ${
                        i < items.length - 1 ? "border-b border-white/[0.04]" : ""
                      }`}
                    >
                      {/* Hora */}
                      <div className="w-12 flex-shrink-0 text-center">
                        {timeLabel ? (
                          <p className="text-xs font-bold text-slate-300">{timeLabel}</p>
                        ) : (
                          <p className="text-[10px] text-slate-700">Hora N/D</p>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{o.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[o.city, o.region].filter(Boolean).join(", ")}
                          {o.client_name && <span className="ml-2 text-slate-600">· {o.client_name}</span>}
                        </p>
                      </div>

                      {/* Estado */}
                      <span className={`text-xs font-semibold ${STATUS_COLOR[o.status] ?? "text-slate-400"}`}>
                        {o.status.replace(/_/g, " ")}
                      </span>

                      {/* Preço */}
                      {o.estimated_price != null && (
                        <span className="text-xs text-slate-400">
                          {new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(o.estimated_price)}
                        </span>
                      )}

                      {o.urgency === "urgent" && (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                          URG
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AppClyonShell>
  );
}
