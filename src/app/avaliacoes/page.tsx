import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Quote, Star } from "lucide-react";

import { reviews } from "@/lib/reviews-data";

export const metadata: Metadata = {
  title: "Avaliações Reais de Clientes",
  description:
    "Veja avaliações reais de clientes da CLYON sobre recolha de entulho, móveis, monos, limpeza pós-obra e mudanças em Lisboa, Margem Sul e Setúbal.",
  alternates: {
    canonical: "https://clyon.pt/avaliacoes",
  },
  openGraph: {
    title: "Avaliações Reais de Clientes",
    description:
      "Clientes destacam rapidez, simpatia, clareza no orçamento e boa execução da CLYON.",
    url: "https://clyon.pt/avaliacoes",
  },
};

export const revalidate = 86400;

export default function AvaliacoesPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition hover:text-cyan-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700 shadow-sm">
                Avaliações reais
              </div>
              <h1 className="mt-5 max-w-[13ch] text-[2.55rem] font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-[4.1rem]">
                Confiança construída serviço após serviço.
              </h1>
            </div>

            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <div className="flex items-end gap-4">
                <div className="text-6xl font-bold leading-none text-slate-950">5.0</div>
                <div className="pb-2">
                  <div className="flex gap-1 text-cyan-500">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-5 w-5 fill-current" />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">163 avaliações verificadas</p>
                </div>
              </div>
              <p className="mt-5 text-base leading-8 text-slate-600">
                Clientes destacam rapidez, simpatia, limpeza final e clareza no
                orçamento. É assim que a CLYON ganha confiança no terreno.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {reviews.map((review) => (
              <article
                key={`${review.name}-${review.date}`}
                className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.18)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-bold text-slate-950">{review.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{review.date}</div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                    <Quote className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 flex gap-1 text-cyan-500">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>

                <p className="mt-5 text-sm leading-8 text-slate-600">{review.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 lg:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] px-8 py-10 text-white shadow-[0_26px_70px_-30px_rgba(2,6,23,0.45)] lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  Próximo passo
                </p>
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Quer a mesma experiência no seu pedido?
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  Simule o orçamento agora ou fale connosco para receber uma resposta
                  rápida e clara.
                </p>
              </div>
              <Link
                href="/simulador"
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Simular orçamento
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
