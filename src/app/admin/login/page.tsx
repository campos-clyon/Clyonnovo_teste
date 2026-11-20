"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { paginaInicialDoPapel, type PapelDoPainel } from "@/lib/papel-do-painel";
import { destinoInterno } from "@/lib/destino-seguro";

export default function AdminLoginPage() {
  const router = useRouter();
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [nome, setNome] = useState("");
  /** Página a que ia dar quando o middleware o mandou entrar primeiro. */
  const [proximo, setProximo] = useState("/admin");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPasswordChanged(params.get("passwordChanged") === "1");
    // Só caminhos internos — um "proximo" com http:// levava daqui para fora,
    // e «/\outro.com» também: o browser lê a barra invertida como barra.
    setProximo(destinoInterno(params.get("proximo"), window.location.origin, "/admin"));
  }, []);
  const [palavra, setPalavra] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * O CÓDIGO PARA ENTRAR — d75, 20-11-2026. Um só campo. A entrada por
   * utilizador fica atrás de uma ligação discreta, e só enquanto houver contas
   * activas sem código: o servidor diz quando (GET /api/colaboradores/codigo).
   * Quando todas tiverem, a ligação desaparece sozinha.
   */
  const [codigo, setCodigo] = useState("");
  const [porUtilizador, setPorUtilizador] = useState(false);
  const [ligacaoVisivel, setLigacaoVisivel] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/colaboradores/codigo", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelado) setLigacaoVisivel(d?.porUtilizador === true);
      })
      // Sem resposta, mostra-se: é melhor do que trancar alguém fora.
      .catch(() => {
        if (!cancelado) setLigacaoVisivel(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = porUtilizador
        ? await fetch("/api/colaboradores/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, senha: palavra }),
          })
        : await fetch("/api/colaboradores/codigo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo }),
          });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.error || (porUtilizador ? "Credenciais inválidas." : "Código inválido."));
        return;
      }
      setCodigo("");
      // Dois papéis entram: o administrador, que cai onde ia, e o assistente,
      // que tem um painel só dele. Quem não for nem um nem outro não tem para
      // onde ir, e é melhor dizê-lo aqui do que deixar entrar e falhar em cada
      // ecrã lá dentro. O servidor já recusou; isto é a rede de segurança.
      const isAdmin = data.colaborador.isAdmin === 1 || data.colaborador.isAdmin === true;
      const papel: PapelDoPainel | null = isAdmin
        ? "admin"
        : data.colaborador.papel === "assistente"
          ? "assistente"
          : null;
      if (!papel) {
        setError("Esta conta não tem acesso ao backoffice.");
        return;
      }
      localStorage.setItem("colaborador_token", data.token);
      localStorage.setItem("colaborador_nome", data.colaborador.nome);
      localStorage.setItem("colaborador_id", String(data.colaborador.id));
      localStorage.setItem("colaborador_isAdmin", isAdmin ? "1" : "0");
      localStorage.setItem("colaborador_papel", papel);
      localStorage.removeItem("colaborador_funcao");
      // O assistente vai sempre para o painel dele — um "proximo" apontado ao
      // painel do administrador só o faria dar a volta pelo middleware.
      const destino = papel === "assistente" ? paginaInicialDoPapel("assistente") : proximo;
      router.push(destino);
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

          {passwordChanged && porUtilizador && (
            <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              Palavra-passe atualizada. Entre novamente com a nova palavra-passe.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!porUtilizador ? (
              <div>
                <label
                  htmlFor="codigo"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
                >
                  Código para entrar
                </label>
                <div className="relative">
                  <input
                    id="codigo"
                    type={visivel ? "text" : "password"}
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                    autoFocus
                    autoComplete="current-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-4 pr-12 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setVisivel((v) => !v)}
                    aria-label={visivel ? "Ocultar código" : "Mostrar código"}
                    aria-pressed={visivel}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                  >
                    {visivel ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                  <label
                    htmlFor="palavra"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
                  >
                    Palavra-passe
                  </label>
                  <div className="relative">
                    <input
                      id="palavra"
                      type={visivel ? "text" : "password"}
                      value={palavra}
                      onChange={(e) => setPalavra(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-4 pr-12 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setVisivel((v) => !v)}
                      aria-label={visivel ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                      aria-pressed={visivel}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                    >
                      {visivel ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

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

          {(ligacaoVisivel || porUtilizador) && (
            <button
              type="button"
              onClick={() => {
                setPorUtilizador((v) => !v);
                setError("");
                setVisivel(false);
              }}
              className="mt-5 w-full text-center text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              {porUtilizador ? "Entrar com código" : "Ainda não tem código? Entrar com utilizador"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
