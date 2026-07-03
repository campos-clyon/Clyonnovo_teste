"use client";

import { useCallback, useEffect, useState } from "react";
import { useProviderAuth } from "@/hooks/useProviderAuth";

interface ProviderOrder {
  id: number;
  serviceType: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  floor: string | null;
  hasElevator: string | null;
  urgency: string | null;
  precoFinal: string | null;
  precoFinalIva: string | null;
  status: string;
  providerAcceptedAt: string | null;
  createdAt: string;
}

export default function ParceiroDashboardClient() {
  const { provider, ready, authHeader, logout } = useProviderAuth();
  const [available, setAvailable] = useState<ProviderOrder[]>([]);
  const [mine, setMine] = useState<ProviderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parceiros/pedidos", { headers: authHeader });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar pedidos.");
        return;
      }
      setAvailable(data.available ?? []);
      setMine(data.mine ?? []);
    } catch {
      setError("Erro de ligação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    if (!ready) return;
    void loadPedidos();
  }, [ready, loadPedidos]);

  async function handleAceitar(orderId: number) {
    setAcceptingId(orderId);
    setError("");
    try {
      const res = await fetch(`/api/parceiros/pedidos/${orderId}/aceitar`, {
        method: "POST",
        headers: authHeader,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível aceitar este pedido.");
        await loadPedidos();
        return;
      }
      await loadPedidos();
    } catch {
      setError("Erro de ligação. Tente novamente.");
    } finally {
      setAcceptingId(null);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center">
        <p className="text-sm text-slate-400">A carregar...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080F1A] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">CLYON</p>
            <h1 className="text-2xl font-bold text-white">Olá, {provider?.name}</h1>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.04]"
          >
            Sair
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-white">Trabalhos disponíveis</h2>
          {loading ? (
            <p className="text-sm text-slate-400">A carregar...</p>
          ) : available.length === 0 ? (
            <p className="text-sm text-slate-400">Sem trabalhos disponíveis na tua zona neste momento.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {available.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(15,25,42,0.98)_0%,rgba(9,18,32,0.98)_100%)] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{order.serviceType ?? "Serviço"}</p>
                      <p className="mt-1 text-xs text-slate-400">{order.city ?? "Zona não indicada"}</p>
                    </div>
                    {order.precoFinalIva && (
                      <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                        {Number(order.precoFinalIva).toFixed(2)} €
                      </span>
                    )}
                  </div>
                  {order.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-slate-400">{order.description}</p>
                  )}
                  <button
                    onClick={() => handleAceitar(order.id)}
                    disabled={acceptingId === order.id}
                    className="mt-4 w-full rounded-2xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {acceptingId === order.id ? "A aceitar..." : "Aceitar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold text-white">Os meus trabalhos</h2>
          {loading ? (
            <p className="text-sm text-slate-400">A carregar...</p>
          ) : mine.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda não aceitaste nenhum trabalho.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {mine.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5"
                >
                  <p className="text-sm font-semibold text-white">{order.serviceType ?? "Serviço"}</p>
                  <p className="mt-1 text-xs text-slate-400">{order.city ?? "Zona não indicada"}</p>
                  {order.address && <p className="mt-2 text-xs text-slate-500">{order.address}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
