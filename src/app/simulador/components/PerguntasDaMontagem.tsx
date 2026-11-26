"use client";

import { Minus, Plus } from "lucide-react";
import {
  COZINHA_SO_POR_ORCAMENTO,
  FIXAR_A_PAREDE_POR_MOVEL,
  OPERACOES_DA_MONTAGEM,
  RETIRAR_AS_EMBALAGENS,
  TABELA_DA_MONTAGEM,
  comOIvaAoLado,
  precoNaOperacao,
  rotuloDoExtraDaDesmontagem,
  type OperacaoDaMontagem,
} from "@/lib/tabela-da-montagem";

/**
 * As perguntas da montagem e desmontagem de móveis — 26-11-2026 (d132). O que
 * é para fazer, quantas peças de cada linha da tabela (com o preço e o IVA ao
 * lado), os extras e a cozinha. A conta é a da estimativa por cima
 * (`PrecoDeReferencia`), a mesma da app e do motor; a rota do pedido escreve
 * as linhas na descrição (`pedido-por-categoria.ts`).
 *
 * `PecasADesmontar` é o extra das recolhas e da mudança: as peças a desmontar
 * (e montar no destino), pela mesma tabela.
 */

type Pecas = Record<string, number>;

const pilula = (activa: boolean) =>
  `min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-xs font-semibold transition ${
    activa ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white text-slate-800 hover:border-cyan-300"
  }`;

function Contador({ valor, nome, onChange }: { valor: number; nome: string; onChange: (n: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, valor - 1))}
        disabled={valor <= 0}
        aria-label={`Menos uma: ${nome}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span aria-live="polite" className="w-6 text-center text-sm font-semibold text-slate-900">
        {valor}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, valor + 1))}
        disabled={valor >= 99}
        aria-label={`Mais uma: ${nome}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function ListaDasPecas({ pecas, operacao, onPecas }: { pecas: Pecas; operacao: OperacaoDaMontagem; onPecas: (p: Pecas) => void }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {TABELA_DA_MONTAGEM.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{l.nome}</p>
            <p className="text-xs text-slate-600">
              {l.exemplos ? `${l.exemplos} · ` : ""}
              {comOIvaAoLado(precoNaOperacao(l.preco, operacao))}
            </p>
          </div>
          <Contador valor={pecas[l.id] ?? 0} nome={l.nome} onChange={(n) => onPecas({ ...pecas, [l.id]: n })} />
        </li>
      ))}
    </ul>
  );
}

type Props = {
  operacao?: string;
  pecas?: Pecas;
  fixarAParede?: number;
  retirarEmbalagens?: boolean;
  cozinha?: boolean;
  onOperacao: (v: OperacaoDaMontagem) => void;
  onPecas: (p: Pecas) => void;
  onFixarAParede: (n: number) => void;
  onRetirarEmbalagens: (v: boolean) => void;
  onCozinha: (v: boolean) => void;
};

export default function PerguntasDaMontagem({
  operacao,
  pecas = {},
  fixarAParede = 0,
  retirarEmbalagens = false,
  cozinha = false,
  onOperacao,
  onPecas,
  onFixarAParede,
  onRetirarEmbalagens,
  onCozinha,
}: Props) {
  const op = (OPERACOES_DA_MONTAGEM.find((o) => o.id === operacao)?.id ?? "montar") as OperacaoDaMontagem;
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">O que é para fazer?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {OPERACOES_DA_MONTAGEM.map((o) => (
            <button key={o.id} type="button" aria-pressed={operacao === o.id} onClick={() => onOperacao(o.id)} className={pilula(operacao === o.id)}>
              {o.nome}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">Quantas peças?</p>
        <ListaDasPecas pecas={pecas} operacao={op} onPecas={onPecas} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800">Móveis a fixar à parede (anti-queda)</p>
            <p className="text-xs text-slate-600">{comOIvaAoLado(FIXAR_A_PAREDE_POR_MOVEL)} por móvel</p>
          </div>
          <Contador valor={fixarAParede} nome="móveis a fixar à parede" onChange={onFixarAParede} />
        </div>
        <label className="flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
          <input type="checkbox" checked={retirarEmbalagens} onChange={(ev) => onRetirarEmbalagens(ev.target.checked)} className="h-4 w-4" />
          Retirar as embalagens ({comOIvaAoLado(RETIRAR_AS_EMBALAGENS)})
        </label>
        <label className="flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
          <input type="checkbox" checked={cozinha} onChange={(ev) => onCozinha(ev.target.checked)} className="h-4 w-4" />
          Há móveis de cozinha
        </label>
        {cozinha && <p className="text-xs text-slate-600">{COZINHA_SO_POR_ORCAMENTO}</p>}
      </div>

      <p className="text-xs text-slate-500">
        Os valores são «desde»: o parceiro escolhido propõe o valor final, com as fotografias. O andar e o elevador
        perguntam-se no passo seguinte.
      </p>
    </div>
  );
}

/** O extra das recolhas e da mudança: as peças a desmontar (e montar no destino), pela tabela da montagem. */
export function PecasADesmontar({ servico, pecas = {}, onPecas }: { servico: string; pecas?: Pecas; onPecas: (p: Pecas) => void }) {
  const operacao: OperacaoDaMontagem = servico === "mudanca" ? "os_dois" : "desmontar";
  const quantas = Object.values(pecas).reduce((s, n) => s + (n ?? 0), 0);
  return (
    <details open={quantas > 0} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-gray-900">
        {rotuloDoExtraDaDesmontagem(servico)} <span className="font-normal text-gray-500">(opcional)</span>
      </summary>
      <p className="text-xs text-slate-600">
        {servico === "mudanca"
          ? "Peça a peça, pela tabela da montagem: 75 % da montagem e da desmontagem somadas. É a única desmontagem da mudança: não soma horas."
          : "Peça a peça, pela tabela da montagem: metade do preço de montar."}
      </p>
      <ListaDasPecas pecas={pecas} operacao={operacao} onPecas={onPecas} />
    </details>
  );
}
