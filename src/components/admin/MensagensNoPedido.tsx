"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { linhaDaMensagemNoPedido, rotuloDasMensagensNoPedido } from "@/lib/mensagem-no-suporte";
import { BOTAO_ABERTO, BOTAO_DA_LINHA, BOTAO_URGENTE, PAINEL_DA_LINHA } from "@/components/admin/linhaDaMesa";

/**
 * AS MENSAGENS NO PEDIDO POR RESPONDER — d140b (27-11-2026, dono).
 *
 * Na d140 entravam no «Precisa de si» e no contador dele; o #362 e o #346, de
 * há 66 dias e já resolvidos, ficavam lá sem forma de sair. Agora são um botão
 * pequeno próprio na linha discreta da Mesa («2 mensagens no pedido»), que
 * abre a lista; o «Precisa de si» volta a contar só os trabalhos.
 *
 * Contam só as da última semana, de pedidos vivos, que ninguém respondeu
 * depois (no pedido, no WhatsApp desse número). «Já está resolvido» tira a
 * linha, com quem e quando, sem apagar a mensagem.
 */

type Mensagem = { pedidoId: number; desde: string; ultima: string; motivo: string | null };

export default function MensagensNoPedido({
  token,
  onAbrirPedido,
}: {
  token: string | null;
  onAbrirPedido: (pedidoId: number) => void;
}) {
  const [lista, setLista] = useState<Mensagem[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [aResolver, setAResolver] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [lidoEm, setLidoEm] = useState(() => Date.now());

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/negociacoes/mensagens-no-pedido", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const d = (await r.json()) as { pedidos?: Mensagem[] };
      if (Array.isArray(d.pedidos)) {
        setLista(d.pedidos);
        setLidoEm(Date.now());
      }
    } catch {
      /* fica o que havia */
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);
  useAutoRefresh(() => carregar(), { enabled: Boolean(token) });

  async function jaEstaResolvido(pedidoId: number) {
    if (!token) return;
    setAResolver(pedidoId);
    setErro("");
    try {
      const r = await fetch("/api/admin/negociacoes/mensagens-no-pedido", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId }),
      });
      if (!r.ok) throw new Error();
      setLista((l) => (l ?? []).filter((m) => m.pedidoId !== pedidoId));
    } catch {
      setErro("Não foi possível marcar como resolvido. Tente outra vez.");
    } finally {
      setAResolver(null);
    }
  }

  if (!lista || lista.length === 0) return null;
  const relogio = new Date(lidoEm);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        title="Mensagens do cliente dentro do pedido, da última semana, que ninguém respondeu. Carregue para ver."
        className={`${BOTAO_DA_LINHA} ${aberto ? BOTAO_ABERTO : BOTAO_URGENTE}`}
      >
        <span className="font-bold tabular-nums">{lista.length}</span>
        {rotuloDasMensagensNoPedido(lista.length)}
      </button>
      {aberto && (
        <section className={PAINEL_DA_LINHA}>
          <h2 className="text-base font-bold text-white">
            Mensagens no pedido por responder <span className="text-amber-300">· {lista.length}</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Da última semana, de pedidos ainda abertos. Responda no Suporte (a resposta sai no pedido) ou, se já tratou de outra forma,
            carregue em «Já está resolvido».
          </p>
          {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
          <ul className="mt-3 space-y-1.5">
            {lista.map((m) => (
              <li
                key={m.pedidoId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs"
              >
                <button type="button" onClick={() => onAbrirPedido(m.pedidoId)} className="font-bold text-white hover:underline">
                  #{m.pedidoId}
                </button>
                <span className="text-slate-200">
                  {linhaDaMensagemNoPedido(m.desde, relogio)}
                  {m.motivo ? ` — ${m.motivo}` : ""}
                </span>
                <span className="ml-auto flex gap-2">
                  <a
                    href="/admin?section=suporte"
                    className="rounded-md border border-slate-600 px-2 py-0.5 font-semibold text-slate-200 hover:bg-slate-700"
                  >
                    Responder no Suporte
                  </a>
                  <button
                    type="button"
                    onClick={() => void jaEstaResolvido(m.pedidoId)}
                    disabled={aResolver === m.pedidoId}
                    className="rounded-md border border-slate-600 px-2 py-0.5 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {aResolver === m.pedidoId ? "A marcar…" : "Já está resolvido"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
