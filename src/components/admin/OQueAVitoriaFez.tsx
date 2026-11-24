"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { diaMesEmLisboa, inicioDoDiaEmLisboa } from "@/lib/hora-de-lisboa";
import {
  nomeDoCampo,
  ROTINAS_DA_VITORIA,
  type SomaDaRotina,
  type SomaDoDia,
  type SomaDoPeriodo,
} from "@/lib/o-que-a-vitoria-fez";

/**
 * O QUE A VITÓRIA FEZ NAS ÚLTIMAS 24 H — d102 (CEO e dono, 24-11-2026).
 *
 * Um cartão pequeno no topo do painel «Rotinas»: por rotina, quantas
 * passagens, quantas a vermelho e a soma dos números do detalhe (enviados,
 * ficaram, na fila…). «Ver 7 dias» pede `?dias=7` e mostra dia a dia, em
 * hora de Lisboa. Só números; só do administrador.
 */

type Resposta = { ultimas24h: SomaDoPeriodo; porDia: SomaDoDia[] | null; incompleto?: boolean; error?: string };

/** As da Vitória aparecem sempre (também com zero); as outras só se passaram. */
const mostrar = (r: SomaDaRotina) => ROTINAS_DA_VITORIA.includes(r.rotina) || r.passagens > 0;

function numerosDe(r: SomaDaRotina): string {
  const partes = [
    ...Object.entries(r.numeros).filter(([, n]) => n !== 0).map(([k, n]) => `${nomeDoCampo(k)} ${n}`),
    ...Object.entries(r.listas).filter(([, n]) => n !== 0).map(([k, n]) => `${nomeDoCampo(k)} ${n}`),
    ...Object.entries(r.vezes).map(([k, n]) => `${nomeDoCampo(k)} ${n}×`),
  ];
  return partes.join(" · ");
}

function Linhas({ rotinas }: { rotinas: SomaDaRotina[] }) {
  return (
    <ul className="divide-y divide-slate-800/70">
      {rotinas.filter(mostrar).map((r) => {
        const numeros = numerosDe(r);
        return (
          <li key={r.rotina} className="py-1.5 text-xs">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold text-slate-200">{r.titulo}</span>
              <span className="text-slate-400">
                {r.passagens} {r.passagens === 1 ? "passagem" : "passagens"}
                {r.vermelhas > 0 && <span className="text-red-300"> · {r.vermelhas} a vermelho</span>}
              </span>
            </p>
            {numeros && <p className="mt-0.5 break-words text-slate-400">{numeros}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export default function OQueAVitoriaFez() {
  const { token, ready } = useAdminAuth();
  const [dias, setDias] = useState(1);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch(`/api/admin/rotinas/o-que-a-vitoria-fez?dias=${dias}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = (await res.json()) as Resposta;
      if (!res.ok || !d.ultimas24h) {
        setErro(d.error ?? "Não foi possível somar as passagens.");
        return;
      }
      setDados(d);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token, dias]);

  useEffect(() => {
    if (ready && token) void carregar();
  }, [ready, token, carregar]);

  return (
    <section className="mb-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">O que a Vitória fez nas últimas 24 h</h3>
        <button
          type="button"
          onClick={() => setDias((d) => (d === 1 ? 7 : 1))}
          className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          {dias === 1 ? "Ver dia a dia (7 dias)" : "Só as 24 h"}
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
      {!dados && !erro && (
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />A somar…
        </p>
      )}
      {dados && (
        <div className={aCarregar ? "opacity-60" : undefined}>
          <Linhas rotinas={dados.ultimas24h.rotinas} />
          {dados.porDia && (
            <div className="mt-3 border-t border-slate-800 pt-2">
              <p className="mb-1 text-xs font-semibold text-slate-300">Dia a dia (hora de Lisboa)</p>
              {dados.porDia.map((d) => (
                <details key={d.dia} className="py-1">
                  <summary className="cursor-pointer text-xs text-slate-300">
                    {diaMesEmLisboa(inicioDoDiaEmLisboa(d.dia))} —{" "}
                    {d.rotinas.reduce((n, r) => n + r.passagens, 0)} passagens
                    {d.rotinas.some((r) => r.vermelhas > 0) &&
                      `, ${d.rotinas.reduce((n, r) => n + r.vermelhas, 0)} a vermelho`}
                  </summary>
                  <Linhas rotinas={d.rotinas} />
                </details>
              ))}
            </div>
          )}
          {dados.incompleto && (
            <p className="mt-2 text-xs text-amber-300">Passagens demais no período — a soma ficou pelas primeiras 30 000.</p>
          )}
        </div>
      )}
    </section>
  );
}
