import { NOTA_DOS_PRECOS, linhaDeReferencia, linhaEscrita, referenciaDoPedido } from "@/lib/preco-de-referencia";

/**
 * O preço de referência do serviço escolhido, com o IVA ao lado, e a nota —
 * 29-10-2026 (S13, P10 (a)). As mesmas frases que a app recebe da R12
 * (`POST /api/cliente/referencia`): saem as duas de `preco-de-referencia.ts`.
 *
 * Na garagem, no sótão e na cave (29-10-2026) junta a faixa do volume
 * escolhido, e o topo dela com acesso difícil.
 */
export default function PrecoDeReferencia({
  servico,
  volume,
  acessoDificil,
}: {
  servico?: string | null;
  volume?: string | null;
  acessoDificil?: boolean;
}) {
  const linha = linhaDeReferencia(servico);
  if (!linha || !servico) return null;
  const extra = referenciaDoPedido({ servico, volume, acessoDificil }).linhas.slice(1);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">{linha}</p>
      {extra.map((l) => (
        <p key={l.rotulo} className="mt-1 text-sm font-semibold text-slate-900">
          {linhaEscrita(l)}
        </p>
      ))}
      <p className="mt-1 text-[11px] text-slate-600">{NOTA_DOS_PRECOS}</p>
    </div>
  );
}
