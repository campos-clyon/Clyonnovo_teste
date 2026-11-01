import { Suspense } from "react";
import type { Metadata } from "next";
import ReporPalavraPasse from "./ReporPalavraPasse";

/** `noindex` e `no-referrer`, como /entrar/link: o endereço traz um token. */
export const metadata: Metadata = {
  title: "Escolher a palavra-passe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
            <p className="text-sm text-slate-500">A abrir…</p>
          </div>
        }
      >
        <ReporPalavraPasse />
      </Suspense>
    </main>
  );
}
