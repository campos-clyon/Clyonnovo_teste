"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AdminLoginPage() {
  const router = useRouter();
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [nome, setNome] = useState("");

  useEffect(() => {
    setPasswordChanged(new URLSearchParams(window.location.search).get("passwordChanged") === "1");
  }, []);
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/colaboradores/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, senha }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.error || "Credenciais inválidas.");
        return;
      }
      // Qualquer colaborador pode aceder ao painel (admin ou assistente)
      // A distinção de permissões é feita dentro do painel e nas APIs
      // Guardar credenciais no formato colaborador-storage
      const isAdminNorm = data.colaborador.isAdmin === 1 || data.colaborador.isAdmin === true ? "1" : "0";
      localStorage.setItem("colaborador_token", data.token);
      localStorage.setItem("colaborador_nome", data.colaborador.nome);
      localStorage.setItem("colaborador_id", String(data.colaborador.id));
      localStorage.setItem("colaborador_isAdmin", isAdminNorm);
      localStorage.setItem("colaborador_funcao", data.colaborador.funcao ?? "");
      router.push("/admin");
    } catch {
      setError("Erro de ligação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080F1A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">CLYON</p>
              <p className="text-xs text-slate-500">Painel Administrativo</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(15,25,42,0.98)_0%,rgba(9,18,32,0.98)_100%)] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <h1 className="text-xl font-bold text-white mb-1">Entrar no painel</h1>
          <p className="text-sm text-slate-400 mb-7">Acesso exclusivo para equipa CLYON.</p>

          {passwordChanged && (
            <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              Palavra-passe atualizada. Entre novamente com a nova palavra-passe.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Nome de utilizador
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="username"
                placeholder="O seu nome"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Palavra-passe
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 py-3 text-sm font-bold text-slate-950 transition disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  A entrar...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
