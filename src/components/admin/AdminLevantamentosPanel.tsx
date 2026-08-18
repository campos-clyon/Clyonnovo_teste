"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * Os pedidos de transferência dos profissionais.
 *
 * Enquanto não houver ligação ao banco, a transferência faz-se à mão: copia-se
 * o IBAN, transfere-se, e marca-se como pago. O botão de copiar não é conforto
 * — é o que evita que alguém transcreva 25 caracteres à mão para o homebanking.
 *
 * Recusar exige um motivo. Sem ele, o profissional vê o saldo voltar sem
 * explicação nenhuma e a primeira coisa que faz é escrever para o apoio.
 */

type Levantamento = {
  id: number;
  providerId: number;
  profissionalNome: string | null;
  valor: number;
  iban: string;
  titular: string | null;
  estado: string;
  nota: string | null;
  processadoPor: string | null;
  processadoEm: string | null;
  createdAt: string;
};

const ESTADO_CLS: Record<string, string> = {
  pedido: "bg-amber-500/15 text-amber-300",
  pago: "bg-emerald-500/15 text-emerald-300",
  recusado: "bg-red-500/15 text-red-300",
};

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

export default function AdminLevantamentosPanel() {
  const { token, ready } = useAdminAuth();
  const [linhas, setLinhas] = useState<Levantamento[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState<number | null>(null);
  const [aRecusar, setARecusar] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    setACarregar(true);
    try {
      const res = await fetch("/api/admin/levantamentos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Erro ao carregar.");
        return;
      }
      setLinhas(dados.levantamentos ?? []);
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

  async function processar(id: number, estado: "pago" | "recusado", nota?: string) {
    setOcupado(id);
    setErro("");
    try {
      const res = await fetch("/api/admin/levantamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, estado, nota }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível.");
        return;
      }
      setARecusar(null);
      setMotivo("");
      await carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setOcupado(null);
    }
  }

  if (aCarregar) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const porProcessar = linhas.filter((l) => l.estado === "pedido");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {porProcessar.length === 0
            ? "Nada por transferir."
            : `${porProcessar.length} por transferir · ${euros(
                porProcessar.reduce((s, l) => s + l.valor, 0),
              )}`}
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

      {linhas.length === 0 && (
        <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          Ainda ninguém pediu para levantar saldo.
        </p>
      )}

      <div className="space-y-3">
        {linhas.map((l) => (
          <article
            key={l.id}
            className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-white">
                    {l.profissionalNome ?? `#${l.providerId}`}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ESTADO_CLS[l.estado] ?? "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {l.estado}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  pedido a {new Date(l.createdAt).toLocaleString("pt-PT")}
                  {l.processadoEm &&
                    ` · processado a ${new Date(l.processadoEm).toLocaleString("pt-PT")} por ${l.processadoPor ?? "—"}`}
                </p>
              </div>
              <div className="text-right text-2xl font-bold text-emerald-300">
                {euros(l.valor)}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-950/60 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm text-slate-200">{l.iban}</div>
                {l.titular && <div className="text-xs text-slate-400">{l.titular}</div>}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(l.iban.replace(/\s/g, ""));
                  setCopiado(l.id);
                  setTimeout(() => setCopiado((c) => (c === l.id ? null : c)), 2000);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                {copiado === l.id ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copiado === l.id ? "copiado" : "copiar IBAN"}
              </button>
            </div>

            {l.nota && (
              <p className="mt-2 rounded-lg bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
                {l.nota}
              </p>
            )}

            {l.estado === "pedido" && (
              <div className="mt-3">
                {aRecusar === l.id ? (
                  <div className="space-y-2">
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Motivo da recusa — o profissional vê isto"
                      className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => processar(l.id, "recusado", motivo)}
                        disabled={ocupado === l.id || !motivo.trim()}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => {
                          setARecusar(null);
                          setMotivo("");
                        }}
                        className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => processar(l.id, "pago")}
                      disabled={ocupado === l.id}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {ocupado === l.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      )}
                      Já transferi
                    </button>
                    <button
                      onClick={() => setARecusar(l.id)}
                      disabled={ocupado === l.id}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Recusar
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
