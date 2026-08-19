"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, FlaskConical, Loader2 } from "lucide-react";

/**
 * A entrada do ambiente de testes.
 *
 * Quem chega aqui já provou que sabe o endereço — sem a chave, este caminho
 * responde 404. Falta provar quem é.
 *
 * Diz claramente que isto não é o site: quem receber o link tem de perceber, à
 * primeira, que o que vai ver não está aberto ao público e que os dados que lá
 * puser são reais.
 */
export default function EntradaDeTeste() {
  const router = useRouter();
  const params = useSearchParams();
  const proximo = params.get("proximo") ?? "/plataforma";

  const [utilizador, setUtilizador] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [aVer, setAVer] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setAEnviar(true);
    setErro("");
    try {
      const res = await fetch("/api/plataforma/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utilizador, palavraPasse }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível entrar.");
        return;
      }
      // replace e não push: o ecrã de entrada não deve ficar no histórico,
      // senão o botão "voltar" traz a pessoa de volta a ele já autenticada.
      router.replace(proximo.startsWith("/") ? proximo : "/plataforma");
      router.refresh();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 ring-1 ring-cyan-200">
          <FlaskConical className="h-7 w-7 text-cyan-700" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-[#0B1929]">CLYON plataforma</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Ambiente de testes, fechado ao público. Corre sobre os dados a sério — o que
          criar aqui é real.
        </p>
      </div>

      <form
        onSubmit={entrar}
        className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm"
      >
        <label htmlFor="utilizador" className="block text-sm font-medium text-slate-700">
          Utilizador
        </label>
        <input
          id="utilizador"
          value={utilizador}
          onChange={(e) => setUtilizador(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          className="mt-1.5 w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-600"
        />

        <label
          htmlFor="palavraPasse"
          className="mt-4 block text-sm font-medium text-slate-700"
        >
          Palavra-passe
        </label>
        <div className="relative mt-1.5">
          <input
            id="palavraPasse"
            type={aVer ? "text" : "password"}
            value={palavraPasse}
            onChange={(e) => setPalavraPasse(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 pr-12 text-base text-slate-900 outline-none transition focus:border-cyan-600"
          />
          <button
            type="button"
            onClick={() => setAVer((v) => !v)}
            aria-label={aVer ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-400"
          >
            {aVer ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        {erro && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={aEnviar || !utilizador || !palavraPasse}
          className="mt-5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white transition active:bg-cyan-700 disabled:opacity-40"
        >
          {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Entrar
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
        Não tem credenciais? Não se cria conta aqui — peça a quem lhe deu o link.
      </p>
    </main>
  );
}
