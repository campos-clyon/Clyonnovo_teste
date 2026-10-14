"use client";

import { ArrowDown, ArrowUp, Landmark, Scale } from "lucide-react";
import {
  balancoDosMeses,
  emEuros,
  mesCurto,
  mesDoDia,
  porCategoria,
  resumoDoMes,
  saldoDaConta,
  saldoTotal,
  ultimoDiaDoMes,
  type Categoria,
  type Conta,
  type FatiaDaCategoria,
  type Movimento,
  type TipoDeCategoria,
} from "@/lib/financas";
import { BolaDaCategoria, CLASSES_DA_COR, DesenhoDaConta } from "./aparencia";

/**
 * O PAINEL DO MÊS — o «Dashboard» do Mobills, com as contas da CLYON.
 *
 * Quatro números em cima (o saldo, o que entrou, o que saiu, e a diferença),
 * as despesas e as receitas por categoria, o balanço dos últimos seis meses e
 * o saldo de cada conta. Tudo do mês escolhido; o saldo é o do fim desse mês
 * — ou o de hoje, no mês em que estamos.
 */
export default function PainelDasFinancas({
  contas,
  categorias,
  movimentos,
  mes,
  hoje,
  onVerTransacoes,
  onLancar,
}: {
  contas: Conta[];
  categorias: Categoria[];
  movimentos: Movimento[];
  mes: string;
  hoje: string;
  onVerTransacoes: (tipo: "todas" | "despesa" | "receita") => void;
  onLancar: (tipo: "despesa" | "receita") => void;
}) {
  const esteMes = mesDoDia(hoje) === mes;
  const ate = esteMes ? hoje : ultimoDiaDoMes(mes);
  const resumo = resumoDoMes(movimentos, mes);
  const saldo = saldoTotal(contas, movimentos, ate);

  const cartoes = [
    {
      chave: "saldo",
      rotulo: esteMes ? "Saldo atual" : "Saldo no fim do mês",
      valor: saldo,
      Desenho: Landmark,
      bola: "bg-azul/20 text-azul-texto",
      valorCls: saldo < 0 ? "text-coral-texto" : "text-white",
      nota: null as string | null,
      onClick: () => onVerTransacoes("todas"),
    },
    {
      chave: "receitas",
      rotulo: "Receitas",
      valor: resumo.receitas,
      Desenho: ArrowUp,
      bola: "bg-esmeralda/20 text-esmeralda-texto",
      valorCls: "text-white",
      nota: resumo.receitasPrevistas > 0 ? `+ ${emEuros(resumo.receitasPrevistas)} por receber` : null,
      onClick: () => onVerTransacoes("receita"),
    },
    {
      chave: "despesas",
      rotulo: "Despesas",
      valor: resumo.despesas,
      Desenho: ArrowDown,
      bola: "bg-coral/20 text-coral-texto",
      valorCls: "text-white",
      nota: resumo.despesasPrevistas > 0 ? `+ ${emEuros(resumo.despesasPrevistas)} por pagar` : null,
      onClick: () => onVerTransacoes("despesa"),
    },
    {
      chave: "balanco",
      rotulo: "Balanço do mês",
      valor: resumo.balanco,
      Desenho: Scale,
      bola: "bg-ciano/20 text-ciano-texto",
      valorCls: resumo.balanco < 0 ? "text-coral-texto" : "text-esmeralda-texto",
      nota: null,
      onClick: () => onVerTransacoes("todas"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c) => (
          <button
            key={c.chave}
            type="button"
            onClick={c.onClick}
            className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${c.bola}`}>
              <c.Desenho className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-slate-400">{c.rotulo}</span>
              <span className={`block text-xl font-bold tabular-nums ${c.valorCls}`}>{emEuros(c.valor)}</span>
              {c.nota && <span className="block text-[11px] text-slate-500">{c.nota}</span>}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PorCategoria
          titulo="Despesas por categoria"
          tipo="despesa"
          fatias={porCategoria(movimentos, categorias, mes, "despesa")}
          onLancar={() => onLancar("despesa")}
          onVer={() => onVerTransacoes("despesa")}
        />
        <PorCategoria
          titulo="Receitas por categoria"
          tipo="receita"
          fatias={porCategoria(movimentos, categorias, mes, "receita")}
          onLancar={() => onLancar("receita")}
          onVer={() => onVerTransacoes("receita")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BalancoDosMeses movimentos={movimentos} mes={mes} />
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Contas</h3>
          <ul className="mt-3 divide-y divide-slate-800">
            {contas.map((c) => {
              const s = saldoDaConta(c, movimentos, ate);
              return (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${CLASSES_DA_COR[c.cor].chip}`}>
                    <DesenhoDaConta tipo={c.tipo} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{c.nome}</span>
                  <span className={`text-sm font-semibold tabular-nums ${s < 0 ? "text-coral-texto" : "text-white"}`}>
                    {emEuros(s)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 border-t border-slate-800 pt-2 text-right text-sm text-slate-400">
            Total <strong className="tabular-nums text-white">{emEuros(saldo)}</strong>
          </p>
        </section>
      </div>
    </div>
  );
}

/**
 * UMA ROSCA E A LISTA AO LADO — as categorias do mês, da maior para a menor,
 * com o valor e a percentagem. A rosca é SVG à mão: são dez linhas, e uma
 * biblioteca de gráficos pesava no backoffice inteiro.
 */
function PorCategoria({
  titulo,
  tipo,
  fatias,
  onLancar,
  onVer,
}: {
  titulo: string;
  tipo: TipoDeCategoria;
  fatias: FatiaDaCategoria[];
  onLancar: () => void;
  onVer: () => void;
}) {
  const total = fatias.reduce((s, f) => s + f.total, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let feito = 0;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-200">{titulo}</h3>
      {fatias.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-400">
            {tipo === "despesa" ? "Ainda não há despesas neste mês." : "Ainda não há receitas neste mês."}
          </p>
          <button
            type="button"
            onClick={onLancar}
            className="mt-3 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            {tipo === "despesa" ? "Lançar uma despesa" : "Lançar uma receita"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="relative h-40 w-40 shrink-0">
            <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90" role="img" aria-label={`${titulo}: ${emEuros(total)}`}>
              <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-slate-800" />
              {fatias.map((f, i) => {
                const comprimento = f.fraccao * C;
                const circulo = (
                  <circle
                    key={f.categoria?.id ?? `sem-${i}`}
                    cx="70"
                    cy="70"
                    r={R}
                    fill="none"
                    strokeWidth="16"
                    strokeDasharray={`${comprimento} ${C - comprimento}`}
                    strokeDashoffset={-feito}
                    className={f.categoria ? CLASSES_DA_COR[f.categoria.cor].traco : "stroke-slate-600"}
                  />
                );
                feito += comprimento;
                return circulo;
              })}
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold tabular-nums text-white">{emEuros(total)}</span>
              <span className="text-[10px] text-slate-500">Total</span>
            </span>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-2">
            {fatias.slice(0, 7).map((f, i) => (
              <li key={f.categoria?.id ?? `sem-${i}`} className="flex items-center gap-2.5">
                {f.categoria ? (
                  <BolaDaCategoria cor={f.categoria.cor} icone={f.categoria.icone} />
                ) : (
                  <span className="h-7 w-7 rounded-full bg-slate-800" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-200">{f.categoria?.nome ?? "Sem categoria"}</span>
                  <span className="block text-[11px] text-slate-500">{(f.fraccao * 100).toFixed(1).replace(".", ",")} %</span>
                </span>
                <span className={`text-sm font-semibold tabular-nums ${tipo === "despesa" ? "text-coral-texto" : "text-esmeralda-texto"}`}>
                  {emEuros(f.total)}
                </span>
              </li>
            ))}
            {fatias.length > 7 && <li className="text-xs text-slate-500">e mais {fatias.length - 7}</li>}
          </ul>
        </div>
      )}
      {fatias.length > 0 && (
        <button
          type="button"
          onClick={onVer}
          className="mt-4 w-full border-t border-slate-800 pt-3 text-center text-xs font-semibold uppercase tracking-wider text-cyan-300 hover:text-cyan-200"
        >
          Ver as transações
        </button>
      )}
    </section>
  );
}

/** As receitas e as despesas dos últimos seis meses, lado a lado. */
function BalancoDosMeses({ movimentos, mes }: { movimentos: Movimento[]; mes: string }) {
  const meses = balancoDosMeses(movimentos, mes, 6);
  const maior = Math.max(1, ...meses.flatMap((m) => [m.receitas, m.despesas]));
  const actual = meses[meses.length - 1];
  const balanco = actual.receitas - actual.despesas;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-200">Balanço mensal</h3>
        <span className="flex gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-esmeralda" aria-hidden="true" />
            Receitas
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-coral" aria-hidden="true" />
            Despesas
          </span>
        </span>
      </div>
      <div className="mt-4 flex h-40 items-end gap-3" role="img" aria-label="Receitas e despesas dos últimos seis meses">
        {meses.map((m) => (
          <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <span
                title={`Receitas: ${emEuros(m.receitas)}`}
                className="w-1/3 max-w-4 rounded-t bg-esmeralda"
                style={{ height: `${(m.receitas / maior) * 100}%`, minHeight: m.receitas > 0 ? 3 : 0 }}
              />
              <span
                title={`Despesas: ${emEuros(m.despesas)}`}
                className="w-1/3 max-w-4 rounded-t bg-coral"
                style={{ height: `${(m.despesas / maior) * 100}%`, minHeight: m.despesas > 0 ? 3 : 0 }}
              />
            </div>
            <span className={`text-[11px] ${m.mes === mes ? "font-semibold text-slate-200" : "text-slate-500"}`}>
              {mesCurto(m.mes)}
            </span>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-sm">
        <div>
          <dt className="text-[11px] text-slate-500">Receitas</dt>
          <dd className="font-semibold tabular-nums text-esmeralda-texto">{emEuros(actual.receitas)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Despesas</dt>
          <dd className="font-semibold tabular-nums text-coral-texto">{emEuros(actual.despesas)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Balanço</dt>
          <dd className={`font-semibold tabular-nums ${balanco < 0 ? "text-coral-texto" : "text-white"}`}>{emEuros(balanco)}</dd>
        </div>
      </dl>
    </section>
  );
}
