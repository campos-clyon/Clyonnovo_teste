"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Circle, Clock } from "lucide-react";
import type { CaminhoDaLinha, LinhaDoProntoParaReceber, ProntoParaReceber as Cartao } from "@/lib/pronto-para-receber";

/**
 * «PRONTO PARA RECEBER PEDIDOS» — d1 (CEO e dono, 18-11-2026).
 *
 * Um só cartão no Início, com o que falta a cada um: os Termos, o IBAN e o
 * titular, o MB WAY, o regime de IVA e — a quem faz entulho — a guia. A lista
 * vem pronta do servidor (`novoModelo.prontoParaReceber` da carteira, a mesma
 * que a app CLYON Pro recebe): este ecrã só a desenha e leva cada linha ao seu
 * sítio. Desaparece quando está tudo feito.
 */

function Icone({ linha }: { linha: LinhaDoProntoParaReceber }) {
  if (linha.estado === "feito") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />;
  if (linha.estado === "opcional") return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />;
  if (linha.estado === "por_verificar") return <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />;
  return (
    <AlertTriangle
      className={`mt-0.5 h-4 w-4 shrink-0 ${linha.impede ? "text-red-600" : "text-amber-600"}`}
      aria-hidden="true"
    />
  );
}

export default function ProntoParaReceber({
  cartao,
  onAbrir,
}: {
  cartao: Cartao | null | undefined;
  onAbrir: (caminho: CaminhoDaLinha) => void;
}) {
  if (!cartao || cartao.pronto) return null;
  const impede = !cartao.podePropor;

  return (
    <section
      className={`mb-4 rounded-2xl border p-4 shadow-sm ${
        impede ? "border-red-200 bg-red-50" : "border-amber-300 bg-amber-50"
      }`}
      aria-labelledby="pronto-para-receber"
    >
      <h2 id="pronto-para-receber" className="text-sm font-bold text-[#0B1929]">
        {cartao.titulo}
      </h2>
      <p className={`mt-0.5 text-xs leading-relaxed ${impede ? "text-red-800" : "text-slate-600"}`}>{cartao.resumo}</p>

      <ul className="mt-2 space-y-0.5">
        {cartao.linhas.map((l) => (
          <li key={l.id}>
            {l.botao ? (
              <button
                type="button"
                onClick={() => onAbrir(l.caminho)}
                className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-amber-100/60 active:bg-amber-100"
              >
                <Icone linha={l} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#0B1929]">{l.rotulo}</span>
                  <span className={`mt-0.5 block text-xs leading-relaxed ${l.impede ? "text-red-800" : "text-slate-600"}`}>
                    {l.detalhe}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-cyan-700">{l.botao}</span>
                </span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex items-start gap-2.5 px-2 py-2">
                <Icone linha={l} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#0B1929]">{l.rotulo}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{l.detalhe}</span>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
