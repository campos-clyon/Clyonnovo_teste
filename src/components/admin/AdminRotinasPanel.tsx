"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { diaMesEHoraEmLisboa } from "@/lib/hora-de-lisboa";
import { haQuantoTempo, type EstadoDaRotina } from "@/lib/rotinas";
import type { EspacoDaBase } from "@/lib/espaco-da-base";
import OQueAVitoriaFez from "@/components/admin/OQueAVitoriaFez";

/**
 * AS ROTINAS — 27-10-2026 (decisão d7).
 *
 * Seis das sete rotinas da Vercel só escreviam quando mexiam em alguma coisa:
 * «sem nada a fazer» e «morreu» pareciam iguais. Cada passagem fica agora
 * carimbada, e aqui vê-se a última de cada uma — a hora em Lisboa, se correu
 * bem, porquê quando não. Vermelha quando falhou ou passou mais de 2× o
 * intervalo sem passar; as vermelhas contam no selo das Configs. Só do
 * administrador.
 */
export default function AdminRotinasPanel() {
  const { token, ready } = useAdminAuth();
  const [estados, setEstados] = useState<EstadoDaRotina[] | null>(null);
  const [espaco, setEspaco] = useState<EspacoDaBase | null>(null);
  const [vistoEm, setVistoEm] = useState<number>(Date.now());
  const [erro, setErro] = useState("");

  // `silencioso`: a batida do relógio não mostra «a carregar» (não há aqui esse estado).
  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    void silencioso;
    try {
      const res = await fetch("/api/admin/rotinas", { headers: { Authorization: `Bearer ${token}` } });
      const d = (await res.json()) as { estados?: EstadoDaRotina[]; espaco?: EspacoDaBase | null; error?: string };
      if (!res.ok || !d.estados) {
        setErro(d.error ?? "As rotinas não carregaram.");
        return;
      }
      setEstados(d.estados);
      setEspaco(d.espaco ?? null);
      setVistoEm(Date.now());
      setErro("");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    if (ready && token) void carregar();
  }, [ready, token, carregar]);
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  if (erro) return <p className="text-sm text-red-300">{erro}</p>;
  if (!estados) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A carregar…
      </p>
    );
  }

  return (
    <>
    {/* d102 (24-11-2026): as somas das passagens nas últimas 24 h e, a pedido, dia a dia nos últimos 7. */}
    <OQueAVitoriaFez />
    {/* d1 (23-11-2026): o espaço da base no Railway; vermelho a partir dos 85 %. */}
    {espaco && (
      <p
        role={espaco.alarme ? "alert" : "status"}
        className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
          espaco.alarme ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-slate-700 bg-slate-800/40 text-slate-300"
        }`}
      >
        {espaco.alarme ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" aria-hidden="true" />
        )}
        <span>
          {espaco.frase}
          {espaco.maiores.length > 0 && (
            <span className="mt-1 block text-xs text-slate-400">
              Maiores: {espaco.maiores.map((m) => `${m.tabela} ${m.totalMb} MB`).join(" · ")}
            </span>
          )}
        </span>
      </p>
    )}
    <ul className="divide-y divide-slate-800">
      {estados.map((e) => {
        const quando = e.ultima ? new Date(vistoEm - e.ultima.haSegundos * 1000) : null;
        return (
          <li key={e.rotina.nome} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                {e.vermelha ? (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" aria-hidden="true" />
                ) : e.ultima ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
                )}
                {e.rotina.titulo}
              </p>
              <p className={`mt-0.5 break-words text-xs ${e.vermelha ? "text-red-300" : "text-slate-400"}`}>
                {e.porque}
              </p>
            </div>
            <p className="text-right text-xs text-slate-400">
              {quando ? (
                <>
                  {diaMesEHoraEmLisboa(quando)} (Lisboa)
                  <br />
                  há {haQuantoTempo(e.ultima?.haSegundos ?? 0)}
                  {e.ultima?.durouS != null && ` · demorou ${haQuantoTempo(e.ultima.durouS)}`}
                </>
              ) : (
                "sem passagens"
              )}
            </p>
          </li>
        );
      })}
    </ul>
    </>
  );
}
