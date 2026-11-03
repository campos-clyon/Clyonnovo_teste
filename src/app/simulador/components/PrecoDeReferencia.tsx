import {
  NOTA_DOS_PRECOS,
  linhaEscrita,
  referenciaDoSimuladorDoSite,
  type FormularioDoSimulador,
} from "@/lib/preco-de-referencia";

/**
 * O preço de referência do serviço escolhido, com o IVA ao lado, e a nota —
 * 29-10-2026 (S13, P10 (a)). As mesmas frases que a app recebe da R12
 * (`POST /api/cliente/referencia`): saem as duas de `preco-de-referencia.ts`.
 *
 * Na garagem, no sótão e na cave (29-10-2026) junta a faixa do volume
 * escolhido, e o topo dela com acesso difícil.
 *
 * Desde 03-11-2026 (d1, a orquestra) lê o formulário inteiro pelo MESMO
 * caminho da R12 (`referenciaDoSimuladorDoSite`): o entulho pela quantidade, o
 * andar, o elevador e o estacionamento — e diz porquê. Para o mesmo pedido, o
 * site e a app mostram o mesmo número.
 */
export default function PrecoDeReferencia({
  servico,
  formulario,
}: {
  servico?: string | null;
  formulario: FormularioDoSimulador;
}) {
  if (!servico) return null;
  const r = referenciaDoSimuladorDoSite({ ...formulario, serviceType: servico });
  if (!r || r.linhas.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      {r.linhas.map((l) => (
        <p key={l.rotulo} className="mt-1 text-sm font-semibold text-slate-900 first:mt-0">
          {linhaEscrita(l)}
        </p>
      ))}
      {r.porque.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {r.porque.map((p) => (
            <li key={p} className="text-xs text-slate-700">
              {p}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-slate-600">{NOTA_DOS_PRECOS}</p>
    </div>
  );
}
