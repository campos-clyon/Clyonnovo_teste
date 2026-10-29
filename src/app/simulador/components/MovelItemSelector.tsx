"use client";

import { Minus, Plus } from "lucide-react";
import {
  ROTULO_DO_TOTAL_DOS_ITENS,
  contaDosItens,
  precoDoItem,
  totalDosItens,
} from "@/lib/preco-de-referencia";

interface MovelItemSelectorProps {
  mode?: "carga" | "item";
  pequeno?: number;
  medio?: number;
  grande?: number;
  onModeChange: (mode: "carga" | "item") => void;
  onPequenoChange: (n: number) => void;
  onMedioChange: (n: number) => void;
  onGrandeChange: (n: number) => void;
}

const ITEM_TIERS = [
  {
    key: "pequeno" as const,
    label: "Pequeno",
    examples: "Micro-ondas, forno, mesinha de cabeceira",
    max: 20,
  },
  {
    key: "medio" as const,
    label: "Médio",
    examples: "Fogão, frigorífico bar, cadeirão",
    max: 99,
  },
  {
    key: "grande" as const,
    label: "Grande",
    examples: "Sofá, armário, frigorífico, máquina de lavar",
    max: 99,
  },
];

function CounterInput({
  value,
  max,
  onChange,
  nome,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  /** De que é a quantidade — «itens pequenos». Sem isto, um leitor de ecrã
      anunciava três pares de "botão" sem dizer de quê. */
  nome: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`Diminuir quantidade de ${nome}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span aria-live="polite" className="w-6 text-center text-sm font-semibold text-slate-900">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Aumentar quantidade de ${nome}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Seletor Carga vs Item para recolha de móveis.
 *
 * Modo "Carga": o cliente não sabe ou prefere estimativa por volume (comportamento padrão).
 * Modo "Item": preço de referência por tamanho — os valores vêm de
 *   `PRECO_POR_ITEM` (precos-publicos.ts) e o texto, com o IVA ao lado, de
 *   `preco-de-referencia.ts` — o mesmo que a app recebe da R12 (S13, 29-10-2026).
 */
export default function MovelItemSelector({
  mode,
  pequeno = 0,
  medio = 0,
  grande = 0,
  onModeChange,
  onPequenoChange,
  onMedioChange,
  onGrandeChange,
}: MovelItemSelectorProps) {
  const onChangeMap = {
    pequeno: onPequenoChange,
    medio: onMedioChange,
    grande: onGrandeChange,
  };
  const valueMap = { pequeno, medio, grande };

  const itens = { pequeno, medio, grande };
  const totalItems = contaDosItens(itens).quantos;
  const total = totalDosItens(itens);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-900">Como prefere indicar os itens?</label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onModeChange("carga")}
          className={`rounded-xl border-2 p-3 text-left transition-all ${
            mode !== "item"
              ? "border-cyan-500 bg-cyan-50/60"
              : "border-slate-200 bg-white hover:border-cyan-300"
          }`}
        >
          <p className="text-xs font-semibold text-slate-900">Por volume</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Não tenho a certeza da quantidade</p>
        </button>
        <button
          type="button"
          onClick={() => onModeChange("item")}
          className={`rounded-xl border-2 p-3 text-left transition-all ${
            mode === "item"
              ? "border-cyan-500 bg-cyan-50/60"
              : "border-slate-200 bg-white hover:border-cyan-300"
          }`}
        >
          <p className="text-xs font-semibold text-slate-900">Por item</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Sei exatamente o que tenho</p>
        </button>
      </div>

      {mode === "item" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          {ITEM_TIERS.map((tier) => (
            <div key={tier.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{tier.label}</span>
                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-acao">
                    {precoDoItem(tier.key)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">{tier.examples}</p>
              </div>
              <CounterInput
                value={valueMap[tier.key]}
                max={tier.max}
                onChange={onChangeMap[tier.key]}
                nome={`itens ${tier.label.toLowerCase()}s`}
              />
            </div>
          ))}

          {totalItems > 0 && (
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
              <span className="text-right text-sm font-bold text-slate-900">
                {ROTULO_DO_TOTAL_DOS_ITENS}: {total}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
