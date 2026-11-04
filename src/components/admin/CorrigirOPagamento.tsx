"use client";

import { useState } from "react";
import {
  MOTIVO_DA_CORRECCAO_MAXIMO,
  PEDE_O_MOTIVO_DA_CORRECCAO,
  lerCorreccaoDoPagamento,
} from "@/lib/corrigir-pagamento-registado";
import type { ParaQue } from "@/lib/pagamento-declarado";

/**
 * CORRIGIR UM PAGAMENTO REGISTADO — 04-11-2026 (d9, dono).
 *
 * *«Só o administrador pode corrigir, com um motivo obrigatório (como no "sem
 * factura"): a factura (com ou sem); o valor que o cliente pagou ao
 * profissional.»* Fechada por omissão: abre-se quando há um erro a corrigir.
 * O servidor refaz a conta e escreve no histórico o antes, o depois e o
 * motivo (`/api/admin/pagamentos/corrigir-pagamento`).
 */
export type CorreccaoDoPagamento = { semFactura: boolean; valor: number; motivo: string };

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export default function CorrigirOPagamento({
  correccao,
  semFactura,
  emMao,
  ocupado,
  onGuardar,
}: {
  correccao: {
    valorRegistado: number | null;
    declarado: ParaQue | null;
    comFactura: number | null;
    semFactura: number | null;
  };
  /** A marca de agora. */
  semFactura: boolean;
  /** Pago ao profissional, em mão: o valor é o que o cliente lhe pagou. */
  emMao: boolean;
  ocupado: boolean;
  onGuardar: (c: CorreccaoDoPagamento) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [sem, setSem] = useState(semFactura);
  const [valor, setValor] = useState(
    correccao.valorRegistado != null ? String(correccao.valorRegistado.toFixed(2)).replace(".", ",") : "",
  );
  const [motivo, setMotivo] = useState("");

  // A marca e a declaração não dizem o mesmo? Diz-se, que é o caso a corrigir.
  const contraditorio =
    correccao.declarado != null && (correccao.declarado === "sem_factura") !== semFactura;
  const lido = lerCorreccaoDoPagamento({ semFactura: sem, valor, motivo });
  const referencia = sem ? correccao.semFactura : correccao.comFactura;

  if (!aberta) {
    return (
      <div className="mt-3 border-t border-slate-800 pt-3">
        <button
          onClick={() => setAberta(true)}
          disabled={ocupado}
          className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Corrigir o pagamento registado
        </button>
        {contraditorio && (
          <span className="ml-2 text-[11px] text-amber-300">
            Marcado {semFactura ? "sem" : "com"} fatura, declarado {semFactura ? "com" : "sem"} fatura.
          </span>
        )}
      </div>
    );
  }

  return (
    <section className="mt-3 space-y-2 border-t border-slate-800 pt-3 sm:max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Corrigir o pagamento registado</p>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Hoje: {semFactura ? "sem fatura" : "com fatura"}
        {contraditorio ? ` (declarado ${semFactura ? "com" : "sem"} fatura)` : ""}
        {correccao.valorRegistado != null ? `, ${euros(correccao.valorRegistado)} registados` : ""}. A conta refaz-se
        com o que gravar, e o histórico guarda o antes, o depois e o motivo.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {[false, true].map((s) => (
          <button
            key={String(s)}
            onClick={() => setSem(s)}
            disabled={ocupado}
            aria-pressed={sem === s}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-60 ${
              sem === s ? "border-amber-400 bg-amber-500/15 text-amber-100" : "border-slate-600 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {s ? "Sem fatura" : "Com fatura"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-slate-200">
          {emMao ? "Quanto o cliente pagou ao profissional" : "Quanto o cliente pagou"}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="mt-1 w-40 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500"
        />
        {referencia != null && (
          <span className="ml-2 text-[11px] text-slate-400">
            {sem ? "Sem fatura" : "Com fatura"}, a conta dá {euros(referencia)}.
          </span>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-amber-200">Motivo da correção (obrigatório)</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MOTIVO_DA_CORRECCAO_MAXIMO}
          rows={2}
          placeholder="Ex.: o cliente pagou com IVA e o registo ficou sem fatura"
          className="mt-1 w-full rounded-lg border border-amber-500/40 bg-slate-900 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
        />
      </label>
      {!lido.ok && (motivo.length > 0 || valor.length === 0) && (
        <p className="text-[11px] text-red-300">{lido.erro || PEDE_O_MOTIVO_DA_CORRECCAO}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            if (lido.ok) onGuardar(lido.pedido);
          }}
          disabled={ocupado || !lido.ok}
          className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Guardar a correção
        </button>
        <button
          onClick={() => {
            setAberta(false);
            setSem(semFactura);
            setMotivo("");
          }}
          disabled={ocupado}
          className="rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
