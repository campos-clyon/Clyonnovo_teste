"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Users, Clock, Check } from "lucide-react";

export default function ColaboradorLoginClient() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/colaboradores/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, senha, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível iniciar sessão.");
      }

      // Se "Manter sessão": localStorage (persiste após fechar browser)
      // Se não: sessionStorage (limpa ao fechar browser)
      const store = rememberMe ? localStorage : sessionStorage;
      // Normalizar isAdmin: MySQL devolve 1/0 (number) ou true/false (boolean) — guardar sempre "1" ou "0"
      const isAdminNorm = data.colaborador.isAdmin === 1 || data.colaborador.isAdmin === true ? "1" : "0";
      store.setItem("colaborador_token", data.token);
      store.setItem("colaborador_nome", data.colaborador.nome);
      store.setItem("colaborador_id", String(data.colaborador.id));
      store.setItem("colaborador_isAdmin", isAdminNorm);
      store.setItem("colaborador_funcao", data.colaborador.funcao ?? "");
      // Limpar o outro storage para evitar conflitos
      if (rememberMe) {
        sessionStorage.removeItem("colaborador_token");
        sessionStorage.removeItem("colaborador_nome");
        sessionStorage.removeItem("colaborador_id");
        sessionStorage.removeItem("colaborador_isAdmin");
        sessionStorage.removeItem("colaborador_funcao");
      } else {
        localStorage.removeItem("colaborador_token");
        localStorage.removeItem("colaborador_nome");
        localStorage.removeItem("colaborador_id");
        localStorage.removeItem("colaborador_isAdmin");
        localStorage.removeItem("colaborador_funcao");
      }
      // Redirecionar baseado na função: admin geral → painel completo, assistente → aba Pedidos, outros → dashboard de horas
      if (data.colaborador.isAdmin === 1) {
        router.push("/colaboradores/admin");
      } else if (data.colaborador.funcao === "assistente") {
        router.push("/colaboradores/admin?section=pedidos");
      } else {
        router.push("/colaboradores/dashboard");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Não foi possível iniciar sessão.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
        {/* Painel de marca / valor — mesma altura do cartão de login */}
        <div className="relative hidden overflow-hidden rounded-[26px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-7 sm:p-8 lg:flex lg:flex-col lg:justify-between">
          {/* brilho de acento */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-16 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl"
          />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
              <ShieldCheck className="h-3 w-3" />
              Portal interno
            </div>
            <h1 className="mt-5 max-w-[12ch] text-balance text-[2.1rem] font-bold leading-[1.05] tracking-tight text-white">
              Entrada segura para a equipa CLYON.
            </h1>
            <p className="mt-3.5 max-w-md text-pretty text-[13px] leading-relaxed text-slate-400">
              Aceda ao painel de colaborador para registos, consulta e gestão interna.
              Esta área não é indexada e é reservada à operação da equipa.
            </p>
          </div>

          <ul className="relative mt-7 space-y-2.5">
            <li className="flex items-center gap-2.5 text-[13px] text-slate-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800/80 text-cyan-300">
                <Users className="h-3.5 w-3.5" />
              </span>
              Gestão de equipa e funções operacionais
            </li>
            <li className="flex items-center gap-2.5 text-[13px] text-slate-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800/80 text-cyan-300">
                <Clock className="h-3.5 w-3.5" />
              </span>
              Registo de horários e turnos em tempo real
            </li>
            <li className="flex items-center gap-2.5 text-[13px] text-slate-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800/80 text-cyan-300">
                <LockKeyhole className="h-3.5 w-3.5" />
              </span>
              Acesso protegido e credenciais encriptadas
            </li>
          </ul>
        </div>

        {/* Cartão de login */}
        <div className="mx-auto w-full max-w-sm">
          {/* badge interno só para mobile */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300 lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5" />
            Portal interno
          </div>

          <div className="rounded-[26px] border border-slate-800 bg-slate-900/60 p-7 shadow-[0_40px_120px_-40px_rgba(8,145,178,0.45)] backdrop-blur sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <LockKeyhole className="h-5 w-5" />
            </div>

            <h2 className="mt-5 text-2xl font-bold text-white">Portal do colaborador</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Entre com as suas credenciais para aceder ao sistema interno.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="nome" className="mb-1.5 block text-xs font-semibold text-slate-200">
                  Nome
                </label>
                <input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder="Digite o seu nome"
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="senha" className="mb-1.5 block text-xs font-semibold text-slate-200">
                  Palavra-passe
                </label>
                <div className="relative">
                  <input
                    id="senha"
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="Digite a sua palavra-passe"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((value) => !value)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-cyan-300"
                    aria-label={mostrarSenha ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Manter sessão */}
              <button
                type="button"
                onClick={() => setRememberMe((v) => !v)}
                className="flex w-full items-center gap-2.5 text-left"
                aria-pressed={rememberMe}
              >
                <span
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                    rememberMe
                      ? "border-cyan-400 bg-cyan-500"
                      : "border-slate-600 bg-slate-800"
                  }`}
                >
                  {rememberMe && <Check className="h-2.5 w-2.5 text-slate-950" strokeWidth={3} />}
                </span>
                <span className="text-xs text-slate-300">
                  Manter sessão activa{" "}
                  <span className="text-slate-500">(30 dias)</span>
                </span>
              </button>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-300"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 shadow-[0_14px_32px_-14px_rgba(6,182,212,0.8)] transition hover:-translate-y-0.5 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "A entrar..." : "Entrar"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </button>
            </form>

            <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
              <LockKeyhole className="h-3 w-3" />
              Ligação segura e encriptada
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
