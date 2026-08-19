"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Send } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * Os pedidos de ajuda escritos na plataforma.
 *
 * Mais antigo primeiro: numa lista de apoio, quem espera há mais tempo é quem
 * tem de aparecer em cima. É a mesma ordem da lista que vem do Supabase, logo
 * acima nesta secção — as duas origens lêem-se da mesma maneira.
 *
 * A resposta aparece na conta do profissional, e é o único sítio onde ele a
 * vai ver. Fechar sem responder deixa-o com "resolvido" no ecrã e nada escrito
 * por baixo.
 */

type PedidoDeAjuda = {
  id: number;
  origem: string;
  nome: string | null;
  email: string | null;
  assuntoLabel: string;
  mensagem: string;
  estado: string;
  respostas: Array<{ texto: string; em: string; por: string }>;
  tratadoPor: string | null;
  createdAt: string;
};

const ESTADO: Record<string, { texto: string; cls: string }> = {
  open: { texto: "por ler", cls: "bg-red-500/15 text-red-300" },
  in_progress: { texto: "em curso", cls: "bg-amber-500/15 text-amber-300" },
  waiting_customer: { texto: "à espera dele", cls: "bg-cyan-500/15 text-cyan-300" },
  closed: { texto: "resolvido", cls: "bg-emerald-500/15 text-emerald-300" },
};

function haQuanto(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (!Number.isFinite(h) || h < 1) return "agora";
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

export default function AdminAjudaPanel() {
  const { token, ready } = useAdminAuth();
  const [pedidos, setPedidos] = useState<PedidoDeAjuda[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [resposta, setResposta] = useState<Record<number, string>>({});

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/ajuda", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setPedidos(dados.pedidos ?? []);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    if (ready) carregar();
  }, [ready, carregar]);

  async function responder(id: number, estado: string) {
    setOcupado(id);
    setErro("");
    try {
      const res = await fetch("/api/admin/ajuda", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, texto: resposta[id] ?? "", estado }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setResposta((r) => ({ ...r, [id]: "" }));
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const porTratar = pedidos.filter((p) => p.estado !== "closed").length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {porTratar === 0
            ? "Nada por tratar na plataforma."
            : `${porTratar} por tratar`}
        </p>
        <button
          onClick={carregar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {erro && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {pedidos.length === 0 && (
        <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          Nenhum pedido de ajuda escrito na plataforma.
        </p>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => (
          <article
            key={p.id}
            className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{p.assuntoLabel}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      (ESTADO[p.estado] ?? ESTADO.open).cls
                    }`}
                  >
                    {(ESTADO[p.estado] ?? ESTADO.open).texto}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    {p.origem}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {p.nome ?? "—"}
                  {p.email ? ` · ${p.email}` : ""} · {haQuanto(p.createdAt)}
                  {p.tratadoPor ? ` · tratado por ${p.tratadoPor}` : ""}
                </p>
              </div>
            </div>

            <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-950/60 p-3 text-sm text-slate-200">
              {p.mensagem}
            </p>

            {p.respostas.map((r, i) => (
              <div key={i} className="mt-2 rounded-xl bg-cyan-500/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
                  {r.por} · {new Date(r.em).toLocaleString("pt-PT")}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-cyan-100">{r.texto}</p>
              </div>
            ))}

            {p.estado !== "closed" && (
              <div className="mt-3">
                <textarea
                  value={resposta[p.id] ?? ""}
                  onChange={(e) => setResposta((r) => ({ ...r, [p.id]: e.target.value }))}
                  rows={2}
                  placeholder="Responder — aparece na conta dele"
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => responder(p.id, "waiting_customer")}
                    disabled={ocupado === p.id || !(resposta[p.id] ?? "").trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
                  >
                    {ocupado === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Responder
                  </button>
                  <button
                    onClick={() => responder(p.id, "closed")}
                    disabled={ocupado === p.id || !(resposta[p.id] ?? "").trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                    title="Responder e dar por resolvido"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Responder e fechar
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
