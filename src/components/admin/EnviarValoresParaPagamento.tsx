"use client";

import { useState } from "react";
import { Copy, Loader2, Send } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  LINK_POR_GERAR,
  mensagemDosValoresParaPagamento,
  type ValoresParaPagamento,
} from "@/lib/valores-para-pagamento";

/**
 * «ENVIAR VALORES PARA PAGAMENTO» — 05-11-2026 (decisão d19).
 *
 * No cartão do Trabalho CLYON (na Mesa e nos Trabalhos CLYON), no lugar do
 * «Enviar pela CLYON». Abre a mensagem pronta — os valores da conta do
 * trabalho e o link do pedido, onde o cliente paga —, a equipa lê-a e pode
 * editá-la, e sai pelo WhatsApp da CLYON. O servidor volta a fazer a conta e
 * gera o link no momento do envio. Ver `valores-para-pagamento.ts`.
 */
export default function EnviarValoresParaPagamento({
  valores,
  onMudou,
}: {
  valores: Omit<ValoresParaPagamento, "link">;
  onMudou: () => void;
}) {
  const { token } = useAdminAuth();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [resposta, setResposta] = useState<{ ok: boolean; texto: string; mensagem?: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  function abrir() {
    if (!aberto) setTexto(mensagemDosValoresParaPagamento(valores, new Date()));
    setResposta(null);
    setAberto((v) => !v);
  }

  async function enviar() {
    if (!token || !texto.trim()) return;
    if (!window.confirm(`Enviar os valores para pagamento do #${valores.pedidoId} ao cliente, pelo WhatsApp da CLYON?`)) return;
    setAEnviar(true);
    setResposta(null);
    try {
      const res = await fetch("/api/admin/trabalhos-clyon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId: valores.pedidoId, accao: "valores_para_pagamento", texto }),
      });
      const d = (await res.json().catch(() => ({}))) as { feito?: string; error?: string; texto?: string };
      if (res.ok) {
        setResposta({ ok: true, texto: d.feito ?? "Enviado." });
        setAberto(false);
        onMudou();
      } else {
        setResposta({ ok: false, texto: d.error ?? "Não foi possível enviar.", mensagem: d.texto });
      }
    } catch {
      setResposta({ ok: false, texto: "Erro de rede." });
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className={aberto || resposta ? "flex w-full flex-col gap-2" : "contents"}>
      <button
        type="button"
        onClick={abrir}
        title="Mostra a mensagem com os valores finais e o link do pedido, para enviar pelo WhatsApp da CLYON"
        className="flex items-center gap-1.5 self-start rounded-lg border border-emerald-600/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
      >
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        Enviar valores para pagamento
      </button>

      {aberto && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-200">
          <p className="font-semibold text-slate-100">A mensagem ao cliente</p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={16}
            aria-label="A mensagem com os valores para pagamento"
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 font-sans text-xs leading-relaxed text-slate-100"
          />
          <p className="mt-1.5 text-slate-400">
            O link do pedido nasce ao enviar, no lugar de «{LINK_POR_GERAR}» — e o link antigo deixa de abrir. O total a
            pagar tem de ficar na mensagem.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={aEnviar || !texto.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 font-bold text-white hover:bg-acao-hover disabled:opacity-50"
            >
              {aEnviar ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
              Enviar pelo WhatsApp da CLYON
            </button>
            <button
              type="button"
              onClick={() => setTexto(mensagemDosValoresParaPagamento(valores, new Date()))}
              disabled={aEnviar}
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
            >
              Repor a mensagem
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              disabled={aEnviar}
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {resposta && (
        <div className={`text-[11px] ${resposta.ok ? "text-emerald-300" : "text-red-300"}`}>
          {resposta.texto}
          {resposta.mensagem && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(resposta.mensagem as string);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1800);
              }}
              className="ml-2 inline-flex items-center gap-1 rounded border border-slate-600 px-1.5 py-0.5 text-slate-200"
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
              {copiado ? "Copiada" : "Copiar a mensagem, com o link"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
