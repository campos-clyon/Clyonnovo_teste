"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth, useEAdministrador } from "@/hooks/useAdminAuth";
import { metodosDePagamentoMudaram } from "@/hooks/useMetodosDePagamento";
import { MAXIMO_DOS_METODOS_DE_PAGAMENTO, SEM_METODOS_DE_PAGAMENTO } from "@/lib/metodos-de-pagamento";

/**
 * CONFIGS → «MÉTODOS DE PAGAMENTO PARA A ADJUDICAÇÃO» — 27-10-2026.
 *
 * O texto que vai na mensagem de adjudicação ao cliente
 * (`mensagem-de-adjudicacao.ts`). Escreve-o o administrador; um assistente
 * com as Configs só o vê. Vazio, a mensagem diz que os dados seguem a seguir,
 * e este cartão avisa.
 */
export default function AdminMetodosDePagamentoPanel() {
  const { token } = useAdminAuth();
  const eAdministrador = useEAdministrador();
  const [guardado, setGuardado] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [lido, setLido] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/admin/metodos-de-pagamento", { headers: { Authorization: `Bearer ${token}` } });
        const j = (await r.json().catch(() => ({}))) as { metodos?: string | null; error?: string };
        if (!vivo) return;
        if (!r.ok) {
          setAviso(j.error ?? "Não foi possível ler os métodos de pagamento.");
          return;
        }
        const m = typeof j.metodos === "string" ? j.metodos : null;
        setGuardado(m);
        setTexto(m ?? "");
        setLido(true);
      } catch {
        if (vivo) setAviso("Não foi possível ler os métodos de pagamento.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  const guardar = async () => {
    if (!token) return;
    setAGuardar(true);
    setAviso(null);
    try {
      const r = await fetch("/api/admin/metodos-de-pagamento", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ metodos: texto }),
      });
      const j = (await r.json().catch(() => ({}))) as { metodos?: string | null; error?: string };
      if (!r.ok) {
        setAviso(j.error ?? "Não foi possível guardar.");
        return;
      }
      const m = typeof j.metodos === "string" ? j.metodos : null;
      setGuardado(m);
      setTexto(m ?? "");
      metodosDePagamentoMudaram(m);
      setAviso("Guardado.");
    } catch {
      setAviso("Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  };

  const mudou = (guardado ?? "") !== texto.trim();

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Métodos de pagamento para a adjudicação
      </p>
      <p className="mt-1 mb-3 text-sm leading-6 text-slate-300">
        O texto que vai na mensagem de adjudicação ao cliente, depois de «Para o pagamento, pode usar
        uma destas opções:». Uma opção por parágrafo, sem emojis.
      </p>
      {lido && !guardado && (
        <p className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Ainda não há métodos de pagamento. Até serem preenchidos, a adjudicação diz ao cliente: «
          {SEM_METODOS_DE_PAGAMENTO}»
        </p>
      )}
      {eAdministrador ? (
        <>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAXIMO_DOS_METODOS_DE_PAGAMENTO}
            rows={8}
            disabled={!lido}
            aria-label="Métodos de pagamento para a adjudicação"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
          />
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
        </>
      ) : (
        <>
          {guardado && (
            <pre className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-sans text-sm text-slate-200">
              {guardado}
            </pre>
          )}
          <p className="mt-2 text-xs text-slate-400">Só o administrador muda este texto.</p>
          {aviso && <p className="mt-1 text-xs text-slate-300">{aviso}</p>}
        </>
      )}
    </div>
  );
}
