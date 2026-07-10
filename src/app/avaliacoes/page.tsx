import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Star, Quote, MessageCircle } from "lucide-react";

import { reviews } from "@/lib/reviews-data";
import { BUSINESS_PHONE } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Avaliações e Testemunhos de Clientes — CLYON Lisboa e Setúbal",
  description:
    "Mais de 160 avaliações verificadas. Clientes em Lisboa, Margem Sul e Setúbal destacam rapidez, simpatia, preço transparente e limpeza final da equipa CLYON.",
  alternates: {
    canonical: "https://clyon.pt/avaliacoes",
  },
  openGraph: {
    title: "Avaliações Reais de Clientes — CLYON",
    description:
      "5.0 ★ · Mais de 160 avaliações verificadas. Rapidez, profissionalismo e preço justo — o que os clientes dizem sobre a CLYON em Lisboa e Setúbal.",
    url: "https://clyon.pt/avaliacoes",
  },
};

export const revalidate = 86400;

const aggregateRatingSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "CLYON",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5.0",
    reviewCount: "163",
    bestRating: "5",
    worstRating: "1",
  },
  review: reviews.slice(0, 10).map((r) => ({
    "@type": "Review",
    author: { "@type": "Person", name: r.name },
    datePublished: r.date,
    reviewBody: r.text,
    reviewRating: {
      "@type": "Rating",
      ratingValue: "5",
      bestRating: "5",
    },
  })),
};

const STATS = [
  { value: "5.0", label: "Classificação média", sub: "Google Business" },
  { value: "32", label: "Avaliações Google", sub: "todas verificadas" },
  { value: "156+", label: "Trabalhos Fixando", sub: "plataforma parceira" },
  { value: "100%", label: "Recomendariam", sub: "com base nas respostas" },
];

export default function AvaliacoesPage() {
  const whatsappUrl = `https://wa.me/351${BUSINESS_PHONE.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostava de pedir um orçamento à CLYON.")}`;

  return (
    <div className="min-h-screen bg-white">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),linear-gradient(160deg,rgba(236,254,255,0.9)_0%,rgba(255,255,255,1)_55%)]" />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-20">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition hover:text-cyan-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>

          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-700 shadow-sm">
                Avaliações verificadas
              </div>
              <h1 className="mt-5 text-[2.4rem] font-bold leading-[1.06] tracking-tight text-[#0B1929] sm:text-5xl lg:text-[3.2rem]">
                O que dizem os clientes{" "}
                <span className="text-cyan-500">sobre a CLYON</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg">
                Rapidez, profissionalismo e preço justo — estes são os três temas que dominam as avaliações
                de quem já usou a CLYON em Lisboa, Margem Sul e Setúbal.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/simulador"
                  className="inline-flex h-11 items-center rounded-xl bg-cyan-500 px-6 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:bg-cyan-400"
                >
                  Pedir Orçamento Grátis
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#25D366] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1ebe5d]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            </div>

            {/* Rating card */}
            <div className="rounded-3xl border border-cyan-100 bg-white p-8 shadow-[0_24px_60px_-20px_rgba(14,116,144,0.15)]">
              <div className="flex items-end gap-4">
                <div className="text-7xl font-black leading-none text-[#0B1929]">5.0</div>
                <div className="pb-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-6 w-6 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">163 avaliações combinadas</p>
                </div>
              </div>
              <p className="mt-5 text-base leading-7 text-slate-600">
                Clientes destacam rapidez, simpatia, limpeza final e clareza no
                orçamento. É assim que a CLYON constrói confiança, serviço após serviço.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-[#F4F8FB] p-4">
                    <div className="text-2xl font-black text-cyan-600">{s.value}</div>
                    <div className="mt-0.5 text-xs font-semibold text-[#0B1929]">{s.label}</div>
                    <div className="text-xs text-slate-400">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS GRID ─────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-[#0B1929] sm:text-3xl">
              Todos os testemunhos
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-500">
              Avaliações reais de clientes em Lisboa, Almada, Setúbal, Seixal, Amadora e toda a Margem Sul.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {reviews.map((review, i) => (
              <article
                key={`${review.name}-${i}`}
                className="flex flex-col rounded-2xl border border-[#E2EEF3] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#0B1929]">{review.name}</div>
                      <div className="text-xs text-slate-400">{review.date}</div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl bg-cyan-50 p-2 text-cyan-500">
                    <Quote className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{review.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO COPY ─────────────────────────────────────────────────── */}
      <section className="bg-white py-14 lg:py-18">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[#0B1929] sm:text-3xl">
            Porque é que os clientes recomendam a CLYON?
          </h2>
          <div className="mt-6 space-y-5 text-base leading-8 text-slate-600">
            <p>
              A CLYON presta serviços de <strong>recolha de móveis</strong>, <strong>recolha de entulho</strong>,{" "}
              <strong>esvaziamento de casas</strong> e <strong>mudanças</strong> em Lisboa, Margem Sul e Setúbal.
              As avaliações dos nossos clientes são consistentes: rapidez de resposta, pontualidade, equipa
              simpática e preço confirmado antes do serviço começar.
            </p>
            <p>
              Ao contrário de muitos fornecedores, a CLYON confirma o preço final antes de avançar —
              sem adicionais no dia da recolha. Os clientes recebem confirmação de data por mensagem e
              acompanhamento em tempo real.
            </p>
            <p>
              Com cobertura em mais de 24 localidades — incluindo Lisboa, Almada, Setúbal, Seixal,
              Barreiro, Amadora, Sintra e Cascais — a CLYON é a escolha de quem quer um serviço rápido,
              profissional e sem surpresas no preço.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] pb-16 pt-2 lg:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1929] to-[#0d2235] px-8 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Quer a mesma experiência no seu pedido?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400">
              Simule o orçamento em 2 minutos ou fale connosco pelo WhatsApp para receber
              uma resposta rápida e clara.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/simulador"
                className="inline-flex h-12 items-center rounded-xl bg-cyan-500 px-8 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:bg-cyan-400"
              >
                Simular Orçamento
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#25D366] px-8 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1ebe5d]"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aggregateRatingSchema) }}
      />
    </div>
  );
}
