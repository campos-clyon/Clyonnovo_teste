"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

export default function EntrarForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [semPalavraPasse, setSemPalavraPasse] = useState(false);

  async function submeter(ev: React.FormEvent) {
    ev.preventDefault();
    setAEnviar(true);
    setErro("");
    setSemPalavraPasse(false);
    try {
      const res = await fetch("/api/profissionais/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, palavraPasse }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível entrar.");
        if (dados.semPalavraPasse) setSemPalavraPasse(true);
        return;
      }
      router.push("/profissionais/painel");
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="w-full">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-600">
            <LogIn className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[#0B1929]">Entrar</h1>
          <p className="mt-2 text-sm text-slate-500">Os seus pedidos e propostas.</p>
        </div>

        <form onSubmit={submeter} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="geral@exemplo.pt"
              className="mt-1.5 w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600"
            />
          </div>

          <div>
            <label htmlFor="pp" className="block text-sm font-medium text-slate-900">
              Palavra-passe
            </label>
            <div className="relative mt-1.5">
              <input
                id="pp"
                type={visivel ? "text" : "password"}
                autoComplete="current-password"
                value={palavraPasse}
                onChange={(e) => setPalavraPasse(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-300 bg-white py-3 pl-4 pr-12 text-base text-slate-900 outline-none transition focus:border-cyan-600"
              />
              <button
                type="button"
                onClick={() => setVisivel((v) => !v)}
                aria-label={visivel ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                aria-pressed={visivel}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                {visivel ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
              {semPalavraPasse && (
                <p className="mt-2 text-xs text-red-600">
                  O email de aprovação tem o link para a criar. Se já não o tiver, fale
                  connosco pelos{" "}
                  <Link href="/contactos" className="font-semibold underline">
                    contactos
                  </Link>
                  .
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={aEnviar || !email || !palavraPasse}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 text-base font-bold text-white transition hover:bg-cyan-400 disabled:opacity-40"
          >
            {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Ainda não se candidatou?{" "}
          {/* Apontava para /profissionais, que está atrás da chave do MVP e
              responde 404 a quem vem de fora — o link estava partido para
              exactamente quem dele precisava. A candidatura é aberta. */}
          <Link
            href="/profissionais/inscricao"
            className="font-semibold text-cyan-600 hover:underline"
          >
            Candidate-se aqui
          </Link>
        </p>
        {/*
          A LINHA QUE FALTAVA, e porque é que está FORA do bloco de erro.

          Um candidato aprovado ainda não tem palavra-passe — tenta entrar,
          leva um 401 genérico, e conclui que se enganou no email. Explicar-lho
          na resposta da API era transformar o login numa forma de descobrir,
          email a email, quem está na plataforma. Escrita aqui, é fixa: diz o
          mesmo a toda a gente, e por isso não distingue ninguém.
        */}
        <p className="mx-auto mt-3 max-w-sm text-center text-xs leading-relaxed text-slate-500">
          Já se candidatou e ainda não teve resposta? Enquanto a candidatura estiver
          por analisar ainda não há palavra-passe para usar aqui. Quando for aprovada,
          enviamos-lhe o link para a criar.
        </p>
      </div>
    </main>
  );
}
