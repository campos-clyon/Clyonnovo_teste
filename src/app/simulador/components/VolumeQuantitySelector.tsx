"use client";

import { useState } from "react";
import { Truck, HelpCircle } from "lucide-react";

export type VolumeTier = "carrinha" | "camiao_caixa" | "camiao_lixo" | "incerto";

const VOLUME_TIERS: { key: VolumeTier; label: string; sub: string; scale: string }[] = [
  { key: "carrinha",     label: "Enche uma carrinha",         sub: "Poucos itens",  scale: "text-base" },
  { key: "camiao_caixa", label: "Enche a caixa de um camião", sub: "Volume médio",  scale: "text-lg" },
  { key: "camiao_lixo",  label: "Enche um camião",            sub: "Grande volume", scale: "text-xl" },
];

interface Props {
  title?: string;
  volume?: VolumeTier;
  exactValue?: string;
  exactLabel: string;
  exactPlaceholder: string;
  onVolumeChange: (volume: VolumeTier) => void;
  onExactChange: (value: string) => void;
}

/**
 * Seletor visual de quantidade ("Que quantidade tem?"), partilhado entre
 * categorias do simulador. Só descreve o volume em linguagem simples ao
 * cliente — nunca faz conversão numérica escondida aqui (isso é feito pelo
 * chamador quando existir uma fórmula validada, como no entulho).
 */
export default function VolumeQuantitySelector({
  title = "Que quantidade tem?",
  volume,
  exactValue,
  exactLabel,
  exactPlaceholder,
  onVolumeChange,
  onExactChange,
}: Props) {
  const [exactMode, setExactMode] = useState(!!exactValue);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900">{title}</label>

      {exactMode ? (
        <div className="space-y-1.5">
          <input
            type="text"
            value={exactValue || ""}
            onChange={(e) => onExactChange(e.target.value)}
            placeholder={exactPlaceholder}
            autoFocus
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
          <button
            type="button"
            onClick={() => setExactMode(false)}
            className="text-xs font-medium text-cyan-600 hover:underline"
          >
            ← Estimar por volume
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {VOLUME_TIERS.map((tier) => (
              <button
                key={tier.key}
                type="button"
                onClick={() => onVolumeChange(tier.key)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-center transition-all ${
                  volume === tier.key
                    ? "border-cyan-500 bg-cyan-50/60"
                    : "border-slate-200 bg-white hover:border-cyan-300"
                }`}
              >
                <Truck className={`${tier.scale} text-slate-500`} strokeWidth={1.5} />
                <span className="text-[11px] font-semibold leading-tight text-slate-900">{tier.label}</span>
                <span className="text-[10px] leading-tight text-slate-500">{tier.sub}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onVolumeChange("incerto")}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 p-2.5 transition-all ${
              volume === "incerto"
                ? "border-cyan-500 bg-cyan-50/60"
                : "border-slate-200 bg-white hover:border-cyan-300"
            }`}
          >
            <HelpCircle className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-900">Não tenho a certeza</span>
          </button>
          <p className="text-[11px] text-slate-500">
            Sem problema — o assistente confirma a quantidade e o preço consigo.
          </p>

          <button
            type="button"
            onClick={() => setExactMode(true)}
            className="text-xs font-medium text-cyan-600 hover:underline"
          >
            {exactLabel} →
          </button>
        </>
      )}
    </div>
  );
}
