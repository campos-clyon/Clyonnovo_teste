"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Users, Clock, Check, AlertTriangle } from "lucide-react";

export default function ColaboradorLoginClient() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Detectar Caps Lock em qualquer input — melhora UX e evita falhas de login.
  const handleKeyEvent = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.getModifierState) {
      setCapsLockOn(event.getModifierState("CapsLock"));
    }
  };

  // Limpar a senha do estado quando o componente desmonta.
  // Reduz a superfície para dumps de memória / extensões maliciosas.
  useEffect(() => {
    return () => { setSenha(""); };
  }, []);

  // Restaurar preferência do "Manter sessão" — se o utilizador desmarcou antes,
  // essa escolha persiste entre visitas ao próprio ecrã de login.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("clyon_remember_pref");
      if (saved === "0") setRememberMe(false);
      else if (saved === "1") setRememberMe(true);
    } catch { /* silencioso */ }
  }, []);

  const setRememberPersisted = (value: boolean) => {
    setRememberMe(value);
    try { localStorage.setItem("clyon_remember_pref", value ? "1" : "0"); } catch { /* silencioso */ }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
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
      const other = rememberMe ? sessionStorage : localStorage;
      const isAdminNorm = data.colaborador.isAdmin === 1 || data.colaborador.isAdmin === true ? "1" : "0";
      const keys = ["colaborador_token", "colaborador_nome", "colaborador_id", "colaborador_isAdmin", "colaborador_funcao"];
      const values: Record<string, string> = {
        colaborador_token:   data.token,
        colaborador_nome:    data.colaborador.nome,
        colaborador_id:      String(data.colaborador.id),
        colaborador_isAdmin: isAdminNorm,
        colaborador_funcao:  data.colaborador.funcao ?? "",
      };
      for (const k of keys) {
        store.setItem(k, values[k]);
        other.removeItem(k);
      }

      // Limpar imediatamente a senha do estado — reduz janela em memória
      setSenha("");

      // Redirect por função
      if (data.colaborador.isAdmin === 1) {
        router.push("/admin");
      } else if (data.colaborador.funcao === "assistente") {
        router.push("/admin?section=pedidos");
      } else {
        router.push("/colaboradores/dashboard");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível iniciar sessão.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050810] text-slate-100">
      {/* ── Fundo 3D animado ── */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        {/* Grade em perspectiva a deslizar continuamente — sensação de movimento */}
        <div
          className="clyon-grid absolute inset-0 opacity-[0.11]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.6) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            transform: "perspective(900px) rotateX(60deg) translateY(140px) scale(1.6)",
            transformOrigin: "50% 100%",
            maskImage: "linear-gradient(180deg, transparent 0%, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 55%, transparent 100%)",
            animation: "clyonGrid 8s linear infinite",
          }}
        />
        {/* Halo central superior — respira lentamente */}
        <div
          className="clyon-halo-a absolute -top-32 left-1/2 h-96 w-[560px] rounded-full bg-cyan-500/20 blur-[110px]"
          style={{ animation: "clyonHaloA 12s ease-in-out infinite" }}
        />
        {/* Halo diagonal inferior direito — deriva em orbita */}
        <div
          className="clyon-halo-b absolute bottom-[-8rem] right-[-6rem] h-[420px] w-[420px] rounded-full bg-cyan-400/15 blur-[110px]"
          style={{ animation: "clyonHaloB 18s ease-in-out infinite" }}
        />
        {/* Halo indigo topo esquerdo */}
        <div
          className="clyon-halo-c absolute -top-24 -left-24 h-[380px] w-[380px] rounded-full bg-indigo-500/10 blur-[110px]"
          style={{ animation: "clyonHaloC 15s ease-in-out infinite" }}
        />
        {/* Feixe de luz que atravessa o ecrã de tempos a tempos — alusão a velocidade / entrega */}
        <div
          className="clyon-beam absolute top-1/3 h-[200%] w-[220px] -translate-y-1/2 opacity-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.18) 45%, rgba(56,189,248,0.28) 50%, rgba(34,211,238,0.18) 55%, transparent 100%)",
            filter: "blur(24px)",
            animation: "clyonBeam 10s ease-in-out infinite",
            animationDelay: "3s",
          }}
        />
        {/* Ruído subtil para evitar banding */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/></svg>\")",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8">
        {/* ── Painel de marca — card com profundidade 3D ── */}
        <div
          className="relative hidden overflow-hidden rounded-[28px] border border-white/[0.06] p-8 shadow-[0_40px_120px_-40px_rgba(6,182,212,0.35),inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-10 lg:flex lg:flex-col lg:justify-between"
          style={{
            background:
              "linear-gradient(140deg, rgba(15,23,42,0.85) 0%, rgba(2,6,23,0.9) 55%, rgba(8,47,73,0.75) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Reflexo diagonal no topo — dá sensação de vidro */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)",
            }}
          />
          {/* Halo interno */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-500/25 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-300 backdrop-blur">
              <ShieldCheck className="h-3 w-3" />
              Portal interno
            </div>
            <h1 className="mt-6 text-balance text-[2.4rem] font-bold leading-[1.05] tracking-tight text-white">
              Entrada segura para a<br />
              <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">
                equipa CLYON.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-pretty text-[13px] leading-relaxed text-slate-400">
              Aceda ao painel de colaborador para registos, consulta e gestão interna.
              Esta área não é indexada e é reservada à operação da equipa.
            </p>
          </div>

          <ul className="relative mt-8 space-y-3">
            {[
              { icon: Users,       label: "Gestão de equipa e funções operacionais" },
              { icon: Clock,       label: "Registo de horários e turnos em tempo real" },
              { icon: LockKeyhole, label: "Acesso protegido e credenciais encriptadas" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[13px] text-slate-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300 shadow-inner shadow-cyan-500/10">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Cartão de login ── */}
        <div className="mx-auto w-full max-w-sm">
          {/* Badge mobile */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300 lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5" />
            Portal interno
          </div>

          <div
            className="relative rounded-[28px] border border-white/[0.08] p-7 shadow-[0_50px_120px_-40px_rgba(6,182,212,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-8"
            style={{
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(2,6,23,0.92) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            {/* Reflexo no topo do cartão */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[28px] opacity-70"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)" }}
            />

            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 shadow-lg shadow-cyan-500/30">
              <LockKeyhole className="h-5 w-5" />
            </div>

            <h2 className="relative mt-5 text-2xl font-bold text-white">Portal do colaborador</h2>
            <p className="relative mt-1.5 text-sm leading-relaxed text-slate-400">
              Introduza as credenciais para entrar.
            </p>

            <form
              className="relative mt-6 space-y-4"
              onSubmit={handleSubmit}
              autoComplete="on"
              spellCheck={false}
            >
              <div>
                <label htmlFor="nome" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  Nome
                </label>
                <input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  onKeyUp={handleKeyEvent}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:bg-black/60 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder="Digite o seu nome"
                  autoComplete="username"
                  required
                  autoCapitalize="characters"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="senha" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                    Palavra-passe
                  </label>
                  {capsLockOn && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> Caps Lock ligado
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="senha"
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    onKeyUp={handleKeyEvent}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:bg-black/60 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="Digite a sua palavra-passe"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((value) => !value)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-cyan-300"
                    aria-label={mostrarSenha ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                    tabIndex={-1}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Manter sessão — checkbox nativo escondido + label estilizado (acessível) */}
              <label className="group flex cursor-pointer items-center gap-2.5 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberPersisted(e.target.checked)}
                  className="sr-only peer"
                />
                <span
                  className={`flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded border transition ${
                    rememberMe
                      ? "border-cyan-400 bg-gradient-to-br from-cyan-400 to-sky-500 shadow-sm shadow-cyan-500/40"
                      : "border-slate-600 bg-slate-800/60 group-hover:border-slate-500"
                  }`}
                  style={{ height: "1.05rem", width: "1.05rem" }}
                >
                  {rememberMe && <Check className="h-2.5 w-2.5 text-slate-950" strokeWidth={3} />}
                </span>
                <span className="text-xs text-slate-300">
                  Manter sessão activa <span className="text-slate-500">(30 dias)</span>
                </span>
              </label>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-300"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !nome || !senha}
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-5 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_-14px_rgba(6,182,212,0.9)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-14px_rgba(6,182,212,0.95)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    A entrar...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

          </div>
        </div>
      </div>

      {/* ── Keyframes globais para animações do fundo ── */}
      <style jsx global>{`
        @keyframes clyonGrid {
          0%   { background-position: 0 0; }
          100% { background-position: 0 60px; }
        }
        @keyframes clyonHaloA {
          0%, 100% { transform: translate(-50%, 0) scale(1); }
          50%      { transform: translate(-45%, 20px) scale(1.08); }
        }
        @keyframes clyonHaloB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(-30px, -20px) scale(1.05); }
          66%      { transform: translate(20px, 25px) scale(0.95); }
        }
        @keyframes clyonHaloC {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(35px, 20px) scale(1.1); }
        }
        @keyframes clyonBeam {
          0%   { transform: translateX(-30%) rotate(-15deg); opacity: 0; }
          15%  { opacity: 0.55; }
          85%  { opacity: 0.55; }
          100% { transform: translateX(130%) rotate(-15deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .clyon-grid,
          .clyon-halo-a,
          .clyon-halo-b,
          .clyon-halo-c,
          .clyon-beam {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
