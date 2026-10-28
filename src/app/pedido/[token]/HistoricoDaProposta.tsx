"use client";

import { dataEHora, haQuantoTempo } from "@/lib/historico-negociacao";
import type { EventoNoEcra } from "@/lib/negociacao-no-ecra";

function euros(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

/**
 * A LINHA DO TEMPO DE UMA PROPOSTA, DO LADO DO CLIENTE — 28-10-2026 (d10).
 *
 * É o mesmo registo que o profissional vê do lado dele (`HistoricoDaNegociacao`),
 * mas chega já feito do servidor e já no preço do cliente: o browser deixou de
 * receber as propostas em bruto, que são valores do profissional. Este ecrã só
 * desenha — não converte nem soma nada.
 */
export default function HistoricoDaProposta({ eventos }: { eventos: EventoNoEcra[] }) {
  if (!eventos || eventos.length === 0) return null;
  const agora = new Date();

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Histórico</h2>

      <ol className="mt-3 space-y-3">
        {eventos.map((e, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center pt-1.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  e.estado === "pendente"
                    ? "bg-[#00B4CC]"
                    : e.quem === "sistema"
                      ? "bg-emerald-500"
                      : "bg-slate-300"
                }`}
                aria-hidden="true"
              />
              {i < eventos.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" aria-hidden="true" />}
            </div>

            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className={`text-sm ${e.estado === "pendente" ? "font-semibold text-tinta" : "text-slate-600"}`}>
                  {e.texto}
                </span>
                {e.valor != null && (
                  <span
                    className={
                      e.estado === "pendente" || e.quem === "sistema"
                        ? "text-sm font-bold text-tinta"
                        : "text-sm text-tinta-fraca line-through"
                    }
                  >
                    {euros(e.valor)}
                  </span>
                )}
              </div>
              <time dateTime={e.quando} className="text-xs text-tinta-fraca">
                {haQuantoTempo(e.quando, agora)} · {dataEHora(e.quando)}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
