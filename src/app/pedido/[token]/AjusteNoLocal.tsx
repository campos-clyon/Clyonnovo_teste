"use client";

import { AlertTriangle, Phone } from "lucide-react";
import { Miniatura } from "@/components/Anexo";
import type { NegociacaoNoEcra } from "@/lib/negociacao-no-ecra";

/**
 * O PEDIDO DE AJUSTE, VISTO PELO CLIENTE — 18-10-2026.
 *
 * Em âmbar e por cima de tudo: enquanto está por responder, é a única coisa
 * que interessa neste ecrã. O profissional está à porta e o que ficou dito ao
 * telefone passa a ficar escrito aqui, com o «sim» do cliente.
 *
 * Mostra-se a conta inteira, antes e depois — o que sai da carteira é o total,
 * não a base. E diz-se com todas as letras que não muda sem ele aceitar.
 * Ver `docs/plano-ajuste-no-local.md` §6.
 *
 * OS NÚMEROS CHEGAM FEITOS — 28-10-2026 (d10). Recebia o valor do
 * profissional (antes e depois) e as taxas, e fazia a conta aqui; agora vêm do
 * servidor os textos do preço do cliente e a regra do prazo, os mesmos da app
 * de cliente (`negociacao-no-ecra.ts`).
 */
export default function AjusteNoLocal({
  ajuste,
  profissionalNome,
  profissionalTelefone,
  porCarga,
  aEnviar,
  soParaVer,
  onResponder,
}: {
  ajuste: NonNullable<NegociacaoNoEcra["ajuste"]>;
  profissionalNome: string;
  profissionalTelefone: string | null;
  porCarga: boolean;
  aEnviar: boolean;
  soParaVer?: boolean;
  onResponder: (resposta: "aprovar_ajuste" | "recusar_ajuste") => void;
}) {
  return (
    <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-left">
      <h3 className="flex items-center gap-2 text-base font-bold text-amber-900">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        {profissionalNome} pede para ajustar o valor
      </h3>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-amber-950">«{ajuste.motivo}»</p>

      {ajuste.fotos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ajuste.fotos.map((url) => (
            <Miniatura key={url} url={url} className="aspect-square w-full" tamanho="(max-width: 640px) 50vw, 300px" />
          ))}
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-white text-sm">
        <div className="grid grid-cols-3 border-b border-amber-100 bg-amber-50/60 px-3 py-1.5 text-xs font-semibold text-amber-900">
          <span />
          <span className="text-right">Estava</span>
          <span className="text-right">Fica</span>
        </div>
        <div className="grid grid-cols-3 px-3 py-2">
          <span className="font-semibold text-slate-900">Total a pagar</span>
          <span className="text-right tabular-nums text-slate-600">{ajuste.antes.principal}</span>
          <span className="text-right font-bold tabular-nums text-amber-800">{ajuste.depois.principal}</span>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-amber-900">
        {ajuste.depois.detalhe}
        {porCarga ? " O valor é por carga, como no seu pedido." : ""}
      </p>

      {!soParaVer && (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={aEnviar}
            onClick={() => onResponder("aprovar_ajuste")}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 px-4 font-semibold text-white transition active:bg-emerald-700 disabled:opacity-60"
          >
            Aceito — o valor passa a ser este
          </button>
          <button
            type="button"
            disabled={aEnviar}
            onClick={() => onResponder("recusar_ajuste")}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 font-semibold text-slate-800 transition active:bg-slate-50 disabled:opacity-60"
          >
            Não aceito
          </button>
          {profissionalTelefone && (
            <a
              href={`tel:${profissionalTelefone}`}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-300 bg-white px-4 font-semibold text-amber-900 transition active:bg-amber-50"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Ligar a {profissionalNome}
            </a>
          )}
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-amber-900">{ajuste.regraTexto}</p>
    </div>
  );
}
