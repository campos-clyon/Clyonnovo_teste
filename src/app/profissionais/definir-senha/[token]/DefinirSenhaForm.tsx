"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { MINIMO_DA_PALAVRA_PASSE } from "@/lib/profissional-auth";

/**
 * Criar a palavra-passe a partir do link do email.
 *
 * Um campo só, e não dois. Repetir a palavra-passe existe para apanhar erros de
 * digitação num campo mascarado — e havendo o botão de a mostrar, o segundo
 * campo passa a ser só mais uma coisa para preencher.
 */
export default function DefinirSenhaForm({ token }: { token: string }) {
  const router = useRouter();
  const [palavraPasse, setPalavraPasse] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  // O caso mais comum de um 403 aqui é a própria pessoa a reabrir o email
  // DEPOIS de já ter criado a palavra-passe — o token é de uso único. Antes
  // levava "Link inválido." e ficava sem saída; agora leva-a para o login.
  const [jaUsado, setJaUsado] = useState(false);

  const curta = palavraPasse.length > 0 && palavraPasse.length < MINIMO_DA_PALAVRA_PASSE;

  async function submeter(ev: React.FormEvent) {
    ev.preventDefault();
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/profissionais/definir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, palavraPasse }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível guardar.");
        setJaUsado(res.status === 403);
        return;
      }
      // Já está autenticado — a rota devolveu o cookie de sessão.
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
            <KeyRound className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[#0B1929]">Crie a sua palavra-passe</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            É com ela que entra no painel e vê todos os pedidos num sítio só.
          </p>
        </div>

        <form onSubmit={submeter} noValidate className="space-y-4">
          <div>
            <label htmlFor="pp" className="block text-sm font-medium text-slate-900">
              Palavra-passe
            </label>
            <div className="relative mt-1.5">
              <input
                id="pp"
                type={visivel ? "text" : "password"}
                value={palavraPasse}
                onChange={(e) => setPalavraPasse(e.target.value)}
                autoComplete="new-password"
                autoFocus
                placeholder={`Pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres`}
                className={`w-full rounded-xl border-2 bg-white py-3 pl-4 pr-12 text-base text-slate-900 outline-none transition focus:border-cyan-600 ${
                  curta ? "border-amber-400" : "border-gray-300"
                }`}
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
            <p className={`mt-1 text-xs ${curta ? "text-amber-700" : "text-slate-500"}`}>
              Mínimo {MINIMO_DA_PALAVRA_PASSE} caracteres. Uma frase que se lembre é melhor
              do que uma palavra com símbolos.
            </p>
          </div>

          {erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{erro}</p>
              {jaUsado && (
                <a
                  href="/profissionais/entrar"
                  className="mt-2 inline-block font-semibold text-cyan-700 underline underline-offset-4"
                >
                  Já criou a palavra-passe? Entre aqui
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={aEnviar || palavraPasse.length < MINIMO_DA_PALAVRA_PASSE}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 text-base font-bold text-white transition hover:bg-cyan-400 disabled:opacity-40"
          >
            {aEnviar && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Guardar e entrar
          </button>
        </form>
      </div>
    </main>
  );
}
