"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
/** O mesmo nome de whatsapp-pela-meta.ts (lá há a base; aqui só o texto). */
const NOME_DO_INTERRUPTOR_DA_META = "WhatsApp pela Meta";

/**
 * O INTERRUPTOR «WHATSAPP PELA META» — Configs (d5, 21-11-2026).
 *
 * DESLIGADO POR OMISSÃO: mesmo com as variáveis da Cloud API na Vercel, os envios
 * seguem pela ponte até alguém o ligar. A Cloud API não envia templates. Só o
 * administrador o vê e muda; para ligar escreve-se LIGAR.
 */
type Estado = { ligado: boolean; mudadoEm: string | null; porQuem: string | null; variaveisNaVercel?: boolean };

export default function InterruptorDoWhatsAppPelaMeta() {
  const { token, ready } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [aMudar, setAMudar] = useState(false);

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/interruptor-do-whatsapp-pela-meta", {
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
    let confirmacao = "";
    if (ligar) {
      confirmacao = window.prompt("Ligar o WhatsApp pela Meta? Os envios passam da ponte para a Cloud API, que não envia templates (lembretes fora das 24 h). Escreva LIGAR para confirmar.") ?? "";
      if (confirmacao.trim().toUpperCase() !== "LIGAR") return;
    }
    setAMudar(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/interruptor-do-whatsapp-pela-meta", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ligar, confirmacao }),
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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{NOME_DO_INTERRUPTOR_DA_META}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Mesmo com as variáveis da API da Meta na Vercel, as mensagens só passam para a Cloud API com isto ligado; desligado,
        seguem pela ponte, como hoje. A Cloud API não envia templates: não ligar antes de estarem aprovados. Um erro da Meta
        fica marcado no registo.
        {estado?.variaveisNaVercel === false ? " (As variáveis ainda não estão na Vercel.)" : ""}
      </p>
      <p className={`mt-2 text-sm font-semibold ${ligado ? "text-emerald-300" : "text-amber-200"}`}>
        {estado == null ? "A ler…" : ligado ? "LIGADO — os envios vão pela Cloud API da Meta" : "Desligado — os envios seguem pela ponte"}
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
          {ligado ? "Desligar (voltar à ponte)" : "Ligar"}
        </button>
      )}
    </div>
  );
}
