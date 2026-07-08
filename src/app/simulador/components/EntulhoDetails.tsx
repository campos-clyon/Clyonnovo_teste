"use client";

import { useState } from "react";
import { Info, Truck, HelpCircle } from "lucide-react";

type EntulhoState = "ensacado" | "chao" | "misto" | "bigbags" | "unknown";
type EntulhoVolume = "carrinha" | "camiao_caixa" | "camiao_lixo" | "incerto";

interface EntulhoDetailsProps {
  state?: EntulhoState;
  quantity?: string;
  quantidadeEnsacados?: string;
  quantidadePorEnsacar?: string;
  quantidadeBigBags?: string;
  volume?: EntulhoVolume;
  onStateChange: (state: EntulhoState) => void;
  onQuantityChange: (quantity: string) => void;
  onQuantidadeEnsacadosChange?: (quantity: string) => void;
  onQuantidadePorEnsacarChange?: (quantity: string) => void;
  onQuantidadeBigBagsChange?: (quantity: string) => void;
  onVolumeChange?: (volume: EntulhoVolume) => void;
}

// Estimativas de volume (etiquetas visíveis ao cliente; a conversão para sacos
// é feita no formulário-pai e nunca é mostrada).
const VOLUME_TIERS: { key: EntulhoVolume; label: string; sub: string; scale: string }[] = [
  { key: "carrinha",     label: "Enche uma carrinha",         sub: "Poucos móveis / alguns sacos", scale: "text-base" },
  { key: "camiao_caixa", label: "Enche a caixa de um camião", sub: "Carga média",                  scale: "text-lg" },
  { key: "camiao_lixo",  label: "Enche um camião",            sub: "Grande volume",                scale: "text-xl" },
];

export default function EntulhoDetails({
  state,
  quantity,
  quantidadeEnsacados,
  quantidadePorEnsacar,
  quantidadeBigBags,
  volume,
  onStateChange,
  onQuantityChange,
  onQuantidadeEnsacadosChange,
  onQuantidadePorEnsacarChange,
  onQuantidadeBigBagsChange,
  onVolumeChange,
}: EntulhoDetailsProps) {
  // Modo "número exato" para quem sabe a contagem de sacos.
  const [exactMode, setExactMode] = useState(false);

  const stateBtn = (value: EntulhoState, label: string, extra = "") => (
    <button
      type="button"
      onClick={() => onStateChange(value)}
      className={`p-2.5 rounded-lg border-2 transition-all text-center ${extra} ${
        state === value ? "border-blue-500 bg-white" : "border-slate-200 bg-white hover:border-blue-300"
      }`}
    >
      <p className="text-xs font-semibold text-slate-900">{label}</p>
    </button>
  );

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-500" />
          Estado do entulho
        </h3>
        <p className="text-xs text-slate-600 mt-0.5">Confirme para preço correto</p>
      </div>

      {/* Estado do entulho */}
      <div className="grid grid-cols-2 gap-2.5">
        {stateBtn("ensacado", "Ensacado")}
        {stateBtn("chao", "No chão")}
        {stateBtn("misto", "Misto")}
        {stateBtn("bigbags", "Big Bags")}
      </div>

      {/* Quantidade - varia conforme o estado */}
      <div className="space-y-2 pt-1">
        {state === "misto" ? (
          <>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-900">Já ensacados</label>
              <input
                type="text"
                value={quantidadeEnsacados || ""}
                onChange={(e) => onQuantidadeEnsacadosChange?.(e.target.value)}
                placeholder="Ex: 50"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-900">Por ensacar</label>
              <input
                type="text"
                value={quantidadePorEnsacar || ""}
                onChange={(e) => onQuantidadePorEnsacarChange?.(e.target.value)}
                placeholder="Ex: 30"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              />
            </div>
          </>
        ) : state === "bigbags" ? (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-900">Número de big bags</label>
            <input
              type="text"
              inputMode="numeric"
              value={quantidadeBigBags || ""}
              onChange={(e) => onQuantidadeBigBagsChange?.(e.target.value)}
              placeholder="Ex: 3"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
            />
          </div>
        ) : (
          // ensacado / chao (ou ainda sem estado): estimativa por volume
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-900">Que quantidade tem?</label>

            {exactMode ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantity || ""}
                  onChange={(e) => onQuantityChange(e.target.value)}
                  placeholder="Ex: 100 sacos"
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setExactMode(false)}
                  className="text-[11px] font-medium text-blue-600 hover:underline"
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
                      onClick={() => onVolumeChange?.(tier.key)}
                      className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-center transition-all ${
                        volume === tier.key
                          ? "border-blue-500 bg-white"
                          : "border-slate-200 bg-white hover:border-blue-300"
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
                  onClick={() => onVolumeChange?.("incerto")}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 p-2.5 transition-all ${
                    volume === "incerto"
                      ? "border-blue-500 bg-white"
                      : "border-slate-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <HelpCircle className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-900">Não tenho a certeza</span>
                </button>
                <p className="text-[10px] text-slate-500">
                  Sem problema — o assistente confirma a quantidade e o preço consigo.
                </p>

                <button
                  type="button"
                  onClick={() => setExactMode(true)}
                  className="text-[11px] font-medium text-blue-600 hover:underline"
                >
                  Sei o número exato de sacos →
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
