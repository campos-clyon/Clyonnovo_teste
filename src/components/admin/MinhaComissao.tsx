"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import TrabalhosDoAssistente from "./TrabalhosDoAssistente";

/**
 * A MINHA COMISSÃO — o que a assistente vê de si própria. 08-10-2026.
 *
 * *«Sim, mostra os períodos no painel dela.»* Os mesmos períodos e os mesmos
 * trabalhos que o administrador vê em «Assistentes», só de leitura: ela confere
 * trabalho a trabalho e descarrega o extracto, mas não paga nem anula nada.
 * Os números vêm de `/api/admin/sessao/eu?periodos=1`, que só responde sobre
 * a conta de quem chama.
 *
 * Uma janela por cima do painel, e não uma secção: as secções são o que o
 * administrador dá a cada conta, e isto é dela sempre.
 */
export default function MinhaComissao({
  token,
  onFechar,
}: {
  token: string | null;
  onFechar: () => void;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="minha-comissao-titulo"
        className="w-full max-w-3xl rounded-2xl border border-slate-700/60 bg-slate-900 p-4 shadow-2xl sm:p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="minha-comissao-titulo" className="text-base font-semibold text-white">
              A minha comissão
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              A sua parte é a sua percentagem do lucro da CLYON — o que ela fica de cada trabalho,
              sem IVA. Conta-se por períodos: de 23/09 a 15/10, depois de 1 a 15 e de 16 ao fim de
              cada mês, pelo dia em que cada trabalho ficou concluído. Quando um período fecha, fica
              «por pagar» até a CLYON o marcar como pago.
            </p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {/* Sem `gerir`: vê e descarrega, não paga nem anula. */}
        <TrabalhosDoAssistente token={token} fonte="/api/admin/sessao/eu?periodos=1" />
      </div>
    </div>
  );
}
