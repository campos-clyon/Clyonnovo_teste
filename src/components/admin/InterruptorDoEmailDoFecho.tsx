"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";

/**
 * O INTERRUPTOR DO EMAIL «O TRABALHO JÁ FOI FEITO?» — Configs (d15, 13-11-2026).
 *
 * DESLIGADO POR OMISSÃO. Liga-se só quando o dono o confirmar na conversa com o
 * CEO. Só o administrador o vê e muda; para ligar escreve-se LIGAR. Mesmo
 * ligado, nada sai antes de 15-11-2026. A linha na Mesa, o aviso à equipa e a
 * pergunta na página do pedido não dependem dele.
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

export default function InterruptorDoEmailDoFecho() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [palavra, setPalavra] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/fecho-do-modelo/interruptor", {
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
      const r = await fetch("/api/admin/fecho-do-modelo/interruptor", {
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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Modelo novo: email ao cliente</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        48 h depois da data de um trabalho sem «Está feito», o cliente recebe por email a pergunta «O trabalho já
        foi feito?». A pergunta na página do pedido e a linha na Mesa não dependem deste interruptor.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-red-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "Email LIGADO" : "Email desligado — não sai nenhum email"}
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
              aria-label="Escreva LIGAR para ligar o email"
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
