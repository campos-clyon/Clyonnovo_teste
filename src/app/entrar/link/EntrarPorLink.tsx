"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2, ShieldAlert } from "lucide-react";
import { MENSAGEM, pareceUmToken, type MotivoDeRecusa } from "@/lib/entrada-por-link";

/**
 * Consome o link de entrada.
 *
 * O TOKEN SAI DO ENDEREÇO À PRIMEIRA OPORTUNIDADE. Enquanto lá está, viaja no
 * cabeçalho Referer de tudo o que a página carregue, fica no histórico do
 * browser e aparece inteiro numa partilha de ecrã. Vale uma sessão: é uma
 * credencial e trata-se como tal. Aqui é lido, apagado do endereço com um
 * `replaceState`, e só depois usado.
 *
 * Uma vez só, e a guarda é local além de ser da base. O React em
 * desenvolvimento monta os componentes duas vezes, e sem esta trava a segunda
 * montagem gastava o link que a primeira acabou de usar — a pessoa via
 * "este link já foi usado" depois de ter entrado com sucesso.
 */
export default function EntrarPorLink() {
  const router = useRouter();
  const params = useSearchParams();
  const jaCorreu = useRef(false);
  const [erro, setErro] = useState<MotivoDeRecusa | null>(null);

  useEffect(() => {
    if (jaCorreu.current) return;
    jaCorreu.current = true;

    const token = params.get("t");

    // Fora do endereço antes de qualquer outra coisa.
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", "/entrar/link");
    }

    if (!token) {
      setErro("ausente");
      return;
    }
    if (!pareceUmToken(token)) {
      setErro("malformado");
      return;
    }

    (async () => {
      const r = await signIn("link-de-entrada", { token, redirect: false });
      if (r?.ok) {
        // `replace` e não `push`: voltar atrás não pode trazer de volta um
        // ecrã que tenta entrar outra vez com um link já gasto.
        router.replace("/conta");
        return;
      }
      /*
       * O servidor não diz porque recusou, e é de propósito: a resposta do
       * NextAuth é a mesma para um token inventado e para um expirado, o que
       * impede que isto sirva para descobrir seja o que for. À pessoa que
       * está de facto à espera, "não resultou" chega para saber o que fazer.
       */
      setErro("desconhecido");
    })();
  }, [params, router]);

  if (erro) {
    return (
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
        <ShieldAlert className="mx-auto h-9 w-9 text-tinta-fraca" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-tinta">Não foi possível entrar</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{MENSAGEM[erro]}</p>
        <Link
          href="/entrar"
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#00B4CC] text-sm font-bold text-white transition hover:bg-acao-hover"
        >
          Pedir um link novo
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
      <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#00B4CC]" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-tinta">A entrar…</p>
      <p className="mt-1 text-xs text-slate-500">Só um instante.</p>
    </div>
  );
}
