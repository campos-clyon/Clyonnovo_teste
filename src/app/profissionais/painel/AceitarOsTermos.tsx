"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

/**
 * O ECRÃ DO PRIMEIRO ACESSO DEPOIS DE 15-11-2026 — d20 (CEO e dono, 13-11-2026).
 *
 * Pergunta à rota `/api/profissionais/termos` (a mesma da app CLYON Pro) se este
 * profissional já aceitou a versão em vigor. Se não, mostra o resumo, a ligação
 * aos Termos e a caixa — nunca marcada; o botão só funciona com ela marcada.
 *
 * NÃO BLOQUEIA: «Agora não» fecha o ecrã por esta sessão do navegador, e ele
 * continua a ver e a propor como antes; no acesso seguinte volta a pedir. O
 * bloqueio está por confirmar pelo advogado (`aceitacao-dos-termos.ts`).
 */

type Textos = {
  titulo: string;
  resumo: string;
  ligacao: string;
  url: string;
  caixa: string;
  aceitar: string;
  agoraNao: string;
};
type Estado = { versao: string; precisaDeAceitar: boolean; textos: Textos };

const ADIADO = "clyon_termos_adiados";

export default function AceitarOsTermos() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [marcada, setMarcada] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/profissionais/termos")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Estado | null) => {
        if (!vivo || !d || !d.precisaDeAceitar) return;
        try {
          if (sessionStorage.getItem(ADIADO) === d.versao) return;
        } catch {
          /* Sem armazenamento, mostra-se. */
        }
        setEstado(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!estado) return null;
  const t = estado.textos;

  function adiar() {
    try {
      sessionStorage.setItem(ADIADO, estado!.versao);
    } catch {
      /* Sem armazenamento, volta a aparecer ao recarregar — é o certo. */
    }
    setEstado(null);
  }

  async function aceitar() {
    if (!marcada) return;
    setAGravar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/termos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versao: estado!.versao, aceito: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(d.error ?? "Não foi possível guardar. Tente novamente.");
        return;
      }
      setEstado(null);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="termos-titulo"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5">
        <p id="termos-titulo" className="flex items-center gap-2 text-base font-bold text-slate-900">
          <FileText className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
          {t.titulo}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{t.resumo}</p>
        <a
          href={t.url}
          target="_blank"
          rel="noopener"
          className="mt-3 inline-block text-sm font-semibold text-cyan-700 underline underline-offset-4"
        >
          {t.ligacao}
        </a>
        <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-slate-800">
          <input
            type="checkbox"
            checked={marcada}
            onChange={(e) => setMarcada(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-cyan-700"
          />
          <span>{t.caixa}</span>
        </label>
        {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={aceitar}
            disabled={!marcada || aGravar}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition active:bg-slate-700 disabled:opacity-40"
          >
            {aGravar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t.aceitar}
          </button>
          <button
            type="button"
            onClick={adiar}
            className="min-h-[44px] px-3 text-sm font-medium text-slate-600 underline underline-offset-2"
          >
            {t.agoraNao}
          </button>
        </div>
      </div>
    </div>
  );
}
