"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { NOME_DO_INTERRUPTOR_DA_LINHA_DA_APP } from "@/lib/linha-da-app-nas-propostas";

/**
 * O INTERRUPTOR «A APP NO AVISO DE PROPOSTAS» — Configs (d106, 24-11-2026;
 * secção 0 da v3 da d107).
 *
 * DESLIGADO POR OMISSÃO. Liga-se só com o sim do dono. Só o administrador o
 * vê e muda; para ligar escreve-se LIGAR.
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

export default function InterruptorDaLinhaDaApp() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [palavra, setPalavra] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/interruptor-da-linha-da-app", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) setEstado((await r.json()) as Estado);
    } catch {
      /* fica o que se tinha */
    }
  }, [token]);

  useEffect(() => {
    if (ready && eAdministrador) void ler();
  }, [ready, eAdministrador, ler]);

  async function mudar(ligar: boolean) {
    if (!token) return;
    setAMudar(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/interruptor-da-linha-da-app", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ligar, confirmacao: palavra }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível mudar.");
        return;
      }
      setEstado(d as Estado);
      setPalavra("");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAMudar(false);
    }
  }

  if (!eAdministrador) return null;
  const ligado = estado?.ligado === true;
  const quando = estado?.mudadoEm
    ? new Date(estado.mudadoEm).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DA_LINHA_DA_APP}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Ligado, o email «Tem uma proposta» leva, uma vez por cliente, a linha da app CLYON (Android) com a ligação dele e
        a recusa em letra pequena. Não sai a quem recebeu o convite ou o lembrete de 17/11, a quem já abriu a app, a quem
        está no «não contactar» ou recusou as mensagens sobre a app.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-red-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado — o aviso de propostas sai sem a linha da app"}
        {quando && <span className="ml-2 text-xs font-normal text-slate-400">({quando}{estado?.porQuem ? `, ${estado.porQuem}` : ""})</span>}
      </p>
      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
      {estado != null &&
        (ligado ? (
          <button
            type="button"
            onClick={() => mudar(false)}
            disabled={aMudar}
            className="mt-3 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
          >
            Desligar
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
              placeholder="Escreva LIGAR"
              aria-label="Escreva LIGAR para pôr a linha da app no aviso de propostas"
              className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => mudar(true)}
              disabled={aMudar || palavra.trim().toUpperCase() !== "LIGAR"}
              className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-40"
            >
              Ligar (só com o sim do dono)
            </button>
          </div>
        ))}
    </div>
  );
}
