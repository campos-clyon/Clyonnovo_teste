"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { NOME_DA_APP } from "@/lib/erros-da-app";

/**
 * OS ERROS DA APP CLYON PRO — 25-10-2026.
 *
 * Quantos erros a app mandou nos últimos 7 dias, e quais: o mesmo erro, no
 * mesmo ecrã e na mesma versão, numa linha só, com as vezes ao lado. Não há
 * nomes nem contas: a app só manda a versão, o ecrã, a mensagem e quando.
 */

type Grupo = { app?: string; versao: string; ecra: string; mensagem: string; vezes: number; ultimo: string };
type Resumo = { dias: number; total: number; porApp?: Record<string, number>; grupos: Grupo[] };

function quando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminErrosDaAppPanel({ onTotal }: { onTotal?: (n: number) => void }) {
  const { token, ready } = useAdminAuth();
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (_silencioso = false) => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/profissionais/erros-da-app", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível carregar.");
        return;
      }
      setR(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  useEffect(() => {
    if (r) onTotal?.(r.total);
  }, [r, onTotal]);

  if (!r && !erro) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        A ler os erros da app…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">
          {r && r.total > 0 ? (
            <>
              <span className="font-bold text-amber-200">{r.total}</span>{" "}
              {r.total === 1 ? "erro" : "erros"} das apps nos últimos {r.dias} dias
              {r.porApp ? ` (Pro ${r.porApp.pro ?? 0} · Cliente ${r.porApp.cliente ?? 0})` : ""}.
            </>
          ) : (
            <>Nenhum erro das apps (CLYON Pro e cliente) nos últimos {r?.dias ?? 7} dias.</>
          )}
        </p>
        <button
          type="button"
          onClick={() => void carregar()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</p>
      )}

      {r && r.grupos.length > 0 && (
        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-700/60">
          {r.grupos.map((g, i) => (
            <li key={`${g.app ?? "pro"}-${g.versao}-${g.ecra}-${i}`} className="p-3 text-sm">
              <p className="break-words font-medium text-slate-100">{g.mensagem}</p>
              <p className="mt-1 text-xs text-slate-400">
                App {NOME_DA_APP[g.app ?? "pro"] ?? g.app} · Ecrã {g.ecra} · versão {g.versao} · {g.vezes} {g.vezes === 1 ? "vez" : "vezes"} · última {quando(g.ultimo)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
