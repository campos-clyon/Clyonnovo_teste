"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * AS AVALIAÇÕES QUE O CLIENTE RECEBEU, NO DETALHE DO PEDIDO — 01-11-2026.
 *
 * Só o administrador (a rota recusa os outros). Os Termos (§9) dizem ao
 * cliente que uma avaliação falsa, ofensiva ou com dados pessoais pode ser
 * removida: é aqui. Remover fica no registo.
 */
type Avaliacao = {
  id: number;
  parceiro: string | null;
  estrelas: number;
  comentario: string | null;
  quandoTexto: string | null;
};

export default function AvaliacoesAoClienteDoPedido({
  pedidoId,
  authHeader,
}: {
  pedidoId: number;
  authHeader: Record<string, string>;
}) {
  const [lista, setLista] = useState<Avaliacao[] | null>(null);
  const [erro, setErro] = useState("");
  const [aRemover, setARemover] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!authHeader.Authorization) return;
    try {
      const r = await fetch(`/api/admin/pedidos/${pedidoId}/avaliacao-ao-cliente`, { headers: authHeader });
      if (r.status === 403) {
        setLista(null);
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Não deu para ler as avaliações.");
      setLista(d.avaliacoes ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para ler as avaliações.");
    }
  }, [pedidoId, authHeader]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function remover(a: Avaliacao) {
    if (!window.confirm("Remover esta avaliação? O cliente deixa de a ver, e fica no registo quem a removeu.")) return;
    setARemover(a.id);
    setErro("");
    try {
      const r = await fetch(`/api/admin/pedidos/${pedidoId}/avaliacao-ao-cliente?avaliacao=${a.id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não deu para remover a avaliação.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para remover a avaliação.");
    } finally {
      setARemover(null);
    }
  }

  if (lista === null && !erro) return null;

  return (
    <div className="space-y-3 border-t border-white/10 pt-6">
      <h3 className="text-sm font-bold text-white">Avaliações que o cliente recebeu</h3>
      <p className="text-xs text-slate-400">Só o cliente as vê. Remova as falsas, ofensivas ou com dados pessoais.</p>
      {erro && <p className="text-xs text-rose-400">{erro}</p>}
      {lista && lista.length === 0 && <p className="text-xs text-slate-500">Nenhuma.</p>}
      {lista?.map((a) => (
        <div key={a.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white">
              {a.estrelas} de 5 estrelas{a.parceiro ? ` · ${a.parceiro}` : ""}
              {a.quandoTexto ? ` · ${a.quandoTexto}` : ""}
            </p>
            <button
              type="button"
              onClick={() => void remover(a)}
              disabled={aRemover === a.id}
              className="rounded-xl border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-400/10 disabled:opacity-60"
            >
              {aRemover === a.id ? "A remover..." : "Remover"}
            </button>
          </div>
          {a.comentario && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{a.comentario}</p>}
        </div>
      ))}
    </div>
  );
}
