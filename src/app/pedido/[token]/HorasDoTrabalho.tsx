"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { NegociacaoNoEcra } from "@/lib/negociacao-no-ecra";
import { MOTIVO_MINIMO_DA_CONTESTACAO, MOTIVO_MAXIMO_DA_CONTESTACAO } from "@/lib/horas-do-trabalho";

/**
 * AS HORAS DO TRABALHO, DO LADO DO CLIENTE — 31-10-2026 (link do pedido e
 * /conta, que usa este mesmo ecrã). Num trabalho por hora: o preço por hora e
 * a estimativa e, depois de o parceiro marcar o início e o fim, «O parceiro
 * marcou das HH:MM às HH:MM = N h → total …» com «Confirmo as horas» e «Não
 * concordo» (com o porquê — vai à equipa da CLYON). Os textos vêm todos do
 * servidor (`horasParaOCliente`); este ecrã não faz contas.
 */
export default function HorasDoTrabalho({
  negociacao,
  aEnviar,
  soParaVer,
  onAgir,
}: {
  negociacao: NegociacaoNoEcra;
  aEnviar: boolean;
  soParaVer: boolean;
  onAgir: (accao: "confirmar_horas" | "contestar_horas", motivo?: string) => void;
}) {
  const h = negociacao.horas;
  const [aContestar, setAContestar] = useState(false);
  const [motivo, setMotivo] = useState("");
  if (!h) return null;
  const m = h.marcadas;
  const podeResponder =
    h.podeResponder &&
    negociacao.accoes.includes("confirmar_horas") &&
    negociacao.accoes.includes("contestar_horas") &&
    !soParaVer;
  const motivoValido = motivo.trim().length >= MOTIVO_MINIMO_DA_CONTESTACAO;

  return (
    <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 text-left">
      <h3 className="flex items-center gap-2 text-sm font-bold text-tinta">
        <Clock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        {h.titulo}
      </h3>
      {!m && (
        <>
          {h.porHoraTexto && <p className="mt-2 text-sm text-slate-700">{h.porHoraTexto}.</p>}
          {h.estimativaTexto && <p className="mt-1 text-xs text-slate-600">{h.estimativaTexto}</p>}
          <p className="mt-2 text-xs text-tinta-fraca">
            No fim, o parceiro marca a hora de início e a de fim, e confirma-as aqui.
          </p>
        </>
      )}
      {m && (
        <>
          <p className="mt-2 text-sm font-semibold text-tinta">{m.texto}</p>
          {m.materiais.length > 0 && (
            <p className="mt-1 text-xs text-slate-600">Materiais usados: {m.materiais.join(", ")}.</p>
          )}
          <p className="mt-1 text-xs text-slate-600">Total: {m.totalTexto}</p>
          {m.confirmadas && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {m.confirmadasPorTexto === "pela CLYON" ? "Horas confirmadas pela CLYON" : "Confirmou as horas"}
              {m.confirmadasEmTexto ? ` — ${m.confirmadasEmTexto}` : ""}.
            </p>
          )}
          {!m.confirmadas && h.estadoTexto && <p className="mt-2 text-xs text-emerald-800">{h.estadoTexto}</p>}
          {m.contestadas && m.contestacao && (
            <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">O que disse: «{m.contestacao}»</p>
          )}
        </>
      )}
      <p className="mt-2 text-[11px] text-tinta-fraca">{h.regraTexto}</p>

      {podeResponder && !aContestar && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => onAgir("confirmar_horas")}
            disabled={aEnviar}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition active:bg-emerald-700 disabled:opacity-50"
          >
            {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {h.botaoConfirmar}
          </button>
          <button
            type="button"
            onClick={() => setAContestar(true)}
            disabled={aEnviar}
            className="w-full py-1 text-center text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 disabled:opacity-50"
          >
            {h.botaoNaoConcordo}
          </button>
        </div>
      )}
      {podeResponder && aContestar && (
        <div className="mt-3">
          <label className="text-xs font-semibold text-slate-700" htmlFor={`motivo-horas-${negociacao.id}`}>
            Diga em poucas palavras porque não concorda
          </label>
          <textarea
            id={`motivo-horas-${negociacao.id}`}
            value={motivo}
            maxLength={MOTIVO_MAXIMO_DA_CONTESTACAO}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border-2 border-gray-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onAgir("contestar_horas", motivo.trim())}
              disabled={aEnviar || !motivoValido}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-slate-800 text-sm font-bold text-white disabled:opacity-50"
            >
              {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Enviar
            </button>
            <button
              type="button"
              onClick={() => setAContestar(false)}
              className="min-h-[48px] flex-1 rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-700"
            >
              Voltar
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">A equipa da CLYON vê consigo e com o parceiro.</p>
        </div>
      )}
    </div>
  );
}
