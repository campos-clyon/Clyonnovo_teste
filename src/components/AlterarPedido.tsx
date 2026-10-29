"use client";

import { useState } from "react";
import { TEXTOS_DA_ALTERACAO } from "@/lib/alteracoes-do-cliente";

/**
 * «ALTERAR O PEDIDO», NO SITE — 29-10-2026 (S17). O link do pedido e a conta
 * mudam o dia ou juntam pormenores pela mesma rota da app (R13). Antes da
 * análise aplica-se; depois vai à CLYON. As fotografias continuam pelo
 * WhatsApp no site; na app juntam-se aqui.
 */
export default function AlterarPedido({
  pedidoId,
  token,
  textoQuandoNaoPode,
  pode,
}: {
  pedidoId: number;
  /** O link do site; na conta, nada (vai a sessão). */
  token?: string;
  pode: boolean;
  textoQuandoNaoPode?: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState("");
  const [pormenores, setPormenores] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [resposta, setResposta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const amanha = (() => {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(Date.now() + 86_400_000),
    );
    return p;
  })();

  if (!pode) {
    return textoQuandoNaoPode ? <p className="mt-4 text-sm text-slate-600">{textoQuandoNaoPode}</p> : null;
  }

  async function guardar() {
    const corpo: Record<string, unknown> = {};
    if (dia) corpo.dataPreferida = dia;
    if (pormenores.trim()) corpo.pormenores = pormenores.trim();
    if (Object.keys(corpo).length === 0) {
      setErro("Escolha um dia ou escreva os pormenores.");
      return;
    }
    if (token) corpo.token = token;
    setAEnviar(true);
    setErro(null);
    try {
      const r = await fetch(`/api/cliente/pedidos/${pedidoId}/alteracao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível guardar. Tente outra vez.");
      setResposta(d.mensagem ?? "Alteração enviada.");
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível guardar. Tente outra vez.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      {resposta ? (
        <p className="text-sm font-semibold text-emerald-700">{resposta}</p>
      ) : !aberto ? (
        <button type="button" onClick={() => setAberto(true)} className="text-sm font-semibold text-acao underline">
          Alterar o pedido
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-tinta">O que quer mudar?</p>
          <label className="block text-sm text-slate-700">
            O dia
            <input type="date" min={amanha} value={dia} onChange={(e) => setDia(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm text-slate-700">
            Acrescentar pormenores
            <textarea rows={3} maxLength={1000} value={pormenores} onChange={(e) => setPormenores(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <p className="text-xs text-slate-500">{TEXTOS_DA_ALTERACAO.sempre}</p>
          <button type="button" disabled={aEnviar} onClick={() => void guardar()}
            className="w-full rounded-xl bg-acao px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {aEnviar ? "A guardar…" : "Guardar a alteração"}
          </button>
        </div>
      )}
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </section>
  );
}
