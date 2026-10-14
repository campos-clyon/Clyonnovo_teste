"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { aindaNaoEstaNaData, diaDoTrabalhoPorExtenso } from "@/lib/ainda-nao-esta-na-data";

/**
 * A TELA VERMELHA DOS TRABALHOS QUE AINDA NÃO ESTÃO NA DATA — 14-10-2026.
 *
 * *«Os pedidos futuros devem ter uma proteção extra para serem confirmados
 * que foram realizados ou apagados.»* Antes de dar por feito, apagar ou pagar
 * ao profissional um trabalho cujo dia ainda não chegou, pergunta-se — a
 * vermelho, com o dia de cada um à vista. Os outros passam como antes.
 *
 * Uso: `const { confirmarSeFuturo, aviso } = useAvisoDeDataFutura();` — põe-se
 * `{aviso}` no ecrã e, antes da acção,
 * `if (!(await confirmarSeFuturo([{ pedidoId, quando }], "dar este trabalho por feito"))) return;`
 */

export type TrabalhoComData = { pedidoId: number; quando: string | Date | null | undefined };

type Pendente = {
  futuros: Array<{ pedidoId: number; quando: string | Date }>;
  accao: string;
  responder: (sim: boolean) => void;
};

export function useAvisoDeDataFutura(): {
  confirmarSeFuturo: (trabalhos: TrabalhoComData[], accao: string) => Promise<boolean>;
  aviso: ReactNode;
} {
  const [pendente, setPendente] = useState<Pendente | null>(null);

  const confirmarSeFuturo = useCallback((trabalhos: TrabalhoComData[], accao: string) => {
    const futuros = trabalhos.flatMap((t) =>
      t.quando != null && aindaNaoEstaNaData(t.quando) ? [{ pedidoId: t.pedidoId, quando: t.quando }] : [],
    );
    if (futuros.length === 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setPendente({ futuros, accao, responder: resolve }));
  }, []);

  const responder = useCallback(
    (sim: boolean) => {
      pendente?.responder(sim);
      setPendente(null);
    },
    [pendente],
  );

  return {
    confirmarSeFuturo,
    aviso: pendente ? <TelaVermelha pendente={pendente} onResponder={responder} /> : null,
  };
}

function TelaVermelha({ pendente, onResponder }: { pendente: Pendente; onResponder: (sim: boolean) => void }) {
  // Esc é «não»: na dúvida, não se faz.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResponder(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onResponder]);

  const um = pendente.futuros.length === 1;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="aviso-de-data-futura"
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-red-500 bg-red-950 p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-red-400" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="aviso-de-data-futura" className="text-lg font-extrabold uppercase tracking-wide text-red-100">
              {um ? "Este pedido ainda não está na data" : `${pendente.futuros.length} pedidos ainda não estão na data`}
            </h2>
            <ul className="mt-3 space-y-1 text-sm text-red-100">
              {pendente.futuros.map((t) => (
                <li key={t.pedidoId}>
                  <strong>#{t.pedidoId}</strong> — marcado para {diaDoTrabalhoPorExtenso(t.quando)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-red-200">
              Vai {pendente.accao}, e {um ? "o trabalho ainda não aconteceu" : "estes trabalhos ainda não aconteceram"}.
              Tem a certeza que quer continuar?
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => onResponder(false)}
            className="rounded-lg border border-red-300/40 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-900"
          >
            Não, voltar
          </button>
          <button
            type="button"
            onClick={() => onResponder(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
          >
            Sim, continuar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
}
