"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { emEuros } from "@/lib/financas";
import { ROTULOS_DOS_PERIODOS, type DinheiroDoInicio as Dinheiro, type PeriodoDoInicio } from "@/lib/dinheiro-do-inicio";
import type { LucroDoIntervalo } from "@/lib/financas-do-mes";

/**
 * O DINHEIRO, NO INÍCIO — d56, 17-11-2026.
 *
 * O lucro de hoje, da semana, do mês e do ano, pela conta das Finanças
 * (`/api/admin/financas/inicio`). Cada cartão: o lucro antes da sócia, o
 * lucro depois dela e a média por dia; o detalhe (receita, gastos,
 * assistentes) fica no `title`. Ao lado: o que os profissionais ainda devem
 * à CLYON e o que está por transferir. Negativo a coral, positivo a
 * esmeralda. Quem não vê as Finanças não vê esta secção.
 */

type Resposta = {
  hoje: string;
  eAdmin: boolean;
  semEntradas: boolean;
  periodos: Dinheiro;
  aReceberDosProfissionais: number | null;
};

const PERIODOS: PeriodoDoInicio[] = ["hoje", "semana", "mes", "ano"];

const corDe = (v: number) => (v < 0 ? "text-coral-texto" : v > 0 ? "text-esmeralda-texto" : "text-slate-300");

function dicaDe(l: LucroDoIntervalo): string {
  const partes = [`Receita ${emEuros(l.receita)}`, `Gastos ${emEuros(l.gastos)}`];
  if (l.assistentes != null) partes.push(`Assistentes ${emEuros(l.assistentes)}`);
  if (l.socia != null) partes.push(`Parte da sócia ${emEuros(l.socia)}`);
  partes.push(`${l.dias} dia${l.dias === 1 ? "" : "s"}`);
  return partes.join(" · ");
}

function Cartao({ rotulo, l }: { rotulo: string; l: LucroDoIntervalo }) {
  return (
    <div title={dicaDe(l)} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`text-lg font-bold leading-tight tabular-nums ${corDe(l.lucro)}`}>{emEuros(l.lucro)}</p>
      {l.lucroDepoisDaSocia != null && (
        <p className="text-xs tabular-nums text-slate-400">
          depois da sócia <span className={`font-semibold ${corDe(l.lucroDepoisDaSocia)}`}>{emEuros(l.lucroDepoisDaSocia)}</span>
        </p>
      )}
      {l.dias > 1 && (
        <p className="text-[11px] tabular-nums text-slate-500">
          {emEuros(l.mediaPorDia)}/dia
          {l.mediaPorDiaDepoisDaSocia != null ? ` · ${emEuros(l.mediaPorDiaDepoisDaSocia)}/dia depois` : ""}
        </p>
      )}
    </div>
  );
}

export default function DinheiroDoInicio({
  aPagar,
  onAbrir,
}: {
  /** O «Por transferir» de hoje (levantamentos pedidos), do resumo. */
  aPagar: number | null;
  onAbrir: (s: "pagamentos" | "levantamentos" | "carteiras") => void;
}) {
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

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-sm font-bold text-white">Dinheiro</h2>
        <button
          type="button"
          onClick={() => onAbrir("carteiras")}
          className="text-[11px] text-slate-500 hover:text-slate-300"
          title="A mesma conta das Finanças: receita (taxas sem IVA e receitas à mão) − gastos − assistentes. Sem contas nem pagamentos de teste. Dias de Lisboa."
        >
          as contas das Finanças →
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-coral-texto">{erro}</p>}
      {d?.semEntradas && (
        <p className="mt-2 text-xs text-ambar-texto">Não se leram os pagamentos agora: a receita está a zero.</p>
      )}
      {!d && !erro && <p className="mt-2 text-xs text-slate-400">A fazer as contas…</p>}
      {d && (
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {PERIODOS.map((p) => (
            <Cartao key={p} rotulo={ROTULOS_DOS_PERIODOS[p]} l={d.periodos[p]} />
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
          <button
            type="button"
            onClick={() => onAbrir("levantamentos")}
            title="Por transferir: o que os profissionais já pediram e a CLYON ainda não pagou."
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-left hover:bg-slate-800/60"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">A pagar a profissionais</p>
            <p className={`text-lg font-bold leading-tight tabular-nums ${aPagar != null && aPagar > 0 ? "text-coral-texto" : "text-slate-300"}`}>
              {aPagar == null ? "—" : emEuros(aPagar)}
            </p>
          </button>
        </div>
      )}
    </section>
  );
}
