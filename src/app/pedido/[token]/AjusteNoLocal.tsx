"use client";

import { AlertTriangle, Phone } from "lucide-react";
import { Miniatura } from "@/components/Anexo";
import { precoDoCliente } from "@/lib/preco-do-cliente";
import type { ModeloDoPreco } from "@/lib/iva-incluido";
import type { Taxas } from "@/lib/taxas-plataforma";
import type { VistaDoAjuste } from "@/lib/ajuste-no-local";

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
 */

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export default function AjusteNoLocal({
  ajuste,
  profissionalNome,
  profissionalTelefone,
  taxas,
  modelo,
  porCarga,
  aEnviar,
  soParaVer,
  onResponder,
}: {
  ajuste: NonNullable<VistaDoAjuste["pendente"]>;
  profissionalNome: string;
  profissionalTelefone: string | null;
  taxas: Taxas;
  modelo: ModeloDoPreco;
  porCarga: boolean;
  aEnviar: boolean;
  soParaVer?: boolean;
  onResponder: (resposta: "aprovar_ajuste" | "recusar_ajuste") => void;
}) {
  const antes = precoDoCliente(ajuste.valorAntigo, taxas, modelo);
  const depois = precoDoCliente(ajuste.valorNovo, taxas, modelo);
  const ate = new Date(ajuste.expiraEm);
  const hora = Number.isFinite(ate.getTime())
    ? ate.toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" })
    : "23:59";

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
          <span className="text-right tabular-nums text-slate-600">{euros(antes.aPagar)}</span>
          <span className="text-right font-bold tabular-nums text-amber-800">{euros(depois.aPagar)}</span>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-amber-900">
        {antes.ivaIncluido ? "Valores com IVA incluído." : "Valores sem IVA."}
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
      <p className="mt-3 text-xs leading-relaxed text-amber-900">
        O valor só muda se aceitar. Se não aceitar, ou não responder até às {hora} de hoje, fica o valor que
        combinou.
      </p>
    </div>
  );
}
