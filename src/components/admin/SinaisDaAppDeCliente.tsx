"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import { dataEHoraEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import { ROTULO_DE_ONDE } from "@/lib/sinais-da-app-de-cliente";

/**
 * CONTAS › PROGRAMA DA APP › «A APP DE CLIENTE NOS TELEMÓVEIS» — 24-11-2026
 * (d108). Por baixo de «Quem conta para os 12» (app de cliente):
 *
 *   · primeiras aberturas (o aviso sem identificador que a app manda uma vez)
 *     ao lado das aberturas com sessão — a diferença são os que instalam e
 *     não entram na conta;
 *   · o «Algo não funciona?»: o que cada pessoa escreveu, onde, a versão, o
 *     modelo e, se tinha sessão, o email da conta.
 *
 * Só o administrador (a rota é `requireAdminGeral`).
 */

type Problema = {
  id: number;
  texto: string;
  onde: string;
  versao: string;
  modelo: string | null;
  sistema: string | null;
  email: string | null;
  recebidoEm: string;
};
type Sinais = { aberturas: { dias: number; primeirasAberturas: number; aberturasComSessao: number }; problemas: Problema[] };

function quando(v: string | null): string {
  const d = instanteDaBase(v);
  return d ? dataEHoraEmLisboa(d) : "—";
}

export default function SinaisDaAppDeCliente() {
  const { token, ready } = useAdminAuth();
  const [s, setS] = useState<Sinais | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/app-cliente-sinais", { headers: { Authorization: `Bearer ${token}` } });
      const dados = await r.json();
      if (!r.ok) {
        setErro(dados.error ?? "Não foi possível carregar.");
        return;
      }
      setS(dados);
      setErro("");
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);
  useAutoRefresh(() => carregar(), { enabled: ready && Boolean(token) });

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">A app de cliente nos telemóveis</h3>
        <button
          type="button"
          onClick={() => void carregar()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {!s && !erro ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A ler…
        </p>
      ) : null}

      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-900">{s.aberturas.primeirasAberturas}</p>
              <p className="text-sm text-slate-600">Primeiras aberturas (com ou sem conta), últimos {s.aberturas.dias} dias</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-900">{s.aberturas.aberturasComSessao}</p>
              <p className="text-sm text-slate-600">Contas que abriram a app com sessão, últimos {s.aberturas.dias} dias</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            A primeira abertura chega sem identificador nenhum: diz quantos telemóveis abriram a app, não quem. Conta desde 24/11/2026; quem já
            tinha a app conta quando receber a atualização.
          </p>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">«Algo não funciona?» ({s.problemas.length})</h4>
            {s.problemas.length === 0 ? (
              <p className="text-sm text-slate-500">Ninguém escreveu nos últimos {s.aberturas.dias} dias.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {s.problemas.map((p) => (
                  <li key={p.id} className="p-3 text-sm">
                    <p className="whitespace-pre-line break-words text-slate-900">{p.texto}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ROTULO_DE_ONDE[p.onde] ?? p.onde} · versão {p.versao}
                      {p.modelo ? ` · ${p.modelo}` : ""}
                      {p.sistema ? ` · ${p.sistema}` : ""} · {quando(p.recebidoEm)} · {p.email ?? "sem conta"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
