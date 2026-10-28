"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Smartphone } from "lucide-react";
import { MINUTOS_DE_VALIDADE, pareceUmToken } from "@/lib/entrada-por-link";
import { abrirNaAppDeClienteNoAndroid } from "@/lib/links-da-app";

/**
 * «ABRA NA APP CLYON» — a página do link de entrada da app, no navegador.
 *
 * O TOKEN SAI DO ENDEREÇO À PRIMEIRA OPORTUNIDADE, como no /entrar/link, e
 * fica só na memória da página para o botão «Abrir na app». Esta página não
 * entra em lado nenhum nem gasta o link: o link só serve na app, no telemóvel
 * onde foi pedido.
 */
export default function AbrirNaApp() {
  const params = useSearchParams();
  const jaLeu = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    if (jaLeu.current) return;
    jaLeu.current = true;
    const t = params.get("t");
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", "/entrar/app");
    }
    if (pareceUmToken(t)) setToken(t);
    setAndroid(typeof navigator !== "undefined" && /android/i.test(navigator.userAgent));
  }, [params]);

  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
      <Smartphone className="mx-auto h-9 w-9 text-[#00B4CC]" aria-hidden="true" />
      <h1 className="mt-3 text-lg font-bold text-tinta">Abra na app CLYON</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Este link de entrada é para a app CLYON, no telemóvel onde o pediu. Dura {MINUTOS_DE_VALIDADE} minutos e serve uma vez.
      </p>
      {android && token && (
        <a
          href={abrirNaAppDeClienteNoAndroid(`entrar/app?t=${encodeURIComponent(token)}`, "https://clyon.pt/entrar/app")}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#00B4CC] text-sm font-bold text-white transition hover:bg-acao-hover"
        >
          Abrir na app
        </a>
      )}
      <p className="mt-5 text-sm text-slate-600">
        Quer entrar no site?{" "}
        <Link href="/entrar" className="font-semibold text-acao underline underline-offset-4">
          Peça o link aqui.
        </Link>
      </p>
    </div>
  );
}
