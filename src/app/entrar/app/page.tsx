import { Suspense } from "react";
import type { Metadata } from "next";
import AbrirNaApp from "./AbrirNaApp";

/**
 * O LINK DE ENTRADA DA APP CLYON, ABERTO FORA DA APP — 28-10-2026 (S1).
 *
 * Com a app instalada e o App Link verificado, o Android abre a app e nunca
 * chega aqui. Chega-se aqui no computador, noutro navegador, quando o Gmail
 * abre o link no navegador dele, ou sem a app. Esta página NÃO GASTA o link:
 * nunca chama o provedor do site nem a R1. Diz só onde o abrir.
 *
 * `noindex` e `no-referrer`, como o /entrar/link: o endereço traz o token.
 */
export const metadata: Metadata = {
  title: "Abrir na app",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
            <p className="text-sm text-slate-500">Um instante…</p>
          </div>
        }
      >
        <AbrirNaApp />
      </Suspense>
    </main>
  );
}
