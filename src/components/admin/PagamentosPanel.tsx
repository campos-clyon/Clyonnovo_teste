"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrabalhoDetalhe {
  pedidoId: number;
  assignedAt: string;
  valorPago: number;
  serviceType: string | null;
  city: string | null;
}

interface PagamentoAssistente {
  assistenteId: number;
  assistenteNome: string;
  totalTrabalhos: number;
  totalEuros: number;
  trabalhos: TrabalhoDetalhe[];
}

type Periodo = "semana" | "mes" | "personalizado";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function fmtData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis:           "Recolha de móveis",
  recolha_monos:            "Recolha de monos",
  recolha_entulho:          "Recolha de entulho",
  esvaziamento_casa:        "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca:                  "Mudança",
  outro:                    "Outro",
};

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PagamentosPanelProps {
  /** Authorization header value, e.g. "Bearer <token>" */
  authHeader: Record<string, string>;
}

export default function PagamentosPanel({ authHeader }: PagamentosPanelProps) {
  const [periodo, setPeriodo]       = useState<Periodo>("semana");
  const [customFrom, setCustomFrom] = useState(() => toInputDate(startOfWeek(new Date())));
  const [customTo, setCustomTo]     = useState(() => toInputDate(new Date()));

  const [pagamentos, setPagamentos] = useState<PagamentoAssistente[]>([]);
  const [fromLabel, setFromLabel]   = useState("");
  const [toLabel, setToLabel]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [expanded, setExpanded]     = useState<number | null>(null);

  const buildUrl = useCallback(() => {
    const now = new Date();
    let from: Date;
    let to: Date = now;
    if (periodo === "semana") {
      from = startOfWeek(now);
    } else if (periodo === "mes") {
      from = startOfMonth(now);
    } else {
      from = new Date(customFrom + "T00:00:00");
      to   = new Date(customTo   + "T23:59:59");
    }
    return `/api/admin/pagamentos?from=${from.toISOString()}&to=${to.toISOString()}`;
  }, [periodo, customFrom, customTo]);

  const fetchPagamentos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(buildUrl(), { headers: authHeader });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar pagamentos");
      setPagamentos(data.pagamentos ?? []);
      setFromLabel(data.from ? new Date(data.from).toLocaleDateString("pt-PT") : "");
      setToLabel(data.to   ? new Date(data.to).toLocaleDateString("pt-PT")     : "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [authHeader, buildUrl]);

  useEffect(() => { fetchPagamentos(); }, [fetchPagamentos]);

  const totalGlobal     = pagamentos.reduce((s, p) => s + p.totalEuros,     0);
  const trabalhosGlobal = pagamentos.reduce((s, p) => s + p.totalTrabalhos, 0);

  return (
    <div className="min-h-full px-4 py-6 md:px-8 md:py-8">

      {/* ── Header ── */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Pagamentos</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Ganhos fixos por trabalho atribuído
            {fromLabel && toLabel ? ` · ${fromLabel} – ${toLabel}` : ""}
          </p>
        </div>
        <button
          onClick={fetchPagamentos}
          disabled={loading}
          className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.07] disabled:opacity-50 transition"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      {/* ── Filtro de período ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {(["semana", "mes", "personalizado"] as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`rounded-[14px] border px-4 py-2 text-sm font-semibold transition ${
              periodo === p
                ? "border-[#00B4D8]/40 bg-[#00B4D8]/10 text-[#00B4D8]"
                : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {p === "semana" ? "Esta semana" : p === "mes" ? "Este mês" : "Personalizado"}
          </button>
        ))}

        {periodo === "personalizado" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-[14px] border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-[#00B4D8]/40 focus:outline-none transition [color-scheme:dark]"
            />
            <span className="text-slate-500 text-sm">até</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-[14px] border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-[#00B4D8]/40 focus:outline-none transition [color-scheme:dark]"
            />
            <button
              onClick={fetchPagamentos}
              className="rounded-[14px] bg-[#00B4D8] px-4 py-2 text-sm font-bold text-slate-950 hover:bg-[#00C8F0] transition"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* ── Erro ── */}
      {error && (
        <div className="mb-5 rounded-[14px] border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Totais globais ── */}
      {!loading && pagamentos.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-[18px] border border-[#00B4D8]/20 bg-[#00B4D8]/[0.06] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#00B4D8]/70">Total a pagar</p>
            <p className="mt-2 text-2xl font-bold text-[#00B4D8]">{fmtEur(totalGlobal)}</p>
          </div>
          <div className="rounded-[18px] border border-[#06D6A0]/20 bg-[#06D6A0]/[0.06] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#06D6A0]/70">Trabalhos realizados</p>
            <p className="mt-2 text-2xl font-bold text-[#06D6A0]">{trabalhosGlobal}</p>
          </div>
          <div className="rounded-[18px] border border-slate-700/50 bg-slate-800/40 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Assistentes activos</p>
            <p className="mt-2 text-2xl font-bold text-white">{pagamentos.length}</p>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <svg className="w-7 h-7 animate-spin text-[#00B4D8]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* ── Sem resultados ── */}
      {!loading && pagamentos.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-slate-700/50 bg-slate-800/30 py-16 text-center">
          <svg className="mb-3 w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-slate-400">Sem trabalhos atribuídos neste período</p>
          <p className="mt-1 text-xs text-slate-600">Atribua trabalhos a assistentes para que apareçam aqui.</p>
        </div>
      )}

      {/* ── Lista por assistente ── */}
      {!loading && pagamentos.length > 0 && (
        <div className="space-y-3">
          {pagamentos.map((p) => {
            const isOpen = expanded === p.assistenteId;
            return (
              <div
                key={p.assistenteId}
                className="rounded-[20px] border border-slate-700/50 bg-slate-800/40 overflow-hidden"
              >
                {/* Linha resumo */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : p.assistenteId)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition text-left"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-sky-500/15 text-sm font-bold text-sky-300">
                    {p.assistenteNome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{p.assistenteNome}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.totalTrabalhos} trabalho{p.totalTrabalhos !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-[#06D6A0]">{fmtEur(p.totalEuros)}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {fmtEur(p.totalEuros / Math.max(p.totalTrabalhos, 1))}/trabalho
                    </p>
                  </div>
                  <svg
                    className={`w-4 h-4 flex-shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Detalhe expandivel */}
                {isOpen && (
                  <div className="border-t border-slate-700/50 px-5 py-4 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-3">
                      Detalhe dos trabalhos
                    </p>
                    {p.trabalhos.map((t) => (
                      <div
                        key={t.pedidoId}
                        className="flex items-center gap-3 rounded-[14px] border border-slate-700/40 bg-slate-900/40 px-4 py-3"
                      >
                        <span className="text-[10px] font-mono font-bold text-slate-500 flex-shrink-0">
                          #{t.pedidoId}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300 truncate">
                            {t.serviceType ? (SERVICE_LABELS[t.serviceType] ?? t.serviceType) : "Serviço não especificado"}
                          </p>
                          {t.city && (
                            <p className="text-[10px] text-slate-600 mt-0.5">{t.city}</p>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 flex-shrink-0 text-right">
                          {fmtData(t.assignedAt)}
                        </p>
                        <span className="text-sm font-bold text-[#06D6A0] flex-shrink-0 w-14 text-right">
                          {fmtEur(t.valorPago)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded-[14px] border border-[#06D6A0]/20 bg-[#06D6A0]/[0.05] px-4 py-3 mt-3">
                      <span className="text-xs font-semibold text-slate-400">Total {p.assistenteNome}</span>
                      <span className="text-base font-bold text-[#06D6A0]">{fmtEur(p.totalEuros)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
