import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  // Sem « — CLYON»: o template do layout já a acrescenta, e o 404 saía como
  // «Página não encontrada — CLYON | CLYON» (29-09-2026).
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-slate-900">404</h1>
      <p className="mt-4 text-lg text-slate-600">
        A página que procura não existe ou foi movida.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/"
          className="rounded-xl bg-acao px-6 py-3 text-sm font-semibold text-white transition hover:bg-acao-hover"
        >
          Voltar ao início
        </Link>
        <Link
          href="/contactos"
          className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Contactos
        </Link>
      </div>
    </div>
  );
}
