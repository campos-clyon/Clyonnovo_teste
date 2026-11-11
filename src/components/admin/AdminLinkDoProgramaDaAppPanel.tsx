"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { linkDeAdesaoValido } from "@/lib/convite-app-cliente";

/**
 * CONFIGS → «LINK DO PROGRAMA DA APP» — 11-11-2026.
 *
 * O link de adesão ao teste fechado da app de cliente na Google Play (Play
 * Console → Testes → Teste fechado → Testadores → «Copiar link»). Vai no email
 * do convite do programa de acesso antecipado (Contas → «Programa da app»).
 * É o mesmo valor que o convite de 01-11 já usava. Só o administrador o vê e
 * muda; sem ele, o convite não sai.
 */
export default function AdminLinkDoProgramaDaAppPanel() {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [guardado, setGuardado] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [lido, setLido] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !eAdministrador) return;
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/admin/programa-da-app/link", { headers: { Authorization: `Bearer ${token}` } });
        const j = (await r.json().catch(() => ({}))) as { link?: string | null; error?: string };
        if (!vivo) return;
        if (!r.ok) {
          setAviso(j.error ?? "Não foi possível ler o link.");
          return;
        }
        setGuardado(j.link ?? null);
        setLink(j.link ?? "");
        setLido(true);
      } catch {
        if (vivo) setAviso("Não foi possível ler o link.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token, eAdministrador]);

  const guardar = async () => {
    if (!token) return;
    setAGuardar(true);
    setAviso(null);
    try {
      const r = await fetch("/api/admin/programa-da-app/link", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ link }),
      });
      const j = (await r.json().catch(() => ({}))) as { link?: string; error?: string };
      if (!r.ok) {
        setAviso(j.error ?? "Não foi possível guardar.");
        return;
      }
      setGuardado(j.link ?? null);
      setLink(j.link ?? "");
      setAviso("Guardado.");
    } catch {
      setAviso("Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  };

  if (!eAdministrador) return null;

  const limpo = linkDeAdesaoValido(link);
  const mal = link.trim() !== "" && !limpo;
  const mudou = limpo !== null && limpo !== guardado;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Link do programa da app</p>
      <p className="mt-1 mb-3 text-sm leading-6 text-slate-300">
        O link de adesão ao teste fechado da app de cliente na Google Play (Play Console → Testes → Teste fechado →
        Testadores → «Copiar link»). Vai no email do convite do programa de acesso antecipado (Contas → «Programa da
        app»). Sem link, o convite não sai.
      </p>
      {lido && !guardado && (
        <p className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Ainda não há link guardado.
        </p>
      )}
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        disabled={!lido}
        placeholder="https://play.google.com/apps/testing/…"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
      />
      {mal && <p className="mt-1 text-xs text-rose-300">Tem de ser um link https da Google Play.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={!lido || aGuardar || !mudou}
          className="flex items-center gap-1.5 rounded-lg bg-acao px-3 py-1.5 text-xs font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
        >
          {aGuardar && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Guardar
        </button>
        {aviso && <span className="text-xs text-slate-300">{aviso}</span>}
      </div>
    </div>
  );
}
