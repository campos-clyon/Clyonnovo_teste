"use client";

import { ESPACOS_DA_EMPRESA, FATURA_COM_NIF, PEDIDOS_DA_EMPRESA } from "@/lib/esvaziamento-de-empresa";

/**
 * As perguntas do esvaziamento de armazém, escritório ou loja — 15-11-2026
 * (d43): que espaço é e se é fora de horas. Quanto há para levar é o seletor
 * de volume de sempre; a fatura com NIF e a guia de transporte, as perguntas
 * do pedido no passo seguinte. As frases vivem em `esvaziamento-de-empresa.ts`.
 */
type Props = {
  espaco?: string;
  foraDeHoras?: boolean;
  onEspaco: (v: string) => void;
  onForaDeHoras: (v: boolean) => void;
};

const pilula = (activa: boolean) =>
  `min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-xs font-semibold transition ${
    activa ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white text-slate-800 hover:border-cyan-300"
  }`;

export default function PerguntasDaEmpresa({ espaco, foraDeHoras = false, onEspaco, onForaDeHoras }: Props) {
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">Que espaço é?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ESPACOS_DA_EMPRESA.map((e) => (
            <button key={e.id} type="button" aria-pressed={espaco === e.id} onClick={() => onEspaco(e.id)} className={pilula(espaco === e.id)}>
              {e.nome}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
        <input type="checkbox" checked={foraDeHoras} onChange={(ev) => onForaDeHoras(ev.target.checked)} className="h-4 w-4" />
        {PEDIDOS_DA_EMPRESA.foraDeHoras}
      </label>

      <p className="text-xs text-slate-500">
        {FATURA_COM_NIF} A guia de transporte pede-se no passo seguinte. Cada parceiro orça o espaço pelas fotografias.
      </p>
    </div>
  );
}
