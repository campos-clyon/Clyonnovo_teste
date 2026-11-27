"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { emEuros } from "@/lib/financas";
import {
  PERIODOS_DO_INICIO,
  ROTULOS_DOS_PERIODOS,
  type DinheiroDoInicio as Dinheiro,
  type DinheiroDoPeriodo,
} from "@/lib/dinheiro-do-inicio";

/**
 * O DINHEIRO, NO INÍCIO — d56, 17-11-2026; duas linhas desde a d139
 * (27-11-2026, dono).
 *
 *   BRUTO   — o que a CLYON ganhou com as taxas (a taxa de cada trabalho
 *             feito, sem IVA), sem descontar despesas: hoje, semana, mês, ano
 *             civil, total, e o que os profissionais ainda têm de passar.
 *   LÍQUIDO — o bruto menos as despesas das Finanças, nos mesmos períodos, e
 *             a margem (líquido ÷ bruto).
 *
 * A conta é a de `dinheiro-do-inicio.ts`; o detalhe de cada número fica no
 * `title`. Negativo a coral, positivo a esmeralda. Quem não vê as Finanças
 * não vê esta secção.
 */

type Resposta = {
  hoje: string;
  eAdmin: boolean;
  semEntradas: boolean;
  semTrabalhos?: boolean;
  periodos: Dinheiro;
  aReceberDosProfissionais: number | null;
};

const corDe = (v: number) => (v < 0 ? "text-coral-texto" : v > 0 ? "text-esmeralda-texto" : "text-slate-300");

const escreverMargem = (m: number | null) => (m == null ? "—" : `${m.toFixed(1).replace(".", ",")} %`);

function dicaDoBruto(p: DinheiroDoPeriodo): string {
  const t = `${p.trabalhos} trabalho${p.trabalhos === 1 ? "" : "s"} feito${p.trabalhos === 1 ? "" : "s"}`;
  const sem = p.semValor > 0 ? ` (${p.semValor} sem valor conhecido, a contar 0)` : "";
  return `${t}${sem} · a taxa da plataforma de cada um, sem IVA, no dia em que foi feito · de ${p.de} a ${p.ate}`;
}

function dicaDoLiquido(p: DinheiroDoPeriodo): string {
  const d = p.despesas;
  const partes = [
    `Bruto ${emEuros(p.bruto)}`,
    `Gastos ${emEuros(d.gastos)}`,
    `Despesas lançadas ${emEuros(d.lancadas)}`,
    `euPago ${emEuros(d.eupago)}`,
  ];
  partes.push(d.assistentes == null ? "Assistentes: só o administrador vê" : `Assistentes ${emEuros(d.assistentes)}`);
  partes.push(`Margem ${escreverMargem(p.margem)}`);
  return partes.join(" · ");
}

function Celula({ rotulo, valor, dica, cor }: { rotulo: string; valor: string; dica: string; cor: string }) {
  return (
    <div title={dica} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`text-lg font-bold leading-tight tabular-nums ${cor}`}>{valor}</p>
    </div>
  );
}

export default function DinheiroDoInicio({ onAbrir }: { onAbrir: (s: "pagamentos" | "carteiras") => void }) {
  const { token, ready } = useAdminAuth();
  const [d, setD] = useState<Resposta | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/financas/inicio", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        setSemAcesso(true);
        return;
      }
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível fazer as contas.");
        return;
      }
      setD(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);
  useAutoRefresh(() => carregar(), { enabled: ready && Boolean(token) && !semAcesso });

  if (semAcesso) return null;

  const semValor = d ? d.periodos.total.semValor : 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-sm font-bold text-white">Dinheiro</h2>
        <button
          type="button"
          onClick={() => onAbrir("carteiras")}
          className="text-[11px] text-slate-500 hover:text-slate-300"
          title="As despesas são as das Finanças: gastos recorrentes e ocasionais, despesas lançadas, comissões do euPago e comissões pagas às assistentes. Sem contas de teste. Dias de Lisboa."
        >
          as contas das Finanças →
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-coral-texto">{erro}</p>}
      {d?.semTrabalhos && (
        <p className="mt-2 text-xs text-ambar-texto">Não se leram os trabalhos agora: o bruto está a zero.</p>
      )}
      {d?.semEntradas && (
        <p className="mt-2 text-xs text-ambar-texto">Não se leram os pagamentos agora: faltam as comissões do euPago.</p>
      )}
      {!d && !erro && <p className="mt-2 text-xs text-slate-400">A fazer as contas…</p>}
      {d && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="mb-1 text-[11px] text-slate-400" title="A taxa da plataforma de cada trabalho feito, sem IVA. Não é o dinheiro que vai para o parceiro. Sem descontar despesas.">
              <b className="text-slate-200">Bruto</b> · o que a CLYON ganhou com as taxas, sem IVA
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {PERIODOS_DO_INICIO.map((p) => (
                <Celula
                  key={p}
                  rotulo={ROTULOS_DOS_PERIODOS[p]}
                  valor={emEuros(d.periodos[p].bruto)}
                  dica={dicaDoBruto(d.periodos[p])}
                  cor={corDe(d.periodos[p].bruto)}
                />
              ))}
              <button
                type="button"
                onClick={() => onAbrir("pagamentos")}
                title="O que os profissionais ainda têm de passar à CLYON (Pagamentos › A receber dos profissionais), sem contas de teste."
                className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-left hover:bg-slate-800/60"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">A receber dos profissionais</p>
                <p className="text-lg font-bold leading-tight tabular-nums text-esmeralda-texto">
                  {d.aReceberDosProfissionais == null ? "—" : emEuros(d.aReceberDosProfissionais)}
                </p>
              </button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-slate-400" title="Bruto menos as despesas da CLYON das Finanças.">
              <b className="text-slate-200">Líquido</b> · o lucro, depois das despesas
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {PERIODOS_DO_INICIO.map((p) => (
                <Celula
                  key={p}
                  rotulo={ROTULOS_DOS_PERIODOS[p]}
                  valor={emEuros(d.periodos[p].liquido)}
                  dica={dicaDoLiquido(d.periodos[p])}
                  cor={corDe(d.periodos[p].liquido)}
                />
              ))}
              <div
                title={`Líquido ÷ bruto. Hoje ${escreverMargem(d.periodos.hoje.margem)} · semana ${escreverMargem(d.periodos.semana.margem)} · ano ${escreverMargem(d.periodos.ano.margem)} · total ${escreverMargem(d.periodos.total.margem)}`}
                className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Margem do mês</p>
                <p className={`text-lg font-bold leading-tight tabular-nums ${corDe(d.periodos.mes.margem ?? 0)}`}>
                  {escreverMargem(d.periodos.mes.margem)}
                </p>
                <p className="text-[11px] tabular-nums text-slate-500">
                  ano {escreverMargem(d.periodos.ano.margem)} · total {escreverMargem(d.periodos.total.margem)}
                </p>
              </div>
            </div>
          </div>
          {semValor > 0 && (
            <p className="text-[11px] text-ambar-texto">
              {semValor} trabalho{semValor === 1 ? "" : "s"} feito{semValor === 1 ? "" : "s"} sem valor conhecido conta
              {semValor === 1 ? "" : "m"} 0 € no bruto (escreve-se o lucro nos Assistentes).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
