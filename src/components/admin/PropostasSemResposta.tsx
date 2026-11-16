"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { LUGAR_DO_LINK, type Lembrete } from "@/lib/propostas-sem-resposta";

/**
 * PROPOSTAS HÁ MAIS DE 24 H SEM RESPOSTA DO CLIENTE — d54, 16-11-2026.
 *
 * No Início, pelo n.º do pedido (do maior para o menor). Cada linha tem o
 * «Copiar mensagem»: a mensagem vai para a área de transferência com os
 * valores já postos, e NADA se envia daqui — quem a copia é quem a manda.
 *
 * A das 24 h leva o link do pedido. O link do cliente não se guarda em claro
 * (só o hash), por isso copiar gera um link novo pela rota de sempre
 * («gerar link para enviar à mão») — e o anterior deixa de funcionar, como
 * diz o histórico do pedido. A das 72 h não leva link.
 */

type LembreteComMensagem = Lembrete & { mensagem: string; precisaDeLink: boolean };

export default function PropostasSemResposta({ token, onAbrir }: { token: string | null; onAbrir: () => void }) {
  const [lista, setLista] = useState<LembreteComMensagem[] | null>(null);
  const [estado, setEstado] = useState<Record<number, string>>({});
  const [aCopiar, setACopiar] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/propostas-sem-resposta", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.lembretes)) setLista(d.lembretes);
    } catch {
      /* fica o que havia */
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);
  useAutoRefresh(() => carregar(), { enabled: Boolean(token) });

  async function copiar(l: LembreteComMensagem) {
    if (!token) return;
    setACopiar(l.pedidoId);
    try {
      let texto = l.mensagem;
      if (l.precisaDeLink) {
        const r = await fetch("/api/admin/negociacoes/reenviar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pedidoId: l.pedidoId, para: "cliente", paraCopiar: true }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || typeof d.token !== "string") {
          setEstado((e) => ({ ...e, [l.pedidoId]: d.error ?? "Não foi possível gerar o link do pedido." }));
          return;
        }
        texto = texto.split(LUGAR_DO_LINK).join(`${window.location.origin}/pedido/${d.token}`);
      }
      await navigator.clipboard.writeText(texto);
      setEstado((e) => ({
        ...e,
        [l.pedidoId]: l.precisaDeLink
          ? "Copiada, com um link novo (o anterior deixou de funcionar). Não foi enviada."
          : "Copiada. Não foi enviada.",
      }));
    } catch {
      setEstado((e) => ({ ...e, [l.pedidoId]: "Não foi possível copiar." }));
    } finally {
      setACopiar(null);
    }
  }

  if (!lista || lista.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-base font-bold text-white">
        Propostas há mais de 24 h sem resposta do cliente <span className="text-amber-300">· {lista.length}</span>
      </h2>
      <p className="mt-0.5 text-xs text-slate-400">
        A mensagem copia-se pronta, com os valores; envie-a pelo WhatsApp do pedido. Nada sai sozinho.
      </p>
      <ul className="mt-3 space-y-2">
        {lista.map((l) => (
          <li key={l.pedidoId} className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={onAbrir} className="text-sm font-bold text-white hover:underline">
                #{l.pedidoId}
              </button>
              <span className="text-xs text-slate-300">{l.servico}</span>
              <span className="text-xs text-slate-400">
                · {l.quantas} {l.quantas === 1 ? "proposta" : "propostas"} · desde {l.valorDoCliente}
                {l.unidade}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  l.fase === "72h" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"
                }`}
              >
                há {l.horas} h
              </span>
              <button
                onClick={() => void copiar(l)}
                disabled={aCopiar === l.pedidoId}
                title={l.precisaDeLink ? "Copia a mensagem com um link novo do pedido" : "Copia a mensagem"}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
              >
                {aCopiar === l.pedidoId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Copiar mensagem
              </button>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{l.mensagem}</p>
            {estado[l.pedidoId] && <p className="mt-1 text-[11px] text-emerald-300">{estado[l.pedidoId]}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
