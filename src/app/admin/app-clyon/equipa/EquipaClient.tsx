"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppClyonShell from "../AppClyonShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Assistant = {
  id: number;
  nome: string;
  funcao: string;
  isAdmin: number;
  activePedidos: number;
};

const FUNCAO_LABEL: Record<string, string> = {
  admin: "Admin", assistente: "Assistente", motorista: "Motorista", ajudante: "Ajudante",
};

export default function EquipaClient() {
  const { authHeader, ready } = useAdminAuth({ skip: false });
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/assistentes", { headers: authHeader });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao carregar."); return; }
      setAssistants(data.assistentes ?? data.assistants ?? []);
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
            <h2 className="text-base font-bold text-white">Equipa</h2>
            <p className="text-xs text-slate-500">
              Leitura da fonte de verdade de colaboradores.
              Para gerir contas, usar{" "}
              <Link href="/admin/assistentes" className="text-cyan-400 hover:underline">
                Assistentes →
              </Link>
            </p>
          </div>
          <Link
            href="/admin/assistentes"
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/20"
          >
            Gerir equipa →
          </Link>
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

        {!loading && assistants.length === 0 && !error && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] py-12 text-center text-sm text-slate-600">
            Sem colaboradores registados.
          </div>
        )}

        {!loading && assistants.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
            {assistants.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center gap-4 px-4 py-3.5 ${
                  i < assistants.length - 1 ? "border-b border-white/[0.04]" : ""
                }`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-sm font-bold text-slate-200">
                  {a.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{a.nome}</p>
                  <p className="text-xs text-slate-500">{FUNCAO_LABEL[a.funcao] ?? a.funcao}</p>
                </div>
                {a.isAdmin === 1 && (
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                    Admin
                  </span>
                )}
                <div className="text-right">
                  <p className="text-xs font-semibold text-white">{a.activePedidos}</p>
                  <p className="text-[10px] text-slate-600">pedidos activos</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-600">
            <strong className="text-slate-400">Nota:</strong> A carga de trabalho por responsável e a disponibilidade
            dependem de dados de atribuição em <code className="text-slate-500">service_requests</code>.
            Atribuições directas por colaborador não estão modeladas no esquema actual — campo N/D até que
            a relação seja definida.
          </p>
        </div>
      </div>
    </AppClyonShell>
  );
}
