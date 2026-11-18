"use client";

import type { ComoRecebe } from "@/lib/como-recebe-no-novo-modelo";

/**
 * «COMO RECEBE» — d4 (CEO e dono, 18-11-2026). No trabalho contratado do modelo
 * de 15-11: a forma que o cliente escolheu para lhe pagar, a frase do valor e o
 * que passa à CLYON, até quando. Tudo vem do servidor (`comoRecebe` de
 * /api/profissionais/meus-pedidos); a app CLYON Pro lê o mesmo objecto.
 */
export function ComoRecebeDoTrabalho({ c }: { c: ComoRecebe }) {
  const corDaLinha =
    c.estado === "em_atraso"
      ? "border-red-200 bg-red-50 text-red-800"
      : c.estado === "passado"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <h2 className="text-base font-bold text-slate-800">{c.titulo}</h2>
      <p className="mt-1 leading-relaxed text-slate-700">{c.formaTexto}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{c.fraseDoValor}.</p>
      {c.linhaDoValor && (
        <p className={`mt-2 rounded-lg border px-3 py-2 text-sm font-semibold ${corDaLinha}`}>{c.linhaDoValor}</p>
      )}
    </section>
  );
}
