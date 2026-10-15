import Link from "next/link";
import { BookOpen } from "lucide-react";

import { artigosDoServico } from "@/lib/blog-zonas";

/*
 * OS GUIAS DE UM SERVIÇO, NO HUB DELE — 14-10-2026 (pente fino de SEO).
 *
 * Os artigos do blog só recebiam ligação da lista do blog: o Google via-os
 * como páginas soltas, e quem lia o hub de um serviço não chegava ao guia que
 * lhe respondia à dúvida. A lista sai do mapa que já liga cada artigo ao seu
 * serviço (blog-zonas.ts) — um artigo novo entra sozinho no hub dele.
 */
export default function GuiasDoServico({ servico, titulo = "Guias para decidir" }: { servico: string; titulo?: string }) {
  const artigos = artigosDoServico(servico);
  if (artigos.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <BookOpen className="h-6 w-6 text-acao" />
        {titulo}
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {artigos.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/blog/${a.slug}`}
              className="block h-full rounded-xl border border-slate-200 bg-white px-5 py-4 transition hover:border-cyan-300"
            >
              <span className="block font-semibold text-slate-900">{a.title}</span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">{a.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
