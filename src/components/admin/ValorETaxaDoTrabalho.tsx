"use client";

import { lerValorFixo, TAXAS_DA_OFERTA, TAXAS_DO_TRABALHO_CLYON, taxasDoTrabalhoClyon } from "@/lib/oferta-clyon";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { precoDoCliente } from "@/lib/preco-do-cliente";

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
 *
 * E O QUE A CLYON GANHA, À VISTA — 10-10-2026. *«Quando eu colocar o valor e
 * marcar a % ele devia já dizer quanto a CLYON vai ganhar.»* Dizia-o, no fim
 * da frase pequena do profissional, e não se via. Agora cada taxa diz o seu
 * ganho mal o valor está escrito — para comparar antes de escolher —, e a
 * escolhida dá os três números lado a lado, o da CLYON primeiro.
 */
const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** O que fica para a CLYON: o valor menos o que o profissional recebe. */
const ganhoDaClyon = (valor: number, taxa: number) =>
  valor - quantoOProfissionalRecebe(valor, taxasDoTrabalhoClyon(taxa));

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
                className={`flex flex-col items-center rounded-lg border px-4 py-2 tabular-nums transition ${
                  escolhida
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="text-sm font-bold">{Math.round(t * 100)} %</span>
                {lido.ok && (
                  <span className={`text-[11px] font-semibold ${escolhida ? "text-emerald-300" : "text-slate-400"}`}>
                    CLYON {euros(ganhoDaClyon(lido.valor, t))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      {lido.ok && ganhos != null && taxa != null && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">A CLYON ganha</p>
              <p className="text-lg font-bold tabular-nums text-emerald-300">{euros(lido.valor - ganhos)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">O profissional recebe</p>
              <p className="text-lg font-bold tabular-nums text-white">{euros(ganhos)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">O cliente paga</p>
              <p className="text-lg font-bold tabular-nums text-white">
                {euros(precoDoCliente(lido.valor, TAXAS_DA_OFERTA, "iva_incluido").total)}
              </p>
              <p className="text-[10px] text-slate-500">com IVA</p>
            </div>
          </div>
          <p className="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-400">
            O profissional lê: <strong className="text-slate-200">trabalho oferecido pela CLYON no valor de {euros(lido.valor)} — ganhos estimados de {euros(ganhos)}</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
