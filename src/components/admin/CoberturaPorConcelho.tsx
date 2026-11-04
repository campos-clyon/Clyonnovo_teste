"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  HORAS_DA_PRIMEIRA_PROPOSTA,
  KM_DA_BASE_PERTO,
  TRABALHOS_DE_QUEM_E_FORTE,
  type CoberturaPorConcelho as Cobertura,
  type CorDaCobertura,
} from "@/lib/cobertura-por-concelho";
import { dataEHoraEmLisboa } from "@/lib/hora-de-lisboa";

/**
 * O QUADRO DA COBERTURA POR CONCELHO — 04-11-2026 (d16, Fase A do plano de
 * expansão). Só de leitura, na secção Profissionais: uma linha por concelho,
 * os 16 de hoje e Vila Franca de Xira e Mafra (Fase B). A conta e o que cada
 * coluna quer dizer estão em `cobertura-por-concelho.ts`.
 */

const COR: Record<CorDaCobertura, { ponto: string; texto: string; nome: string }> = {
  verde: { ponto: "bg-emerald-400", texto: "text-emerald-300", nome: "verde" },
  amarelo: { ponto: "bg-amber-400", texto: "text-amber-300", nome: "amarelo" },
  vermelho: { ponto: "bg-red-500", texto: "text-red-300", nome: "vermelho" },
};

export default function CoberturaPorConcelho() {
  const { token, ready } = useAdminAuth();
  const [dados, setDados] = useState<Cobertura | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    setErro("");
    try {
      const res = await fetch("/api/admin/profissionais/cobertura", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(corpo.error ?? "Não foi possível calcular a cobertura.");
        return;
      }
      setDados(corpo as Cobertura);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  return (
    <div>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl text-sm text-slate-400">
          <p>
            Uma linha por concelho, com as réguas do envio: a base e o raio de cada parceiro, e a morada do pedido.
            Contas de teste de fora. Só de leitura.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Cor: conta os parceiros com base a {KM_DA_BASE_PERTO} km ou menos que fizeram {TRABALHOS_DE_QUEM_E_FORTE} ou mais
            trabalhos em 30 dias e respondem em {HORAS_DA_PRIMEIRA_PROPOSTA} h ou menos (mediana). Dois ou mais = verde,
            um = amarelo, nenhum = vermelho.
          </p>
        </div>
        <button
          onClick={() => void carregar()}
          disabled={aCarregar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
        >
          {aCarregar ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Actualizar
        </button>
      </header>

      {erro && <p className="mb-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erro}</p>}
      {!dados && aCarregar && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      )}

      {dados && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-800/60 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Concelho</th>
                  <th className="px-3 py-2 text-right font-semibold" title="Aprovados com o centro do concelho dentro do raio">
                    No raio
                  </th>
                  <th className="px-3 py-2 text-right font-semibold" title={`Aprovados com a base a ${KM_DA_BASE_PERTO} km ou menos`}>
                    Base ≤ {KM_DA_BASE_PERTO} km
                  </th>
                  <th
                    className="px-3 py-2 text-right font-semibold"
                    title="Dos de base perto, os que fizeram pelo menos uma proposta ou um trabalho"
                  >
                    Activos 14 d / 30 d
                  </th>
                  <th className="px-3 py-2 text-right font-semibold" title="Pedidos dos últimos 30 dias com a morada no concelho">
                    Pedidos 30 d
                  </th>
                  <th className="px-3 py-2 text-right font-semibold" title={`1.ª proposta em menos de ${HORAS_DA_PRIMEIRA_PROPOSTA} horas`}>
                    1.ª proposta &lt; {HORAS_DA_PRIMEIRA_PROPOSTA} h
                  </th>
                  <th className="px-3 py-2 text-right font-semibold" title="Com parceiro contratado, ou concluídos">
                    Fechados
                  </th>
                  <th className="px-3 py-2 font-semibold">Cor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dados.linhas.map((l) => (
                  <tr key={l.id} className={l.faseB ? "bg-slate-900/40 text-slate-400" : "text-slate-200"}>
                    <td className="px-3 py-2 font-medium">
                      {l.nome}
                      {l.faseB && <span className="ml-2 text-[11px] font-normal text-slate-500">Fase B</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.noRaio}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.basePerto}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.activos14} / {l.activos30}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.pedidos30}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.percentagemEm6h == null ? "—" : `${l.percentagemEm6h} %`}
                      {l.pedidos30 > 0 && (
                        <span className="ml-1 text-[11px] text-slate-500">
                          ({l.comPropostaEm6h} de {l.pedidos30})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.fechados}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${COR[l.cor].texto}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${COR[l.cor].ponto}`} aria-hidden="true" />
                        {COR[l.cor].nome}
                        <span className="font-normal text-slate-500">({l.fortes})</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {dados.pedidosSemConcelho > 0
              ? `${dados.pedidosSemConcelho} pedido(s) dos últimos 30 dias sem concelho conhecido, ou fora destes 18. `
              : ""}
            Calculado a {dataEHoraEmLisboa(new Date(dados.calculadoEm))} (hora de Lisboa).
          </p>
        </>
      )}
    </div>
  );
}
