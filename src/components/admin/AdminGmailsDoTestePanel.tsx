"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";

/*
 * «GMAILS PARA PÔR NO TESTE» — 27-10-2026.
 *
 * Os profissionais cujo Gmail do telemóvel não é o da conta escrevem-no no
 * painel (ConviteDaAppPro.tsx). Esta lista é o que a equipa copia para a
 * lista de testadores da Play Console. Só lê: nada aqui muda a conta dele.
 */

type Linha = { providerId: number; nome: string; gmail: string; escritoEm: string | null; temApp: boolean };

export default function AdminGmailsDoTestePanel({ onTotal }: { onTotal?: (n: number) => void }) {
  const { token, ready } = useAdminAuth();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);

  // `silencioso` é o do ciclo automático: esta lista não tem «a carregar» que pisque.
  const carregar = useCallback(async (silencioso = false) => {
    void silencioso;
    if (!token) return;
    try {
      const res = await fetch("/api/admin/profissionais/gmails-do-teste", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = (await res.json().catch(() => ({}))) as { gmails?: Linha[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Não consegui ler a lista.");
      setLinhas(d.gmails ?? []);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler a lista.");
    }
  }, [token]);

  useEffect(() => {
    if (ready) void carregar();
  }, [ready, carregar]);
  useAutoRefresh(() => carregar(true), { enabled: ready && Boolean(token) });

  // O número do separador: os que ainda não abriram a app — é o que pede acção.
  const porTratar = linhas.filter((l) => !l.temApp).length;
  useEffect(() => {
    onTotal?.(porTratar);
  }, [porTratar, onTotal]);

  function copiarTodos() {
    const texto = linhas.filter((l) => !l.temApp).map((l) => l.gmail).join(", ");
    if (!texto) return;
    void navigator.clipboard?.writeText(texto);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-400">
          Gmails que os profissionais escreveram no painel por o do telemóvel não ser o da conta.
          Acrescente-os à lista de testadores da Play Console.
        </p>
        {porTratar > 0 && (
          <button
            type="button"
            onClick={copiarTodos}
            className="flex items-center gap-2 rounded-xl border border-slate-600 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            {copiado ? <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copiado ? "Copiados" : `Copiar os ${porTratar} sem app`}
          </button>
        )}
      </div>
      {erro && <p className="mt-3 text-sm text-red-300">{erro}</p>}
      {linhas.length === 0 && !erro ? (
        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4 text-center text-sm text-slate-500">
          Nenhum Gmail por pôr no teste.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800 rounded-xl border border-slate-800">
          {linhas.map((l) => (
            <li key={l.providerId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-100">{l.nome}</span>
              <span className="font-mono text-cyan-300">{l.gmail}</span>
              {l.escritoEm && <span className="text-xs text-slate-500">escrito a {l.escritoEm}</span>}
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${l.temApp ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
                {l.temApp ? "já abriu a app" : "ainda sem app"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
