"use client";

import { useState } from "react";
import { DIAS_A_LEMBRAR, LEMBRAR_POR_OMISSAO } from "@/lib/manter-sessao";
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
  /*
   * MARCADA POR OMISSAO — e uma decisao, nao um descuido.
   *
   * E o que ele quer em quase todos os casos: entra do telemovel dele, para
   * ver os trabalhos dele. A caixa existe para quem precisa do contrario
   * poder dize-lo. Ver `LEMBRAR_POR_OMISSAO` em manter-sessao.
   */
  const [lembrar, setLembrar] = useState(LEMBRAR_POR_OMISSAO);

  async function submeter(ev: React.FormEvent) {
    ev.preventDefault();
    setAEnviar(true);
    setErro("");
    setSemPalavraPasse(false);
    try {
      const res = await fetch("/api/profissionais/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, palavraPasse, lembrar }),
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

          {/*
            MANTER-ME LIGADO — 15-09-2026.

            "Crie a opcao manter-me conectado, e garanta que funcione para eles
            nao terem de entrar com senha varias vezes ao dia."

            A frase por baixo diz o prazo em vez de prometer "para sempre": um
            numero e uma promessa que se pode cumprir, e e o que distingue
            esta caixa de um enfeite.
          */}
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm text-slate-700">
              Manter-me ligado
              <span className="mt-0.5 block text-xs text-slate-500">
                {lembrar
                  ? `Nao pede a palavra-passe outra vez durante ${DIAS_A_LEMBRAR} dias — e enquanto for usando, nunca pede.`
                  : "Termina quando fechar o browser. Escolha isto num computador que nao e seu."}
              </span>
            </span>
          </label>

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
          Ainda não se inscreveu?{" "}
          <Link href="/profissionais" className="font-semibold text-cyan-600 hover:underline">
            Inscreva-se aqui
          </Link>
        </p>
      </div>
    </main>
  );
}
