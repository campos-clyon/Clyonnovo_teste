"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import dynamic from "next/dynamic";
import DinheiroDoInicio from "@/components/admin/DinheiroDoInicio";
import type { OperacaoDoInicio } from "@/lib/desempenho";

/*
 * O DESEMPENHO — d41, 15-11-2026: pedidos que entram, trabalhos feitos,
 * conversão e gráficos, por baixo da operação. Carregado à parte (os
 * gráficos pesam) para o resumo do dia aparecer primeiro.
 */
const DesempenhoDoInicio = dynamic(() => import("@/components/admin/DesempenhoDoInicio"), { ssr: false });
// O simulador passo a passo (d56, 16-11-2026).
const FunilDoSimulador = dynamic(() => import("@/components/admin/FunilDoSimulador"), { ssr: false });
const FalhasDaIa = dynamic(() => import("@/components/admin/FalhasDaIa"), { ssr: false });

/**
 * O INÍCIO — os números e os dados da empresa.
 *
 * "Essa tela de início já não condiz com as novas ferramentas, está
 * desactualizada. Vamos colocá-la no modo actual, com informações precisas
 * como num painel bem planeado." — 12-09-2026.
 *
 * SÓ NÚMEROS — d139, 27-11-2026 (dono): o «Precisa de si», os sem valor há
 * mais de 4 h e as propostas há mais de 24 h sem resposta passaram para o
 * topo da Mesa (`PrecisaDeSiNaMesa`), onde se trabalham. Três andares:
 *   1. Dinheiro — bruto (o que a CLYON ganhou com as taxas) e líquido (depois
 *      das despesas das Finanças), de hoje ao total, e a margem
 *      (`DinheiroDoInicio`).
 *   2. Operação — linhas curtas: pedidos entrados, a decorrer, feitos por
 *      confirmar, cancelados no mês, e o assistente do WhatsApp num ponto
 *      (só em destaque quando desligado).
 *   3. Desempenho — os pedidos que entram e os trabalhos realizados lado a
 *      lado numa tabela.
 *
 * As «conversas suas» (entregues à equipa) vivem na secção do WhatsApp, por
 * cima da lista: é lá que se trabalham.
 */

type Resumo = {
  porEnviar: number | null;
  esperamResposta: number | null;
  atrasados: number | null;
  semData: number | null;
  levantamentosPorPagar: number | null;
  levantamentosEmEuros: number | null;
  candidaturas: number | null;
  profissionaisPorAprovar: number | null;
  conversasEntregues: number | null;
  filaDoWhatsApp: number | null;
  whatsappLigado: boolean | null;
  aDecorrer: number | null;
  /** Pedidos desde segunda-feira com o custo real fora da grelha (d61, modo sombra). */
  foraDaGrelhaSemana?: number | null;
  /** Aceites pelo cliente e ainda só com a zona (d69). */
  aceitesSemRua?: number | null;
  /** O profissional deu por feito e falta confirmar (d56). */
  feitosPorConfirmar?: number | null;
  /** Os pedidos entrados hoje, na semana e no mês (d56). */
  operacao?: OperacaoDoInicio | null;
};

type Seccao =
  | "pedidos"
  | "negociacoes_clyon"
  | "agenda"
  | "levantamentos"
  | "profissionais"
  | "whatsapp"
  | "pagamentos"
  | "carteiras";

export default function AdminInicioPanel({ onAbrir }: { onAbrir: (s: Seccao) => void }) {
  const { token, ready } = useAdminAuth();
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(true);

  const carregar = useCallback(async (silencioso = false) => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/resumo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível carregar.");
        return;
      }
      setR(dados);
      setErro("");
    } catch {
      if (!silencioso) setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void carregar();
    // O ciclo está no pulso partilhado (useAutoRefresh), não aqui — 16-09-2026.
  }, [ready, carregar]);

  /*
   * NOVIDADES SEM F5 — 16-09-2026. Silencioso de propósito: não mexe no
   * estado de carregamento, pára com o separador escondido e volta a buscar
   * assim que ele reaparece.
   */
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  if (aCarregar && !r) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        A carregar os números…
      </div>
    );
  }

  const op = r?.operacao ?? null;

  return (
    <div className="space-y-3">
      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{erro}</p>
      )}

      {/* 1. DINHEIRO — bruto e líquido (d139). */}
      <DinheiroDoInicio onAbrir={(s) => onAbrir(s)} />

      {/* 2. OPERAÇÃO — linhas curtas; o WhatsApp é um ponto, e só grita desligado. */}
      {r && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
            <h2 className="text-sm font-bold text-white">Operação</h2>
            {op && (
              <button onClick={() => onAbrir("pedidos")} className="hover:text-slate-200" title="Pedidos entrados, sem contas de teste, em dias de Lisboa (a semana começa à segunda).">
                Pedidos entrados: <b className="tabular-nums text-white">{op.entradosHoje}</b> hoje ·{" "}
                <b className="tabular-nums text-white">{op.entradosSemana}</b> semana ·{" "}
                <b className="tabular-nums text-white">{op.entradosMes}</b> mês
              </button>
            )}
            <button onClick={() => onAbrir("agenda")} className="hover:text-slate-200" title="Contratados e ainda por confirmar (inclui os feitos por confirmar).">
              A decorrer: <b className="tabular-nums text-white">{r.aDecorrer ?? "—"}</b>
            </button>
            {r.feitosPorConfirmar != null && (
              <button onClick={() => onAbrir("agenda")} className="hover:text-slate-200" title="O profissional deu o trabalho por feito e falta confirmar.">
                Feitos por confirmar: <b className="tabular-nums text-white">{r.feitosPorConfirmar}</b>
              </button>
            )}
            {op && (
              <span title="Cancelados ou arquivados dos pedidos que entraram este mês.">
                Cancelados no mês: <b className="tabular-nums text-white">{op.canceladosDoMes}</b>
              </span>
            )}
            <button
              onClick={() => onAbrir("whatsapp")}
              title={
                r.filaDoWhatsApp != null && r.filaDoWhatsApp > 0
                  ? `${r.filaDoWhatsApp} mensagem${r.filaDoWhatsApp === 1 ? "" : "s"} por sair`
                  : "Assistente do WhatsApp"
              }
              className={`flex items-center gap-1.5 ${
                r.whatsappLigado === false
                  ? "rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-bold text-red-300"
                  : "hover:text-slate-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  r.whatsappLigado === false ? "bg-red-400" : r.whatsappLigado ? "bg-emerald-400" : "bg-slate-500"
                }`}
                aria-hidden="true"
              />
              {r.whatsappLigado === false ? "WhatsApp DESLIGADO — ninguém recebe nada" : "WhatsApp"}
              {r.filaDoWhatsApp != null && r.filaDoWhatsApp > 0 && (
                <span className="tabular-nums text-slate-500">· {r.filaDoWhatsApp} por sair</span>
              )}
            </button>
            <button
              onClick={() => void carregar()}
              className="ml-auto flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 transition hover:bg-slate-800"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Atualizar
            </button>
          </div>
        </section>
      )}

      {/* 3. DESEMPENHO */}
      <DesempenhoDoInicio />
      <FunilDoSimulador />
      <FalhasDaIa />
    </div>
  );
}
