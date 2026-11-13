"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { PerguntaDoFecho } from "@/lib/fecho-do-modelo-novo";

/**
 * «O TRABALHO JÁ FOI FEITO?» — os dois botões (d15, 13-11-2026). Na página do
 * pedido (com a acção e a negociação no corpo) e na página do link do email.
 * Os textos chegam já escritos do servidor (`perguntaDoFechoParaOCliente`).
 */
export default function RespostaDoFecho({
  pergunta,
  urlDaResposta,
  corpoExtra,
  soParaVer = false,
  aoResponder,
}: {
  pergunta: PerguntaDoFecho;
  urlDaResposta: string;
  /** O que a rota precisa além da resposta (a acção e a negociação, na página do pedido). */
  corpoExtra?: Record<string, unknown>;
  soParaVer?: boolean;
  aoResponder?: (resposta: "sim" | "nao") => void;
}) {
  const [aEnviar, setAEnviar] = useState<"sim" | "nao" | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  async function responder(resposta: "sim" | "nao") {
    setAEnviar(resposta);
    setErro("");
    try {
      const res = await fetch(urlDaResposta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(corpoExtra ?? {}), resposta }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof dados.error === "string" ? dados.error : "Não foi possível.");
        return;
      }
      setFeito(typeof dados.mensagem === "string" ? dados.mensagem : "Obrigado.");
      aoResponder?.(resposta);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(null);
    }
  }

  if (feito) {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300 bg-white p-3 text-left text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {feito}
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 text-left">
      <h3 className="text-sm font-bold text-tinta">{pergunta.pergunta}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{pergunta.explicacao}</p>
      {erro && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}
      <button
        type="button"
        onClick={() => responder("sim")}
        disabled={soParaVer || aEnviar != null}
        className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition active:bg-emerald-700 disabled:opacity-50"
      >
        {aEnviar === "sim" ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        )}
        {pergunta.sim}
      </button>
      <button
        type="button"
        onClick={() => responder("nao")}
        disabled={soParaVer || aEnviar != null}
        className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-50"
      >
        {aEnviar === "nao" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {pergunta.nao}
      </button>
    </div>
  );
}
