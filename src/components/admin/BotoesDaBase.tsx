"use client";

import { useState } from "react";
import type { BaseDoPreco } from "@/lib/base-do-preco";
import { minimoDasHorasEmPalavras, trocaDeBase } from "@/lib/valor-por-base";

/**
 * OS TRÊS BOTÕES DA BASE — «Valor total / Por carga / Por hora» — e o aviso de
 * quando se troca com um número escrito (31-10-2026, parte 1 da ordem das
 * horas). O número nunca muda de significado em silêncio: aparece a conversão
 * proposta, e a base só muda com «Converter» ou «Manter o número».
 *
 * Usado no registo/edição de um pedido e no valor dos Trabalhos CLYON.
 */
export default function BotoesDaBase({
  base,
  valor,
  horasPrevistas,
  onBase,
  onValor,
  compacto = false,
}: {
  base: BaseDoPreco;
  valor: string;
  horasPrevistas?: number | null;
  onBase: (b: BaseDoPreco) => void;
  onValor: (v: string) => void;
  compacto?: boolean;
}) {
  const [pendente, setPendente] = useState<BaseDoPreco | null>(null);
  const troca = pendente ? trocaDeBase(valor, base, pendente, horasPrevistas) : null;

  const escolher = (b: BaseDoPreco) => {
    if (b === base) return setPendente(null);
    // Sem número escrito não há nada a reinterpretar: muda logo.
    if (!trocaDeBase(valor, base, b, horasPrevistas)) {
      setPendente(null);
      return onBase(b);
    }
    setPendente(b);
  };

  const v = Number(String(valor ?? "").replace(",", "."));
  return (
    <span className="block">
      <span className={`mt-1.5 flex ${compacto ? "gap-1.5" : "gap-2"}`} role="radiogroup" aria-label="O valor é">
        {(["total", "carga", "hora"] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={base === b}
            onClick={() => escolher(b)}
            className={`${compacto ? "flex-1 px-2 text-[11px]" : "px-3 text-xs"} rounded-lg border py-1.5 font-semibold transition ${
              base === b
                ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                : pendente === b
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-100"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
            }`}
          >
            {b === "total" ? "Valor total" : b === "carga" ? "Por carga" : "Por hora"}
          </button>
        ))}
      </span>
      {troca && pendente && (
        <span className="mt-1.5 block rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-100" role="alert">
          {troca.texto}
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {troca.convertido != null && (
              <button
                type="button"
                onClick={() => {
                  onValor(troca.convertido!.toFixed(2));
                  onBase(pendente);
                  setPendente(null);
                }}
                className="rounded-md bg-amber-500/80 px-2 py-1 font-semibold text-slate-900 hover:bg-amber-400"
              >
                Converter
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onBase(pendente);
                setPendente(null);
              }}
              className="rounded-md border border-amber-500/50 px-2 py-1 font-semibold text-amber-100 hover:bg-amber-500/20"
            >
              Manter o número
            </button>
            <button
              type="button"
              onClick={() => setPendente(null)}
              className="rounded-md px-2 py-1 text-amber-200/80 hover:underline"
            >
              Não trocar
            </button>
          </span>
        </span>
      )}
      {base === "hora" && !troca && (
        <span className="mt-1 block text-[11px] text-cyan-200/90">
          {minimoDasHorasEmPalavras(Number.isFinite(v) && v > 0 ? v : null)}
        </span>
      )}
    </span>
  );
}
