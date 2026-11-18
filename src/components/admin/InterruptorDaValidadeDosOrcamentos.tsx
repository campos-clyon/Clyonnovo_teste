"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { NOME_DO_INTERRUPTOR_DA_VALIDADE } from "@/lib/validade-do-orcamento";

/**
 * O INTERRUPTOR «VALIDADE DOS ORÇAMENTOS» — Configs (d62, 18-11-2026).
 *
 * DESLIGADO POR OMISSÃO. Liga-se só com o sim do dono, depois de ver os
 * primeiros cartões na Mesa. Só o administrador o vê e muda; para ligar
 * escreve-se LIGAR. Desligado, nada sai e nada fecha — a Mesa mostra só
 * «fecharia a …» nos cartões de «A aguardar cliente».
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

export default function InterruptorDaValidadeDosOrcamentos() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [palavra, setPalavra] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/interruptor-da-validade", {
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
      const r = await fetch("/api/admin/interruptor-da-validade", {
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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DA_VALIDADE}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        O orçamento vale 3 dias. Ligado, a Vitória manda ao cliente um lembrete no dia seguinte ao envio e o último aviso
        ao terceiro dia (das 9h às 21h, nunca dois no mesmo dia), e o pedido fecha no quarto dia às 18h se ele não
        responder — os parceiros com proposta são avisados. Uma resposta dele pára a contagem e passa à equipa.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-red-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado — nada sai e nada fecha; a Mesa mostra «fecharia a …»"}
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
              aria-label="Escreva LIGAR para ligar a validade dos orçamentos"
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
