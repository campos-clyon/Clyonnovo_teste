"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { MOTIVOS_DA_FALHA, NOME_DO_MOTIVO, type ContagemDasFalhas } from "@/lib/falhas-da-ia";

/**
 * AS FALHAS DA ANÁLISE COM IA, NO INÍCIO — d59, 16-11-2026.
 *
 * Quantas vezes a análise com o modelo caiu na estimativa local, nos últimos 7
 * e 30 dias, por motivo. Antes só ficava uma linha no registo do servidor. A
 * conta é do servidor (`/api/admin/resumo/falhas-da-ia`).
 */
export default function FalhasDaIa() {
  const { token, ready } = useAdminAuth();
  const [dados, setDados] = useState<{ semana: ContagemDasFalhas; mes: ContagemDasFalhas } | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/resumo/falhas-da-ia", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Não foi possível contar as falhas da IA.");
      setDados({ semana: d.semana, mes: d.mes });
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível contar as falhas da IA.");
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="text-sm font-bold text-white">Falhas da análise com IA</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Vezes em que o modelo não deu a análise e ficou a estimativa do motor. O valor do pedido não muda: é sempre o da grelha.
      </p>
      {erro ? (
        <p className="mt-3 text-xs text-coral-texto">{erro}</p>
      ) : !dados ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> A carregar…
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([
            ["Últimos 7 dias", dados.semana],
            ["Últimos 30 dias", dados.mes],
          ] as const).map(([rotulo, c]) => (
            <div key={rotulo} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-xs text-slate-400">{rotulo}</p>
              <p className="mt-0.5 text-lg font-bold text-white">{c.total}</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                {MOTIVOS_DA_FALHA.filter((m) => c[m] > 0).map((m) => (
                  <li key={m}>
                    {NOME_DO_MOTIVO[m]}: {c[m]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
