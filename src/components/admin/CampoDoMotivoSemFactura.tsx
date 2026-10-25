"use client";

import { MOTIVO_SEM_FACTURA_MAXIMO, PEDE_O_MOTIVO_SEM_FACTURA, lerMotivoSemFactura } from "@/lib/sem-factura";

/**
 * O MOTIVO DE UM PAGAMENTO SEM FACTURA — 25-10-2026 (decisão d19).
 *
 * O mesmo campo onde quer que se marque ou se declare «Sem factura»: os
 * Pagamentos e o «Está feito» das Negociações (no cartão e em lote). Sem o
 * motivo escrito, a rota não grava — e o campo di-lo antes de se carregar.
 */
export default function CampoDoMotivoSemFactura({
  valor,
  onMudar,
}: {
  valor: string;
  onMudar: (v: string) => void;
}) {
  const emFalta = !lerMotivoSemFactura(valor).ok;
  return (
    <label className="block w-full">
      <span className="text-xs font-semibold text-amber-200">Motivo de ser sem factura (obrigatório)</span>
      <textarea
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        maxLength={MOTIVO_SEM_FACTURA_MAXIMO}
        rows={2}
        placeholder="Ex.: o cliente não quis factura e pagou em numerário"
        className="mt-1 w-full rounded-lg border border-amber-500/40 bg-slate-900 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
      />
      {emFalta && <span className="mt-1 block text-[11px] text-red-300">{PEDE_O_MOTIVO_SEM_FACTURA}</span>}
    </label>
  );
}
