"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

/**
 * «O CLIENTE PERGUNTA SE CONSEGUE…» — 23-11-2026 (d97).
 *
 * Um cliente quer escolher a proposta dele com uma condição («até quinta»,
 * «só de manhã»). A Vitória pergunta-lhe no WhatsApp dos avisos e na app; aqui
 * responde num toque — SIM (e quando, se quiser) ou NÃO — e a resposta segue
 * para o cliente. Sem perguntas em aberto, não aparece nada.
 */
type Pergunta = { id: number; pedidoId: number; condicao: string; prazoEm: string };

const ROTA = "/api/profissionais/pergunta-do-cliente";

const ate = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function PerguntaDoCliente() {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);

  const ler = useCallback(async () => {
    try {
      const r = await fetch(ROTA, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { perguntas?: Pergunta[] };
      setPerguntas(Array.isArray(d.perguntas) ? d.perguntas : []);
    } catch {
      /* sem as perguntas, o painel fica como antes */
    }
  }, []);

  useEffect(() => {
    void ler();
  }, [ler]);

  if (perguntas.length === 0) return null;
  return (
    <>
      {perguntas.map((p) => (
        <UmaPergunta key={p.id} pergunta={p} />
      ))}
    </>
  );
}

function UmaPergunta({ pergunta }: { pergunta: Pergunta }) {
  const [quando, setQuando] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<string | null>(null);

  async function responder(resposta: "sim" | "nao") {
    setAEnviar(true);
    setErro("");
    try {
      const r = await fetch(ROTA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perguntaId: pergunta.id, resposta, quando: resposta === "sim" ? quando : null }),
      });
      const d = (await r.json().catch(() => ({}))) as { texto?: string; error?: string };
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível guardar a resposta.");
        return;
      }
      setFeito(d.texto ?? "Obrigado! A sua resposta já seguiu para o cliente.");
    } catch {
      setErro("Sem ligação. Tente de novo, ou responda no WhatsApp.");
    } finally {
      setAEnviar(false);
    }
  }

  if (feito) {
    return (
      <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
        <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          {feito}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="text-base font-bold text-amber-950">O cliente do pedido #{pergunta.pedidoId} quer escolher a sua proposta</h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-900">
        Com uma condição: «{pergunta.condicao}». Consegue?
        {pergunta.prazoEm ? ` Responda até ${ate(pergunta.prazoEm)}, para o cliente não ficar à espera.` : ""}
      </p>
      {erro && (
        <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-700">
          {erro}
        </p>
      )}
      <label className="mt-3 block text-sm font-medium text-amber-950" htmlFor={`quando-${pergunta.id}`}>
        Quando pode ir (opcional)
      </label>
      <input
        id={`quando-${pergunta.id}`}
        type="text"
        value={quando}
        onChange={(e) => setQuando(e.target.value)}
        maxLength={80}
        placeholder="por exemplo: quinta às 15h"
        className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void responder("sim")}
          disabled={aEnviar}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Sim, consigo
        </button>
        <button
          type="button"
          onClick={() => void responder("nao")}
          disabled={aEnviar}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Não consigo
        </button>
      </div>
    </section>
  );
}
