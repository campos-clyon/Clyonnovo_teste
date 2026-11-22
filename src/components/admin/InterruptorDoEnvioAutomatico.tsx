"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO } from "@/lib/envio-automatico-nome";

/**
 * O INTERRUPTOR DE EMERGÊNCIA «ENVIO AUTOMÁTICO AOS PARCEIROS» — Configs (d87, 22-11-2026).
 *
 * LIGADO POR OMISSÃO: os pedidos que a Vitória deixa completos seguem sozinhos
 * para os parceiros (das 8h às 21h; fora disso, às 8h00). Desligar deixa tudo
 * nos «por enviar» como antes, e os cartões mostram «enviaria a …». Só o
 * administrador o vê e muda.
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

export default function InterruptorDoEnvioAutomatico() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/interruptor-do-envio-automatico", {
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
    if (!ligar && !window.confirm("Desligar o envio automático aos parceiros? Os pedidos completos pela Vitória ficam nos «por enviar» até voltar a ligar.")) return;
    setAMudar(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/interruptor-do-envio-automatico", {
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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Quando a Vitória deixa um pedido completo pelo WhatsApp (a resposta ao «Pedir o que falta», ou um pedido que ela
        registou já com tudo), ele segue sozinho para os parceiros da zona, pelo mesmo envio da Mesa: serviço da lista,
        morada com coordenadas e código postal, nada em falta, sem conta de teste nem número bloqueado, e pelo menos um
        parceiro elegível. Os avisos só saem das 8h às 21h; fora disso, às 8h00. Se uma condição falhar, fica nos «por
        enviar» com o motivo no cartão. Este interruptor é para emergências.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-emerald-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado — fica tudo nos «por enviar»; a Mesa mostra «enviaria a …»"}
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
