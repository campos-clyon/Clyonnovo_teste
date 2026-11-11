"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { BOTOES_DA_MESA, SELO_SEM_RESPOSTA, type EstadoNaMesa } from "@/lib/escolhidos-sem-resposta";

/**
 * OS ESCOLHIDOS SEM RESPOSTA, NO CARTÃO DO PEDIDO — 11-11-2026 (d6).
 *
 * Numa mudança em que o cliente escolheu os parceiros da lista: o selo âmbar
 * quando o prazo passou sem resposta, a linha do que se sabe do cliente e os
 * dois botões da equipa. «Enviar a mais profissionais» só fica activo quando
 * o cliente pediu (a rota recusa de qualquer maneira); um pedido feito por
 * telefone ou WhatsApp regista-se primeiro. O selo, a linha e o que os botões
 * podem fazer chegam escritos da rota (`estadoNaMesa`).
 */
export function EscolhidosNaMesa({
  estado,
  aEnviar,
  onEnviarAMais,
  onRegistar,
}: {
  estado: EstadoNaMesa;
  aEnviar: boolean;
  onEnviarAMais: () => void;
  onRegistar: () => Promise<void> | void;
}) {
  const [aPerguntar, setAPerguntar] = useState(false);
  const [aRegistar, setARegistar] = useState(false);
  if (!estado.selo && !estado.linha && !estado.podeRegistarOPedido) return null;

  return (
    <div className={`rounded-lg border p-3 ${estado.selo ? "border-amber-500/40 bg-amber-500/10" : "border-slate-700 bg-slate-800/40"}`}>
      {estado.selo && (
        <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-xs font-semibold text-amber-200">{SELO_SEM_RESPOSTA}</span>
      )}
      {estado.linha && <p className={`text-xs leading-relaxed text-slate-200 ${estado.selo ? "mt-1.5" : ""}`}>{estado.linha}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onEnviarAMais}
          disabled={!estado.podeEnviarAMais || aEnviar}
          title={estado.podeEnviarAMais ? undefined : BOTOES_DA_MESA.dicaDoEnviarDesligado}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {aEnviar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {BOTOES_DA_MESA.enviarAMais}
        </button>
        {estado.podeRegistarOPedido && !aPerguntar && (
          <button
            type="button"
            onClick={() => setAPerguntar(true)}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800/60"
          >
            {BOTOES_DA_MESA.clientePediu}
          </button>
        )}
      </div>
      {!estado.podeEnviarAMais && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{BOTOES_DA_MESA.dicaDoEnviarDesligado}</p>}
      {aPerguntar && (
        <div className="mt-2 rounded-lg border border-slate-600 bg-slate-900/60 p-2.5">
          <p className="text-xs font-medium text-slate-100">{BOTOES_DA_MESA.perguntaDoRegisto}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={aRegistar}
              onClick={async () => {
                setARegistar(true);
                try {
                  await onRegistar();
                } finally {
                  setARegistar(false);
                  setAPerguntar(false);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {aRegistar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {BOTOES_DA_MESA.registar}
            </button>
            <button
              type="button"
              disabled={aRegistar}
              onClick={() => setAPerguntar(false)}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
            >
              {BOTOES_DA_MESA.voltar}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
