"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import {
  MENSAGEM_DO_LINK,
  MINIMO_DA_PALAVRA_PASSE,
  pareceUmTokenDaConta,
} from "@/lib/palavra-passe-do-cliente";

/**
 * Escolher a palavra-passe pelo link do email (01-11-2026): os links
 * «definir» (o email já tinha conta) e «repor» (esqueceu-se).
 *
 * O token sai do endereço logo à entrada e fica só na memória da página.
 * Pergunta-se primeiro se o link ainda serve (sem o gastar), para não pedir
 * uma palavra-passe a quem tem um link morto; e só se gasta quando a nova
 * passa as regras.
 */
export default function ReporPalavraPasse() {
  const params = useSearchParams();
  const jaCorreu = useRef(false);
  const token = useRef<string | null>(null);
  const [estado, setEstado] = useState<"a-ver" | "pronto" | "a-gravar" | "feito" | "erro">("a-ver");
  const [tipo, setTipo] = useState<"definir" | "repor">("repor");
  const [erroDoLink, setErroDoLink] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (jaCorreu.current) return;
    jaCorreu.current = true;
    const t = params.get("token");
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", "/entrar/repor");
    }
    if (!pareceUmTokenDaConta(t)) {
      setErroDoLink(MENSAGEM_DO_LINK.malformado);
      setEstado("erro");
      return;
    }
    token.current = t;
    (async () => {
      try {
        const res = await fetch("/api/entrada/repor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t, verificar: true }),
        });
        const d = (await res.json().catch(() => ({}))) as { ok?: boolean; tipo?: string; error?: string };
        if (res.ok && d.ok) {
          setTipo(d.tipo === "definir" ? "definir" : "repor");
          setEstado("pronto");
        } else {
          setErroDoLink(d.error || MENSAGEM_DO_LINK.desconhecido);
          setEstado("erro");
        }
      } catch {
        setErroDoLink("Sem ligação. Verifique a internet e abra o link outra vez.");
        setEstado("erro");
      }
    })();
  }, [params]);

  const gravar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (estado === "a-gravar") return;
    setErro("");
    if (nova.length < MINIMO_DA_PALAVRA_PASSE) {
      setErro(`A palavra-passe tem de ter pelo menos ${MINIMO_DA_PALAVRA_PASSE} caracteres.`);
      return;
    }
    if (nova !== repetida) {
      setErro("As duas palavras-passe não são iguais.");
      return;
    }
    setEstado("a-gravar");
    try {
      const res = await fetch("/api/entrada/repor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current, palavraPasse: nova }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; motivo?: string };
      if (res.ok && d.ok) {
        setEstado("feito");
        setTimeout(() => window.location.replace("/conta"), 1500);
        return;
      }
      if (d.motivo) {
        setErroDoLink(d.error || MENSAGEM_DO_LINK.desconhecido);
        setEstado("erro");
        return;
      }
      setErro(d.error || "Não foi possível gravar. Tente outra vez.");
      setEstado("pronto");
    } catch {
      setErro("Sem ligação. Verifique a internet e tente outra vez.");
      setEstado("pronto");
    }
  };

  const cartao = "w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-xl";

  if (estado === "a-ver") {
    return (
      <div className={`${cartao} text-center`}>
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#00B4CC]" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-tinta">A abrir o link…</p>
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <div className={`${cartao} text-center`}>
        <ShieldAlert className="mx-auto h-9 w-9 text-tinta-fraca" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-tinta">Este link já não serve</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{erroDoLink}</p>
        <Link
          href="/entrar"
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#00B4CC] text-sm font-bold text-white transition hover:bg-acao-hover"
        >
          Ir para a entrada
        </Link>
      </div>
    );
  }

  if (estado === "feito") {
    return (
      <div className={`${cartao} text-center`}>
        <CheckCircle2 className="mx-auto h-9 w-9 text-acao" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-tinta">Palavra-passe gravada</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Já pode entrar com o seu email e esta palavra-passe, aqui e na app CLYON.
        </p>
        <p className="mt-3 text-xs text-slate-500">A abrir a sua conta…</p>
      </div>
    );
  }

  return (
    <form onSubmit={gravar} className={cartao}>
      <h1 className="text-lg font-bold text-tinta">
        {tipo === "definir" ? "Escolha a sua palavra-passe" : "Escolha uma palavra-passe nova"}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        Pelo menos {MINIMO_DA_PALAVRA_PASSE} caracteres. Uma frase que se lembre serve bem.
      </p>

      <label htmlFor="nova" className="mt-5 block text-xs font-semibold text-slate-600">
        Palavra-passe nova
      </label>
      <div className="relative mt-1">
        <input
          id="nova"
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          required
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-11 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? "Esconder a palavra-passe" : "Mostrar a palavra-passe"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
        >
          {ver ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <label htmlFor="repetida" className="mt-3 block text-xs font-semibold text-slate-600">
        Repita a palavra-passe
      </label>
      <input
        id="repetida"
        type={ver ? "text" : "password"}
        autoComplete="new-password"
        required
        value={repetida}
        onChange={(e) => setRepetida(e.target.value)}
        className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
      />

      {erro && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={estado === "a-gravar"}
        className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#00B4CC] text-sm font-bold text-white transition hover:bg-acao-hover disabled:opacity-50"
      >
        {estado === "a-gravar" ? "A gravar…" : "Gravar e entrar"}
      </button>
    </form>
  );
}
