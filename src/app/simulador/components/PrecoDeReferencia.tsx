import { NOTA_DOS_PRECOS, linhaDeReferencia } from "@/lib/preco-de-referencia";

/**
 * O preço de referência do serviço escolhido, com o IVA ao lado, e a nota —
 * 29-10-2026 (S13, P10 (a)). As mesmas frases que a app recebe da R12
 * (`POST /api/cliente/referencia`): saem as duas de `preco-de-referencia.ts`.
 */
export default function PrecoDeReferencia({ servico }: { servico?: string | null }) {
  const linha = linhaDeReferencia(servico);
  if (!linha) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">{linha}</p>
      <p className="mt-1 text-[11px] text-slate-600">{NOTA_DOS_PRECOS}</p>
    </div>
  );
}
