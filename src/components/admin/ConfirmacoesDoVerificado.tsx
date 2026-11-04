"use client";

import { CONFIRMACOES, COLUNAS_DA_CONFIRMACAO, estaVerificado } from "@/lib/parceiro-verificado";

/**
 * AS TRÊS CONFIRMAÇÕES DO «VERIFICADO», NO «EDITAR PERFIL» — 01-11-2026.
 *
 * NIF, identidade e contacto. Cada uma guarda a data e quem confirmou. O
 * cliente só lê «verificado pela CLYON» num parceiro com as três. Desde
 * 04-11-2026 (d10.2) aprovar pede as três já feitas, e por outra pessoa: a
 * assistente confirma, o administrador aprova. Ver `parceiro-verificado.ts`.
 */
type Linha = Record<string, unknown>;

function dia(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
}

export default function ConfirmacoesDoVerificado({
  p,
  onGuardar,
  ocupado,
}: {
  p: Linha;
  onGuardar: (corpo: Record<string, unknown>) => Promise<unknown>;
  ocupado: boolean;
}) {
  const verificado = estaVerificado(p);
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
      <p className="text-xs font-semibold text-slate-200">Verificado pela CLYON</p>
      <p className="mt-0.5 text-xs text-slate-400">
        {verificado
          ? "Tem as três confirmações: o cliente vê o selo «verificado pela CLYON»."
          : "O cliente só vê «verificado pela CLYON» com as três confirmadas."}{" "}
        Aprovar pede as três, e outra pessoa: quem confirma não aprova.
      </p>
      <ul className="mt-2 space-y-1.5">
        {CONFIRMACOES.map((c) => {
          const { em, por, rotulo } = COLUNAS_DA_CONFIRMACAO[c];
          const feito = p[em] != null;
          return (
            <li key={c} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className={feito ? "text-emerald-300" : "text-slate-400"}>
                {rotulo}:{" "}
                {feito ? `confirmado${p[por] ? ` por ${String(p[por])}` : ""}${dia(p[em]) ? ` · ${dia(p[em])}` : ""}` : "por confirmar"}
              </span>
              <button
                type="button"
                onClick={() => void onGuardar({ confirmacoes: { [c]: !feito } })}
                disabled={ocupado}
                className={`rounded-lg border px-2.5 py-1 font-medium disabled:opacity-50 ${
                  feito
                    ? "border-slate-700 text-slate-400 hover:bg-slate-800/60"
                    : "border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/40"
                }`}
              >
                {feito ? "Desfazer" : "Confirmei"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
