import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, Search } from "lucide-react";

import { getAllBlogPosts } from "@/lib/blog-data";
import { SITE_URL } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Blog — Guias de Recolha de Moveis, Monos e Entulho",
  description:
    "Guias praticos: como doar moveis, recolha de monos, entulho de obra, esvaziamento de casas. Dicas para libertar espaco em Lisboa, Almada e Setubal.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
};

export const revalidate = 86400;

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(135deg,#ecfeff_0%,#ffffff_40%,#f8fafc_100%)]">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700 shadow-sm">
                Blog CLYON
              </div>
              <h1 className="mt-5 max-w-[14.5ch] text-[2.45rem] font-bold leading-[1.04] tracking-tight text-slate-950 sm:text-[3.8rem]">
                Conteúdo útil para quem precisa de libertar espaço sem complicações.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
                Guias práticos sobre recolha, doações, despejo de móveis, entulho,
                monos, pós-obra e esvaziamentos. O foco é captar procura qualificada
                e ajudar o cliente a perceber rapidamente qual é o serviço certo.
              </p>
            </div>

            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    SEO local
                  </p>
                  <p className="mt-2 text-sm leading-8 text-slate-600">
                    Estes artigos foram pensados para captar termos com intenção
                    real de contacto, como recolha de móveis, doação, despejo de
                    monos, entulho de obra e esvaziamentos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_22px_50px_-36px_rgba(14,116,144,0.16)]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    {post.category}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    {post.readingTime}
                  </span>
                </div>
                <h2 className="mt-5 text-3xl font-bold leading-tight text-slate-950">
                  {post.title}
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-600">
                  {post.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {post.keywords.slice(0, 4).map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-7 inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-18px_rgba(6,182,212,0.7)] transition hover:-translate-y-0.5 hover:bg-cyan-400"
                >
                  <span className="text-white">Ler artigo</span>
                  <ArrowRight className="ml-2 h-4 w-4 text-white" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
