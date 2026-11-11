"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { MENSAGEM_DO_LINK, pareceUmTokenDaConta } from "@/lib/palavra-passe-do-cliente";
import ProgramaDaApp from "@/components/ProgramaDaApp";

/**
 * Abre o link de confirmação do registo (01-11-2026).
 *
 * Como /entrar/link: o token sai do endereço antes de tudo, e usa-se uma vez
 * só (o React em desenvolvimento monta duas vezes). O link é gasto por um
 * POST, e não pelo GET da página — os pré-carregadores do correio abrem o
 * endereço sem correr o JavaScript, e assim não gastam o link a ninguém.
 */
export default function ConfirmarEmail() {
  const params = useSearchParams();
  const jaCorreu = useRef(false);
  const [estado, setEstado] = useState<"a-confirmar" | "feito" | "erro">("a-confirmar");
  const [erro, setErro] = useState<string>("");

  // Recarrega por inteiro: a sessão nova (o cookie) chega a todo o site.
  const abrirAConta = useCallback(() => {
    setTimeout(() => window.location.replace("/conta"), 1200);
  }, []);

  useEffect(() => {
    if (jaCorreu.current) return;
    jaCorreu.current = true;

    const token = params.get("token");
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", "/entrar/confirmar-email");
    }
    if (!pareceUmTokenDaConta(token)) {
      setErro(MENSAGEM_DO_LINK.malformado);
      setEstado("erro");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/entrada/confirmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const dados = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (res.ok && dados.ok) {
          /*
           * O CONVITE DO PROGRAMA DE ACESSO ANTECIPADO DA APP (11-11-2026):
           * a conta acabou de nascer, e é aqui que se pergunta. A ida para
           * /conta passou para `abrirAConta` — depois da resposta, ou já, se
           * não houver nada a perguntar.
           */
          setEstado("feito");
          return;
        }
        setErro(dados.error || "Não foi possível confirmar. Tente outra vez.");
        setEstado("erro");
      } catch {
        setErro("Sem ligação. Verifique a internet e abra o link outra vez.");
        setEstado("erro");
      }
    })();
  }, [params]);

  if (estado === "erro") {
    return (
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
        <ShieldAlert className="mx-auto h-9 w-9 text-tinta-fraca" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-tinta">Não foi possível confirmar</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{erro}</p>
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
      <div className="w-full max-w-sm space-y-4">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
        <CheckCircle2 className="mx-auto h-9 w-9 text-acao" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-tinta">Email confirmado</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          A sua conta está pronta. Na app CLYON, entre com o email e a palavra-passe que escolheu.
        </p>
      </div>
      <ProgramaDaApp modo="convite" origem="registo" onFechar={abrirAConta} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
      <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#00B4CC]" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-tinta">A confirmar o seu email…</p>
      <p className="mt-1 text-xs text-slate-500">Só um instante.</p>
    </div>
  );
}
