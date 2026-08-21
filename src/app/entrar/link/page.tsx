import { Suspense } from "react";
import type { Metadata } from "next";
import EntrarPorLink from "./EntrarPorLink";

/**
 * `noindex` e `no-referrer`.
 *
 * O primeiro porque um ecrã de entrada não tem nada para o Google. O segundo
 * porque o endereço traz um token: sem ele, o browser mandava a página
 * inteira — token incluído — no cabeçalho Referer de qualquer recurso
 * externo que a página tocasse.
 */
export const metadata: Metadata = {
  title: "Entrar | CLYON",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
            <p className="text-sm text-slate-500">A entrar…</p>
          </div>
        }
      >
        <EntrarPorLink />
      </Suspense>
    </main>
  );
}
