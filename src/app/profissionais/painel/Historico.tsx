"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { CabecalhoDeEcra, euros } from "@/components/portal/Portal";
import type { Movimento } from "./tipos";

/**
 * O histórico da carteira: ano, depois mês, depois os movimentos.
 *
 * Uma lista corrida de tudo funciona no primeiro mês e deixa de funcionar no
 * segundo ano. Descer por ano e mês é como se procura de facto — "quanto fiz em
 * Maio?" — e cada nível cabe num ecrã sem rolar.
 *
 * Os meses vazios não aparecem. Uma lista com doze meses e nove deles a zero
 * obriga a procurar o que interessa no meio do que não existe.
 */

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const FASE: Record<string, string> = {
  a_executar: "por fazer",
  a_confirmar: "à espera da confirmação",
  confirmado: "confirmado",
  pago: "pago",
  pedido: "a caminho",
  recusado: "recusada",
};

function quando(m: Movimento): Date {
  return new Date(m.data);
}

export default function Historico({
  movimentos,
  onVoltar,
}: {
  movimentos: Movimento[];
  onVoltar: () => void;
}) {
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);

  const validos = movimentos.filter((m) => !Number.isNaN(quando(m).getTime()));

  // ── Movimentos de um mês ──────────────────────────────────────────────────
  if (ano != null && mes != null) {
    const doMes = validos.filter((m) => {
      const d = quando(m);
      return d.getFullYear() === ano && d.getMonth() === mes;
    });
    const total = doMes.reduce((s, m) => s + m.valor, 0);

    return (
      <>
        <CabecalhoDeEcra titulo={`${MESES[mes]} ${ano}`} onVoltar={() => setMes(null)} />

        <div className="mb-3 flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">Neste mês</span>
          <span
            className={`text-lg font-bold ${total >= 0 ? "text-emerald-600" : "text-slate-700"}`}
          >
            {total >= 0 ? "+" : ""}
            {euros(total)}
          </span>
        </div>

        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-[#E2EEF3] bg-white shadow-sm">
          {doMes.map((m) => (
            <div key={`${m.tipo}-${m.id}`} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  m.valor >= 0 ? "bg-emerald-50" : "bg-slate-100"
                }`}
              >
                {m.valor >= 0 ? (
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[#0B1929]">{m.titulo}</div>
                <div className="text-xs text-slate-400">
                  {quando(m).toLocaleDateString("pt-PT")}
                  {m.zona ? ` · ${m.zona}` : ""}
                  {FASE[m.fase] ? ` · ${FASE[m.fase]}` : ""}
                </div>
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${
                  m.valor >= 0 ? "text-emerald-600" : "text-slate-600"
                }`}
              >
                {m.valor >= 0 ? "+" : ""}
                {euros(m.valor)}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ── Meses de um ano ───────────────────────────────────────────────────────
  if (ano != null) {
    const meses = [...new Set(
      validos.filter((m) => quando(m).getFullYear() === ano).map((m) => quando(m).getMonth()),
    )].sort((a, b) => b - a);

    return (
      <>
        <CabecalhoDeEcra titulo={String(ano)} onVoltar={() => setAno(null)} />
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-[#E2EEF3] bg-white shadow-sm">
          {meses.map((m) => (
            <button
              key={m}
              onClick={() => setMes(m)}
              className="flex min-h-[56px] w-full items-center px-4 text-left transition active:bg-slate-50"
            >
              <span className="flex-1 text-[15px] font-medium text-[#0B1929]">{MESES[m]}</span>
              <ChevronRight className="h-5 w-5 text-slate-300" aria-hidden="true" />
            </button>
          ))}
        </div>
      </>
    );
  }

  // ── Anos ──────────────────────────────────────────────────────────────────
  const anos = [...new Set(validos.map((m) => quando(m).getFullYear()))].sort((a, b) => b - a);

  return (
    <>
      <CabecalhoDeEcra titulo="Histórico" onVoltar={onVoltar} />
      {anos.length === 0 ? (
        <div className="rounded-2xl border border-[#E2EEF3] bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            Ainda não há movimentos. O primeiro aparece assim que fechar um trabalho.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-[#E2EEF3] bg-white shadow-sm">
          {anos.map((a) => (
            <button
              key={a}
              onClick={() => setAno(a)}
              className="flex min-h-[56px] w-full items-center px-4 text-left transition active:bg-slate-50"
            >
              <span className="flex-1 text-[15px] font-medium text-[#0B1929]">{a}</span>
              <ChevronRight className="h-5 w-5 text-slate-300" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
