"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { NOME_DO_INTERRUPTOR_DO_SEGUIMENTO } from "@/lib/seguimento-do-cliente";

/**
 * O INTERRUPTOR DE EMERGÊNCIA «SEGUIMENTO DO CLIENTE» — Configs (d83, 21-11-2026).
 *
 * LIGADO POR OMISSÃO: só entram os pedidos que a equipa marca à mão com
 * «Falei com o cliente», no «Precisa de si». Desligar pára tudo — nada sai e
 * nada fecha, e os cartões mostram «enviaria a …». Só o administrador o vê e muda.
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

export default function InterruptorDoSeguimentoDoCliente() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/interruptor-do-seguimento", {
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
    if (!ligar && !window.confirm("Desligar o seguimento do cliente? Nenhuma mensagem sai e nenhum pedido fecha até voltar a ligar.")) return;
    setAMudar(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/interruptor-do-seguimento", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ligar }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível mudar.");
        return;
      }
      setEstado(d as Estado);
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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DO_SEGUIMENTO}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Na Mesa, «Falei com o cliente» marca quando voltar a contactar. Nessa hora, a Vitória escreve ao cliente, e nos dois
        dias seguintes à mesma hora (das 9h às 20h, nunca duas mensagens automáticas no mesmo dia); sem resposta, o pedido é
        arquivado ao 4.º dia e os parceiros com proposta são avisados. Uma resposta dele pára o seguimento. Só entram os
        pedidos que a equipa marca: este interruptor é para emergências.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-emerald-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado — nada sai e nada fecha; a Mesa mostra «enviaria a …»"}
        {quando && <span className="ml-2 text-xs font-normal text-slate-400">({quando}{estado?.porQuem ? `, ${estado.porQuem}` : ""})</span>}
      </p>
      {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
      {estado != null && (
        <button
          type="button"
          onClick={() => mudar(!ligado)}
          disabled={aMudar}
          className={
            ligado
              ? "mt-3 rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-50"
              : "mt-3 rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50"
          }
        >
          {ligado ? "Desligar (emergência)" : "Voltar a ligar"}
        </button>
      )}
    </div>
  );
}
