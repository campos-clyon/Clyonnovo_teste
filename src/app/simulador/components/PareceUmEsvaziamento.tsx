"use client";

import { PERGUNTA_DO_ESVAZIAMENTO } from "@/lib/parece-um-esvaziamento";
import { nomeDoServico } from "@/lib/service-categories";

/**
 * «Parece um esvaziamento» — 15-11-2026 (d43). Aparece uma vez, quando a
 * lista ou o texto dizem que é o espaço todo; a pessoa decide. A regra vive
 * em `parece-um-esvaziamento.ts`.
 */
type Props = {
  para: string;
  onSim: () => void;
  onNao: () => void;
};

export default function PareceUmEsvaziamento({ para, onSim, onNao }: Props) {
  return (
    <div role="status" className="rounded-xl border-2 border-cyan-200 bg-cyan-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{PERGUNTA_DO_ESVAZIAMENTO}</p>
      <p className="mt-1 text-xs text-slate-600">
        Passa a {nomeDoServico(para).toLowerCase()}: o parceiro orça o espaço inteiro, com a desmontagem, o carregamento e o transporte.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onSim}
          className="min-h-[44px] rounded-xl bg-acao px-4 py-2 text-sm font-semibold text-white transition hover:bg-acao-hover"
        >
          Sim, o espaço todo
        </button>
        <button
          type="button"
          onClick={onNao}
          className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-cyan-300"
        >
          Não, é só isto
        </button>
      </div>
    </div>
  );
}
