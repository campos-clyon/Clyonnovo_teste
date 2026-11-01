"use client";

import { useEffect, useState } from "react";
import { MINIMO_DA_PALAVRA_PASSE } from "@/lib/palavra-passe-do-cliente";

/**
 * «Definir/alterar palavra-passe» na Segurança da conta (01-11-2026).
 *
 * Quem entra com o Google ou com o link define uma aqui (a sessão já prova o
 * email); quem já tem uma troca-a, com a actual. Depois entra também com o
 * email e a palavra-passe, no site e na app.
 */
const campo =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10";

export default function PalavraPasseDaConta() {
  const [tem, setTem] = useState<boolean | null>(null);
  const [aberto, setAberto] = useState(false);
  const [actual, setActual] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/conta/palavra-passe", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({})))
      .then((d: { ok?: boolean; temPalavraPasse?: boolean }) => {
        if (vivo && d.ok) setTem(!!d.temPalavraPasse);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const gravar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (aGravar) return;
    setErro("");
    if (nova.length < MINIMO_DA_PALAVRA_PASSE) {
      setErro(`A palavra-passe tem de ter pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`);
      return;
    }
    if (nova !== repetida) {
      setErro("As duas palavras-passe não são iguais.");
      return;
    }
    setAGravar(true);
    try {
      const res = await fetch("/api/conta/palavra-passe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tem ? { actual, nova } : { nova }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && d.ok) {
        setTem(true);
        setFeito(true);
        setAberto(false);
        setActual("");
        setNova("");
        setRepetida("");
      } else {
        setErro(d.error || "Não foi possível gravar. Tente outra vez.");
      }
    } catch {
      setErro("Sem ligação. Verifique a internet e tente outra vez.");
    }
    setAGravar(false);
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Palavra-passe</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        {tem === null
          ? "A ver…"
          : tem
            ? "Entra com o seu email e a palavra-passe, aqui e na app CLYON."
            : "Ainda não tem palavra-passe. Defina uma para entrar também com o email, aqui e na app CLYON."}
      </p>
      {feito && !aberto && (
        <p role="status" className="mt-3 text-sm font-medium text-emerald-700">
          Palavra-passe gravada.
        </p>
      )}

      {tem !== null && !aberto && (
        <button
          type="button"
          onClick={() => {
            setAberto(true);
            setFeito(false);
            setErro("");
          }}
          className="mt-4 inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        >
          {tem ? "Alterar a palavra-passe" : "Definir uma palavra-passe"}
        </button>
      )}

      {aberto && (
        <form onSubmit={gravar} className="mt-4 max-w-sm space-y-2">
          {tem && (
            <input
              type="password"
              autoComplete="current-password"
              required
              placeholder="Palavra-passe actual"
              aria-label="Palavra-passe actual"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              className={campo}
            />
          )}
          <input
            type="password"
            autoComplete="new-password"
            required
            placeholder={`Nova (mínimo ${MINIMO_DA_PALAVRA_PASSE} caracteres)`}
            aria-label="Palavra-passe nova"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            className={campo}
          />
          <input
            type="password"
            autoComplete="new-password"
            required
            placeholder="Repita a nova"
            aria-label="Repita a palavra-passe nova"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            className={campo}
          />
          {erro && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erro}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={aGravar}
              className="h-11 rounded-xl bg-[#00B4CC] px-5 text-sm font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
            >
              {aGravar ? "A gravar…" : "Gravar"}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="h-11 rounded-xl px-4 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
