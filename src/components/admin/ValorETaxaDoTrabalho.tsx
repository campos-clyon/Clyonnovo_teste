"use client";

import { useEffect } from "react";
import { lerValorFixo, TAXAS_DO_TRABALHO_CLYON, taxaPeloValor, taxasDoTrabalhoClyon } from "@/lib/oferta-clyon";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { contaDoTrabalhoClyon } from "@/lib/conta-do-pagamento";
import ContaDoPagamento from "@/components/ContaDoPagamento";
import { avisoDaBase, unidadeDaBase, type BaseDoPreco } from "@/lib/base-do-preco";
import { ACRESCIMO_POR_ITEM_EXTRA } from "@/lib/itens-a-mais";

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
  base = "total",
  onBase,
}: {
  valor: string;
  taxa: number | null;
  onValor: (v: string) => void;
  onTaxa: (t: number) => void;
  /**
   * PELO TRABALHO TODO, POR CARGA OU POR HORA — 22-10-2026. *«Deve sempre ter a
   * opção de marcar se é valor total ou valor por carga.»* Com `onBase`, os três
   * botões ficam colados ao valor, como no registo de um pedido.
   */
  base?: BaseDoPreco;
  onBase?: (b: BaseDoPreco) => void;
  /** O que a conta CLYON dava, só para orientar. */
  referencia?: number | null;
}) {
  const lido = lerValorFixo(valor);
  /*
   * A TAXA VAI PELO VALOR — 19-10-2026 (`taxaPeloValor`). Escrever o valor
   * escolhe a taxa do escalão; quem quiser outra carrega nela a seguir. Ao
   * abrir sem taxa nenhuma (um trabalho antigo, uma oferta nova com o valor
   * já escrito), escolhe-se a do escalão; uma taxa já gravada fica como está
   * até o valor mudar.
   */
  const doEscalao = lido.ok ? taxaPeloValor(lido.valor) : null;
  useEffect(() => {
    if (taxa == null && doEscalao != null) onTaxa(doEscalao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxa, doEscalao]);
  const mudarValor = (v: string) => {
    onValor(v);
    const novo = lerValorFixo(v);
    if (novo.ok) onTaxa(taxaPeloValor(novo.valor));
  };
  const ganhos = lido.ok && taxa != null ? quantoOProfissionalRecebe(lido.valor, taxasDoTrabalhoClyon(taxa)) : null;
  const conta = lido.ok && taxa != null ? contaDoTrabalhoClyon({ valorFixo: lido.valor, taxa, precoAoCliente: null }, null) : null;

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
            onChange={(e) => mudarValor(e.target.value)}
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

      {onBase && (
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-cyan-300">O valor é</legend>
          <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="O valor é">
            {(["total", "carga", "hora"] as const).map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={base === b}
                onClick={() => onBase(b)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  base === b
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {b === "total" ? "Valor total" : b === "carga" ? "Por carga" : "Por hora"}
              </button>
            ))}
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            {avisoDaBase(base) ??
              `Pelo trabalho todo. Na mensagem ao cliente vai que cada item fora das fotografias acresce ${ACRESCIMO_POR_ITEM_EXTRA} € + IVA.`}
          </span>
        </fieldset>
      )}

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
        <span className="mt-1.5 block text-xs text-slate-400">
          Pelo valor sem IVA: até 199,99 € → 10 % · de 200 a 600 € → 15 % · mais de 600 € → 20 %.
          {doEscalao != null && taxa != null && Math.abs(taxa - doEscalao) > 1e-9 && (
            <span className="text-amber-300">
              {" "}
              Escolhida à mão: o escalão deste valor é {Math.round(doEscalao * 100)} %.
            </span>
          )}
        </span>
      </fieldset>

      {lido.ok && ganhos != null && conta != null && (
        <div>
          {/* A conta em degraus, a mesma do cartão (15-10-2026): o cliente,
              menos o IVA, menos a taxa, igual ao que vai para o profissional. */}
          <ContaDoPagamento conta={conta} titulo="Como fica a conta" />
          <p className="mt-2 text-xs text-slate-400">
            O profissional lê: <strong className="text-slate-200">trabalho oferecido pela CLYON no valor de {euros(lido.valor)}{unidadeDaBase(base)} — ganhos estimados de {euros(ganhos)}{unidadeDaBase(base)}</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
