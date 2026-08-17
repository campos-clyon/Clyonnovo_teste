"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Mail, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Negociacao = {
  id: number;
  providerId: number;
  profissionalNome: string;
  profissionalEmail: string | null;
  estado: string;
  valorAcordado: string | null;
};

type Pedido = {
  id: number;
  serviceType: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  valorMinimoCliente: string | null;
  createdAt: string;
  negociacoes: Negociacao[];
};

const ESTADO_CLS: Record<string, string> = {
  aberta: "bg-blue-500/15 text-blue-300",
  aguarda_contratacao: "bg-amber-500/15 text-amber-300",
  acordada: "bg-emerald-500/15 text-emerald-300",
  desistida: "bg-slate-700 text-slate-300",
  morta: "bg-slate-700 text-slate-400",
};

export default function AdminNegociacoesPanel() {
  const { token, ready } = useAdminAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [linksEmClaro, setLinksEmClaro] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/negociacoes", {
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
    if (ready && token) carregar();
  }, [ready, token, carregar]);

  async function reenviar(chave: string, corpo: Record<string, unknown>) {
    if (!token) return;
    setOcupado(chave);
    setErro("");
    try {
      const res = await fetch("/api/admin/negociacoes/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível reenviar.");
        return;
      }
      // Quando o email não sai, o token vem na resposta — é a única forma de
      // lá chegar, porque na base só existe o hash.
      if (dados.token) {
        setLinksEmClaro((l) => ({ ...l, [chave]: dados.token }));
      } else {
        setLinksEmClaro((l) => {
          const c = { ...l };
          delete c[chave];
          return c;
        });
      }
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  if (!ready || aCarregar) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <p className="text-sm text-slate-400">
          {pedidos.length} pedidos com valores.
        </p>
        <button
          onClick={carregar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Actualizar
        </button>
      </header>

      {erro && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      )}

      {pedidos.length === 0 && (
        <p className="rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-8 text-center text-sm text-slate-500">
          Ainda não há pedidos criados pelo formulário novo.
        </p>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => {
          const chaveCliente = `c${p.id}`;
          return (
            <article key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    #{p.id} · {p.serviceType ?? "—"}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {p.contactName} · {p.contactEmail} · {p.city ?? "—"}
                    {p.valorMinimoCliente && ` · quer pagar ${p.valorMinimoCliente} €`}
                  </p>
                </div>
                <button
                  onClick={() => reenviar(chaveCliente, { pedidoId: p.id, para: "cliente" })}
                  disabled={ocupado === chaveCliente}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {ocupado === chaveCliente ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Reenviar ao cliente
                </button>
              </div>

              {linksEmClaro[chaveCliente] && (
                <LinkEmClaro
                  caminho={`/pedido/${linksEmClaro[chaveCliente]}`}
                  aviso="O email não saiu. Use este link."
                />
              )}

              <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                {p.negociacoes.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Nenhum profissional foi notificado. Veja o histórico do pedido para
                    perceber porquê.
                  </p>
                )}
                {p.negociacoes.map((n) => {
                  const chave = `n${n.id}`;
                  return (
                    <div key={n.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-100">
                            {n.profissionalNome}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              ESTADO_CLS[n.estado] ?? "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {n.estado}
                          </span>
                          {n.valorAcordado && (
                            <span className="text-xs text-slate-500">{n.valorAcordado} €</span>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            reenviar(chave, { pedidoId: p.id, negociacaoId: n.id })
                          }
                          disabled={ocupado === chave}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800/60 disabled:opacity-50"
                        >
                          {ocupado === chave ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <Mail className="h-3 w-3" aria-hidden="true" />
                          )}
                          Reenviar
                        </button>
                      </div>
                      {linksEmClaro[chave] && (
                        <LinkEmClaro
                          caminho={`/profissionais/pedidos/${linksEmClaro[chave]}`}
                          aviso="O email não saiu. Use este link."
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function LinkEmClaro({ caminho, aviso }: { caminho: string; aviso: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${caminho}` : caminho;

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
      <p className="text-xs font-semibold text-amber-200">{aviso}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-300">
          {url}
        </code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          }}
          className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
