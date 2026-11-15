"use client";

import { useState } from "react";

/** O nome da língua em português — o mesmo de `NOME_DA_LINGUA` (lingua-do-cliente.ts). */
const NOME: Record<string, string> = { en: "inglês", es: "espanhol", fr: "francês" };

export type DescricaoDoPedidoProps = {
  pedidoId: number;
  token: string;
  descricao: string | null | undefined;
  /** d46: o texto como o cliente o escreveu noutra língua. */
  original?: string | null;
  lingua?: string | null;
  porTraduzir?: number | boolean | null;
  /** Calculado pelo servidor: a descrição ainda tem texto noutra língua. */
  noutraLingua?: boolean | null;
  /** O painel escuro (página do pedido) ou o claro (a janela do pedido). */
  escuro?: boolean;
  onTraduzida?: () => void;
};

/**
 * A DESCRIÇÃO DO PEDIDO NO BACKOFFICE — 15-11-2026 (decisão d46).
 *
 * Sempre em português. Por baixo, recolhido, «Dito pelo cliente (inglês): …»
 * — o que ele escreveu, como escreveu. Se o tradutor falhou, diz-se «Por
 * traduzir»; nos pedidos antigos noutra língua há o botão «Traduzir para
 * português» (um pedido de cada vez, fica no histórico).
 */
export default function DescricaoDoPedido(p: DescricaoDoPedidoProps) {
  const [aTraduzir, setATraduzir] = useState(false);
  const [nota, setNota] = useState<{ ok: boolean; texto: string } | null>(null);
  const porTraduzir = p.porTraduzir === true || Number(p.porTraduzir) === 1;
  const original = p.original?.trim() ? p.original : null;
  const nomeDaLingua = p.lingua ? NOME[p.lingua] : undefined;
  const rotulo = nomeDaLingua ? `Dito pelo cliente (${nomeDaLingua})` : "Dito pelo cliente";
  const podeTraduzir = porTraduzir || p.noutraLingua === true;

  const cor = p.escuro
    ? { texto: "text-slate-300", fraco: "text-slate-500", caixa: "border-white/[0.08] bg-white/[0.03]" }
    : { texto: "text-slate-700", fraco: "text-slate-500", caixa: "border-slate-200 bg-slate-50" };

  async function traduzir() {
    if (aTraduzir) return;
    setATraduzir(true);
    setNota(null);
    try {
      const res = await fetch(`/api/admin/pedidos/${p.pedidoId}/traduzir-descricao`, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.token}` },
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; mudou?: boolean; nota?: string };
      if (!res.ok) {
        setNota({ ok: false, texto: d.error ?? "Não foi possível traduzir a descrição." });
        return;
      }
      setNota({ ok: true, texto: d.mudou ? "Descrição traduzida para português. Ficou no histórico." : d.nota ?? "Nada a traduzir." });
      if (d.mudou) p.onTraduzida?.();
    } catch {
      setNota({ ok: false, texto: "Erro de rede." });
    } finally {
      setATraduzir(false);
    }
  }

  if (!p.descricao && !original) return null;
  return (
    <div className="space-y-2">
      {porTraduzir && (
        <p className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
          Descrição por traduzir — o tradutor falhou
        </p>
      )}
      {p.descricao && <p className={`whitespace-pre-line break-words text-sm leading-relaxed ${cor.texto}`}>{p.descricao}</p>}
      {original && original !== p.descricao && (
        <details className={`rounded-xl border px-3 py-2 ${cor.caixa}`}>
          <summary className={`cursor-pointer text-xs font-semibold ${cor.fraco}`}>{rotulo}</summary>
          <p className={`mt-2 whitespace-pre-line break-words text-xs leading-relaxed ${cor.fraco}`}>{original}</p>
        </details>
      )}
      {podeTraduzir && (
        <button
          type="button"
          onClick={traduzir}
          disabled={aTraduzir}
          className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-600 transition hover:bg-sky-400/20 disabled:opacity-50"
        >
          {aTraduzir ? "A traduzir…" : "Traduzir para português"}
        </button>
      )}
      {nota && <p className={`text-xs ${nota.ok ? "text-emerald-600" : "text-red-500"}`}>{nota.texto}</p>}
    </div>
  );
}
