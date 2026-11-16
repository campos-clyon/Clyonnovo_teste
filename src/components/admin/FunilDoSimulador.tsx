"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  percentagemDoPasso,
  type ContagemDoFunil,
  type SemanaDoFunil,
} from "@/lib/funil-do-simulador";

/**
 * O SIMULADOR PASSO A PASSO, NO INÍCIO — d56, 16-11-2026.
 *
 * Por semana (segunda a domingo, hora de Lisboa): quantos abriram o
 * simulador, quantos passaram ao passo 2, ao passo 3, e quantos carregaram em
 * Enviar — de todos, só dos anúncios, ou só do resto. A conta é do servidor
 * (`/api/admin/resumo/funil-do-simulador`).
 */

const ORIGENS = [
  { id: "todos", rotulo: "Todos" },
  { id: "pago", rotulo: "Anúncios" },
  { id: "organico", rotulo: "Orgânico" },
] as const;
type Origem = (typeof ORIGENS)[number]["id"];

const ETAPAS: Array<{ id: keyof ContagemDoFunil; rotulo: string }> = [
  { id: "entradas", rotulo: "Entradas" },
  { id: "passo_2", rotulo: "Passo 2" },
  { id: "passo_3", rotulo: "Passo 3" },
  { id: "enviar", rotulo: "Enviados" },
];

/** «16/11» a partir de «2026-11-16». */
function diaCurto(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

export default function FunilDoSimulador() {
  const { token, ready } = useAdminAuth();
  const [semanas, setSemanas] = useState<SemanaDoFunil[] | null>(null);
  const [origem, setOrigem] = useState<Origem>("todos");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/resumo/funil-do-simulador", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados?.error || "Não foi possível carregar o funil do simulador.");
      setSemanas(Array.isArray(dados.semanas) ? dados.semanas : []);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o funil do simulador.");
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">O simulador, passo a passo</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Por semana, de segunda a domingo. Cada passo diz quantos chegaram lá e a percentagem do passo anterior.
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Origem da visita">
          {ORIGENS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOrigem(o.id)}
              aria-pressed={origem === o.id}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                origem === o.id ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro ? (
        <p className="mt-3 text-xs text-coral-texto">{erro}</p>
      ) : !semanas ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> A carregar…
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1.5 pr-3 font-medium">Semana</th>
                {ETAPAS.map((e) => (
                  <th key={e.id} className="py-1.5 pr-3 font-medium">
                    {e.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semanas.map((s, i) => {
                const c = s[origem];
                return (
                  <tr key={s.inicio} className="border-t border-slate-800 text-slate-200">
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {i === 0 ? "Esta semana" : `desde ${diaCurto(s.inicio)}`}
                    </td>
                    {ETAPAS.map((e, j) => (
                      <td key={e.id} className="py-1.5 pr-3 whitespace-nowrap">
                        <span className="font-semibold text-white">{c[e.id]}</span>
                        {j > 0 && (
                          <span className="ml-1 text-slate-500">{percentagemDoPasso(c[e.id], c[ETAPAS[j - 1].id])}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-500">
            Os passos contam-se desde 16/11/2026; antes disso só há as entradas. «Anúncios» são as visitas que chegaram por um
            anúncio pago; sem a campanha no endereço nem o consentimento de marketing, uma visita do anúncio conta como orgânica.
          </p>
        </div>
      )}
    </section>
  );
}
