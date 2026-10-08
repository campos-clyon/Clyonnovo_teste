"use client";

import { lerValorFixo, TAXAS_DO_TRABALHO_CLYON, taxasDoTrabalhoClyon } from "@/lib/oferta-clyon";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";

/**
 * O VALOR E A TAXA DE UM TRABALHO CLYON — 08-10-2026.
 *
 * *«O pedido ao ser criado vem com o valor final que será cobrado pelo serviço
 * (…) ao criá-lo vamos colocar os 20 % de taxa; para o pro vai aparecer
 * "trabalho oferecido pela CLYON no valor de 350, ganhos estimados de 280,
 * deseja aceitar?"»* As taxas são três: 10, 15 ou 20 %.
 *
 * Usado ao oferecer (`FormularioDaOferta`) e ao corrigir depois (o cartão do
 * trabalho): o mesmo campo, as mesmas três taxas, e a mesma frase do que o
 * profissional vai ler — para quem escreve ver o número dele antes de enviar.
 */
const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export default function ValorETaxaDoTrabalho({
  valor,
  taxa,
  onValor,
  onTaxa,
  referencia = null,
}: {
  valor: string;
  taxa: number | null;
  onValor: (v: string) => void;
  onTaxa: (t: number) => void;
  /** O que a conta CLYON dava, só para orientar. */
  referencia?: number | null;
}) {
  const lido = lerValorFixo(valor);
  const ganhos = lido.ok && taxa != null ? quantoOProfissionalRecebe(lido.valor, taxasDoTrabalhoClyon(taxa)) : null;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
          Valor do trabalho, sem IVA
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => onValor(e.target.value)}
            placeholder={referencia != null ? referencia.toFixed(2).replace(".", ",") : "350,00"}
            className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-bold tabular-nums text-white outline-none focus:border-cyan-500"
          />
          <span className="text-sm text-slate-400">€</span>
        </span>
        <span className="mt-1 block text-xs text-slate-400">
          O que o cliente aceitou pagar (o IVA acresce).
          {referencia != null ? ` A conta CLYON dava ${euros(referencia)}.` : ""}
        </span>
        {valor.trim() !== "" && !lido.ok && <span className="mt-1 block text-xs text-red-300">{lido.erro}</span>}
      </label>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Taxa da CLYON</legend>
        <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="Taxa da CLYON">
          {TAXAS_DO_TRABALHO_CLYON.map((t) => {
            const escolhida = taxa != null && Math.abs(taxa - t) < 1e-9;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={escolhida}
                onClick={() => onTaxa(t)}
                className={`rounded-lg border px-4 py-2 text-sm font-bold tabular-nums transition ${
                  escolhida
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {Math.round(t * 100)} %
              </button>
            );
          })}
        </div>
      </fieldset>

      {lido.ok && ganhos != null && taxa != null && (
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          O profissional lê: <strong className="text-white">trabalho oferecido pela CLYON no valor de {euros(lido.valor)} — ganhos estimados de {euros(ganhos)}</strong>.
          Fica para a CLYON {euros(lido.valor - ganhos)}.
        </p>
      )}
    </div>
  );
}
