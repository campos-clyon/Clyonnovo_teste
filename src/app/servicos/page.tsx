import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
} from "lucide-react";

import { BUSINESS_NAME, BUSINESS_PHONE, SITE_URL } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Serviços de Recolha de Entulho, Limpezas e Mudanças",
  description:
    "Recolha de entulho, móveis, monos, limpeza pós-obra, esvaziamentos e mudanças em Lisboa e Setúbal. Preços desde 120EUR, orçamento grátis em 24h!",
  alternates: { canonical: `${SITE_URL}/servicos` },
  openGraph: {
    title: "Serviços de Recolha de Entulho, Limpezas e Mudanças",
    description:
      "Recolha de entulho, móveis, limpeza pós-obra e mudanças em Lisboa e Setúbal. Preços desde 120EUR!",
    url: `${SITE_URL}/servicos`,
  },
};

const WA_HREF = `https://wa.me/351931632622?text=${encodeURIComponent(
  "Olá CLYON, quero pedir orçamento para um serviço.",
)}`;

const services = [
  {
    title: "Recolha de Móveis",
    tagline: "Sofás, camas, armários, eletrodomésticos",
    price: "desde 60€",
    image: "/images/service-1.webp",
    href: "/recolha-de-moveis",
  },
  {
    title: "Recolha de Entulho",
    tagline: "Restos de obra, sacos e materiais mistos",
    price: "desde 120€",
    image: "/images/service-2.webp",
    href: "/recolha-de-entulho",
  },
  {
    title: "Esvaziamento de Casas",
    tagline: "Libertação completa do imóvel",
    price: "orçamento no local",
    image: "/images/service-3.webp",
    href: "/esvaziamento-de-casas",
  },
  {
    title: "Recolha de Monos",
    tagline: "Volumes grandes e acumulados",
    price: "desde 80€",
    image: "/images/service-4.webp",
    href: "/recolha-de-monos",
  },
  {
    title: "Mudanças",
    tagline: "Casa, escritório, com desmontagem",
    price: "orçamento personalizado",
    image: "/images/service-5.webp",
    href: "/mudancas",
  },
  {
    title: "Limpeza pós-obra",
    tagline: "Pronto a habitar depois de obra",
    price: "desde 150€",
    image: "/images/service-6.webp",
    href: "/limpeza-de-quintais",
  },
];

const steps = [
  { n: "1", title: "Envie fotos", text: "Por WhatsApp ou simulador. Basta a morada e algumas fotos." },
  { n: "2", title: "Receba o preço", text: "Orçamento claro em minutos, sem visitas nem surpresas." },
  { n: "3", title: "Marcamos e recolhemos", text: "Muitas vezes no próprio dia em Lisboa e Setúbal." },
];

const reviews = [
  { name: "Rita M.", text: "Rápido, profissional e sem confusão. Voltaria a contratar.", img: "/images/review-rita.webp" },
  { name: "Carlos S.", text: "Recolha do sofá antigo no mesmo dia. Preço justo.", img: "/images/review-carlos.webp" },
  { name: "Patricia C.", text: "Equipa educada, chegou à hora e deixou tudo limpo.", img: "/images/review-patricia.webp" },
];

const faqs = [
  {
    q: "Que tipo de pedidos a CLYON aceita?",
    a: "Recolha de entulho, móveis, monos, recheios, limpeza pós-obra, esvaziamento de casas e mudanças — para particulares e empresas.",
  },
  {
    q: "Recolhem no mesmo dia?",
    a: "Sempre que há disponibilidade, sim. Em Lisboa, Grande Lisboa, Margem Sul e Setúbal muitos pedidos ficam feitos no próprio dia ou no seguinte.",
  },
  {
    q: "Fazem desmontagem dentro de casa?",
    a: "Sim. Desmontamos móveis e tratamos do carregamento a partir do interior do imóvel, loja, escritório ou arrecadação.",
  },
  {
    q: "Como pagar?",
    a: "MB WAY, transferência ou numerário na altura do serviço. Emitimos fatura sempre.",
  },
  {
    q: "Trabalham com empresas e condomínios?",
    a: "Sim — particulares, senhorios, empresas, gestores de património, condomínios e equipas de obra.",
  },
];

export const revalidate = 86400;

const serviceListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Serviços CLYON",
  itemListElement: services.map((s, i) => ({
    "@type": "Service",
    position: i + 1,
    name: s.title,
    description: s.tagline,
    provider: { "@type": "LocalBusiness", name: BUSINESS_NAME, telephone: BUSINESS_PHONE },
    areaServed: ["Lisboa", "Setúbal", "Almada", "Seixal"],
  })),
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function ServicosPage() {
  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <Image
          src="/hero-clyon-carrinha-lisboa.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/70 to-slate-950" />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 md:pt-20 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <Sparkles className="h-3 w-3" />
            Resposta em minutos
          </div>

          <h1 className="mt-4 max-w-[16ch] text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Recolhas, limpezas e mudanças <span className="text-cyan-300">sem complicar.</span>
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Envie fotos, recebemos o pedido e damos preço claro. Lisboa, Margem Sul e Setúbal — muitas vezes no mesmo dia.
          </p>

          {/* CTAs primárias */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={WA_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:text-base"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp — orçamento agora
            </a>
            <Link
              href="/simulador"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 sm:text-base"
            >
              Simular preço
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:text-base"
            >
              <Phone className="h-4 w-4" />
              931 632 622
            </a>
          </div>

          {/* Reassurance strip */}
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300 sm:grid-cols-4 sm:text-sm">
            {[
              "Orçamento grátis",
              "Sem visita prévia",
              "Fatura sempre",
              "Destino responsável",
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-cyan-300" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-10 md:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-3 md:mb-8">
            <h2 className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl md:text-4xl">
              O que fazemos
            </h2>
            <Link
              href="/precos"
              className="hidden text-sm font-semibold text-cyan-700 hover:text-cyan-500 sm:inline-flex sm:items-center sm:gap-1"
            >
              Ver preços <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link
                key={s.title}
                href={s.href}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                  <Image
                    src={s.image}
                    alt={s.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-900">
                    {s.price}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-base font-bold text-slate-950 sm:text-lg">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{s.tagline}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 group-hover:text-cyan-500">
                    Ver detalhes <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="bg-white py-10 md:py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl md:text-4xl">
            Como pedir — 3 passos
          </h2>
          <p className="mt-2 max-w-lg text-sm text-slate-600 sm:text-base">
            Sem visita prévia, sem burocracia. Foto + morada = preço.
          </p>

          <ol className="mt-6 grid gap-3 md:grid-cols-3 md:gap-5">
            {steps.map((step) => (
              <li key={step.n} className="relative rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5">
                <span className="absolute -top-3 left-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-sm font-bold text-white shadow-md">
                  {step.n}
                </span>
                <h3 className="mt-2 text-base font-bold text-slate-950 sm:text-lg">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── REVIEWS ──────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-10 md:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between gap-3 md:mb-8">
            <div>
              <div className="flex items-center gap-1.5 text-amber-400">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
                <span className="ml-1 text-sm font-semibold text-slate-900">4,9 / 5</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Baseado em clientes reais em Lisboa e Setúbal.</p>
            </div>
            <Link
              href="/avaliacoes"
              className="hidden text-sm font-semibold text-cyan-700 hover:text-cyan-500 sm:inline-flex sm:items-center sm:gap-1"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {reviews.map((r) => (
              <figure key={r.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <blockquote className="text-sm leading-6 text-slate-700">&ldquo;{r.text}&rdquo;</blockquote>
                <figcaption className="mt-3 flex items-center gap-2.5">
                  <Image
                    src={r.img}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-10 md:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl md:text-4xl">
            Perguntas frequentes
          </h2>
          <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {faqs.map((f) => (
              <details key={f.q} className="group px-4 py-3.5 open:bg-slate-50 sm:px-5">
                <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-semibold text-slate-900 sm:text-base [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition group-open:rotate-45 group-open:border-cyan-500 group-open:text-cyan-600">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="bg-white pb-10 md:pb-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl md:px-10 md:py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.25),transparent_50%)]" />
            <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">
                  Já sabe o serviço? Peça agora.
                </h2>
                <p className="mt-2 max-w-lg text-sm text-slate-300 sm:text-base">
                  Envie o pedido pelo WhatsApp ou simulador — resposta em minutos.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <a
                  href={WA_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <Link
                  href="/simulador"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Simular preço
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STICKY MOBILE CTA ────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <a
            href={WA_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-3 text-sm font-semibold text-white active:bg-emerald-600"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <Link
            href="/simulador"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-3 text-sm font-semibold text-slate-950 active:bg-cyan-500"
          >
            Simular
          </Link>
          <a
            href={`tel:${BUSINESS_PHONE}`}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-700 active:bg-slate-100"
            aria-label="Ligar agora"
          >
            <Phone className="h-4 w-4" />
          </a>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  );
}
