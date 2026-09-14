"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Camera, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * A RETENÇÃO — o que a purga apagaria, antes de a armar.
 *
 * "Pode confirmar se os pedidos estão a ser excluídos automaticamente após 60
 * dias?" A resposta, a 14-09-2026, era: não. A purga existe, corre todas as
 * noites, e está em MODO SECO desde que foi construída — conta e não apaga.
 *
 * O número que ela conta ia para o registo permanente, que era escrito e nunca
 * lido: três funções para o consultar, nenhuma chamada em lado nenhum. Ou
 * seja, a única coisa que se precisava de ver antes de armar era a única que
 * não se via.
 *
 * ESTE ECRÃ NÃO TEM BOTÃO DE ARMAR, E É DE PROPÓSITO. Arma-se numa variável de
 * ambiente com um redeploy pelo meio, e essa lentidão é a última coisa que
 * separa uma tarde má de uma base vazia.
 */

type Estado = {
  armada: boolean;
  diasDosTerminados: number;
  diasDosAbandonados: number;
  elegiveis: number;
  naProximaPassagem: number;
  fotografias: number;
  restantes: number;
  naMira: number[];
  ultimas: Array<{
    id: number;
    ocorridoEm: string;
    resumo: string | null;
    autorNome: string | null;
  }>;
};

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function AdminRetencaoPanel() {
  const { token, ready } = useAdminAuth();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(false);

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/retencao", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível contar.");
        return;
      }
      setEstado(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);

  if (!estado && !erro) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A contar o que seria
        apagado…
      </p>
    );
  }
  if (erro) return <p className="text-sm text-red-300">{erro}</p>;
  if (!estado) return null;

  return (
    <div className="space-y-4">
      {/*
        O ESTADO, primeiro e em cores diferentes: «conta e não apaga» e «apaga
        mesmo» são dois mundos, e quem abre este ecrã tem de saber em qual está
        antes de olhar para qualquer número.
      */}
      <div
        className={`rounded-xl border p-4 ${
          estado.armada
            ? "border-red-500/40 bg-red-500/[0.08]"
            : "border-emerald-500/30 bg-emerald-500/[0.06]"
        }`}
      >
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          {estado.armada ? (
            <>
              <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />A purga está
              ARMADA — apaga todas as noites
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              Modo seco — conta e não apaga nada
            </>
          )}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {estado.armada
            ? "Para travar, apague a variável PURGA_ARMADA na Vercel e faça um redeploy."
            : "Para armar: PURGA_ARMADA=sim na Vercel, e um redeploy. Confirme antes que há cópia de segurança da base — a purga não tem volta."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-2xl font-bold text-white">{estado.elegiveis}</p>
          <p className="mt-1 text-xs text-slate-400">
            pedidos cumprem a regra hoje
            <span className="mt-1 block text-[11px] text-slate-500">
              {estado.diasDosTerminados} dias os terminados, {estado.diasDosAbandonados} os
              abandonados
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-2xl font-bold text-white">{estado.naProximaPassagem}</p>
          <p className="mt-1 text-xs text-slate-400">
            iriam na próxima passagem
            {estado.restantes > 0 && (
              <span className="mt-1 block text-[11px] text-amber-300">
                e {estado.restantes} ficariam para a noite seguinte
              </span>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="flex items-center gap-2 text-2xl font-bold text-white">
            <Camera className="h-5 w-5 text-slate-400" aria-hidden="true" />
            {estado.fotografias}
          </p>
          <p className="mt-1 text-xs text-slate-400">fotografias sairiam com eles</p>
        </div>
      </div>

      {/*
        OS NÚMEROS DOS PEDIDOS, e não só a contagem. Antes de armar uma coisa
        irreversível, quem decide tem de poder abrir dois ou três e ver se são
        mesmo o que pensa que são.
      */}
      {estado.naMira.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold text-slate-300">
            Os que iriam na próxima passagem — abra um ou dois antes de decidir:
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-slate-400">
            {estado.naMira.map((id) => `#${id}`).join("  ")}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />O que a purga escreveu no registo
          permanente
        </p>
        {estado.ultimas.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Ainda nada. O cron corre às 04:30; a primeira linha aparece amanhã.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {estado.ultimas.map((l) => (
              <li key={l.id} className="text-xs leading-relaxed text-slate-400">
                <span className="text-slate-500">{quando(l.ocorridoEm)}</span> — {l.resumo}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => void carregar()}
        disabled={aCarregar}
        className="flex min-h-[36px] items-center gap-2 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
      >
        {aCarregar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Contar outra vez
      </button>
    </div>
  );
}
