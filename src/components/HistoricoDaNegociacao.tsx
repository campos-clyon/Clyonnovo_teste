"use client";

import {
  historicoDaNegociacao,
  haQuantoTempo,
  type MarcosDaNegociacao,
} from "@/lib/historico-negociacao";
import type { Proposta } from "@/lib/negociacao";

function euros(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

/**
 * Tudo o que se passou nesta negociação, numa linha do tempo.
 *
 * Vive fora do componente da negociação de propósito. Aquele deixa de ser
 * desenhado assim que o trabalho fecha — tem lá dentro os botões de propor e
 * aceitar, que já não fazem sentido — e o histórico ia embora com ele. O
 * registo do que aconteceu é justamente o que tem de ficar depois de acabar:
 * é a prova do que foi combinado, e é a única a que os dois lados têm acesso.
 *
 * Não guarda nada. Lê o que já está gravado na base, e por isso continua a
 * dizer o mesmo em qualquer ecrã e depois de qualquer refrescamento.
 */
export default function HistoricoDaNegociacao({
  propostas,
  marcos,
  euSou = "profissional",
}: {
  propostas: Proposta[];
  marcos?: MarcosDaNegociacao;
  euSou?: "cliente" | "profissional";
}) {
  const agora = new Date();
  const historico = historicoDaNegociacao(propostas, marcos ?? {}, euSou);
  if (historico.length === 0) return null;

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Histórico
      </h2>

      <ol className="mt-3 space-y-3">
        {historico.map((e, i) => (
          <li key={i} className="flex gap-3">
            {/* O ponto e a linha dão a leitura de sequência sem uma palavra
                a explicá-la. */}
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
              {i < historico.length - 1 && (
                <span className="mt-1 w-px flex-1 bg-slate-200" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span
                  className={`text-sm ${
                    e.estado === "pendente"
                      ? "font-semibold text-tinta"
                      : "text-slate-600"
                  }`}
                >
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
              {/* A hora exacta fica no title, para quem precisar dela. O que
                  se lê de relance é há quanto tempo. */}
              <time
                dateTime={e.quando}
                title={new Date(e.quando).toLocaleString("pt-PT")}
                className="text-xs text-tinta-fraca"
              >
                {haQuantoTempo(e.quando, agora)}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
