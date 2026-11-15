"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";

/**
 * O INTERRUPTOR «VITÓRIA: MENSAGEM GENTIL A QUEM FICA CALADO» — Configs (d25 v2,
 * 14-11-2026).
 *
 * DESLIGADO POR OMISSÃO. Ligado, quem fica calado mais de 10 minutos a meio de
 * um pedido pelo WhatsApp recebe UMA mensagem gentil com a mesma pergunta por
 * outras palavras (1 por pergunta, 2 por conversa, nunca das 21h às 9h de
 * Lisboa, nunca numa conversa entregue a uma pessoa nem com o pedido já
 * registado). Só o administrador o vê e muda; para ligar escreve-se LIGAR. O
 * nome é o mesmo de `NOME_DO_INTERRUPTOR_DO_SEGUIMENTO` (o teste confere).
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

const NOME = "Vitória: mensagem gentil a quem fica calado";
const ROTA = "/api/admin/vitoria-seguimento/interruptor";

export default function InterruptorDoSeguimentoDaVitoria() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [palavra, setPalavra] = useState("");
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(ROTA, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
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
      const r = await fetch(ROTA, {
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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Quem fica calado mais de 10 minutos a meio de um pedido pelo WhatsApp recebe uma mensagem gentil, com a mesma
        pergunta por outras palavras. No máximo uma por pergunta e duas por conversa; nunca das 21h às 9h (hora de
        Lisboa), nem numa conversa entregue a uma pessoa, nem com o pedido já registado. Desligado, fica como antes: aos
        10 minutos a Vitória passa à pergunta seguinte.
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-red-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO" : "Desligado — a Vitória não manda a mensagem gentil"}
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
              aria-label="Escreva LIGAR para ligar a mensagem gentil a quem fica calado"
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
