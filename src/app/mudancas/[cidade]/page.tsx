import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Route,
  Shield,
  Star,
} from "lucide-react";

import CTABlock from "@/components/CTABlock";
import FAQSection from "@/components/service/FAQSection";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  SITE_URL,
} from "@/lib/seo-data";
import {
  CIDADES_MUDANCAS,
  getAllCidadeSlugs,
  getCidadeMudancaBySlug,
} from "@/lib/mudancas-cidades";

interface Props {
  params: Promise<{ cidade: string }>;
}

/** Pré-gerar todas as páginas estáticas em build — máxima performance + SEO */
export function generateStaticParams() {
  return getAllCidadeSlugs().map((cidade) => ({ cidade }));
}

/** Metadata única por cidade — title, description e canonical */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade } = await params;
  const c = getCidadeMudancaBySlug(cidade);
  if (!c) return { title: "Mudanças — CLYON" };

  const title = `Mudanças em ${c.nome} — Orçamento em 24h | ${BUSINESS_NAME}`;
  const description =
    `Mudanças residenciais e comerciais em ${c.nome} (${c.distrito}). ` +
    `Equipa profissional, embalagem, carga, transporte e montagem. ` +
    `Preços desde ${c.precoMin}€ para T0/T1. Orçamento grátis em 24h.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/mudancas/${c.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/mudancas/${c.slug}`,
      type: "website",
      locale: "pt_PT",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MudancasCidadePage({ params }: Props) {
  const { cidade } = await params;
  const c = getCidadeMudancaBySlug(cidade);
  if (!c) notFound();

  // ── Schema.org: LocalBusiness + Service + FAQPage + BreadcrumbList ────────
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${SITE_URL}/mudancas/${c.slug}#business`,
        name: `${BUSINESS_NAME} — Mudanças em ${c.nome}`,
        image: `${SITE_URL}/logo-clyon.png`,
        telephone: BUSINESS_PHONE,
        priceRange: `€${c.precoMin}–€${c.precoMax}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: c.nome,
          addressRegion: c.distrito,
          addressCountry: "PT",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: c.geo.lat,
          longitude: c.geo.lng,
        },
        areaServed: {
          "@type": "City",
          name: c.nome,
        },
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            opens: "08:00",
            closes: "20:00",
          },
        ],
      },
      {
        "@type": "Service",
        "@id": `${SITE_URL}/mudancas/${c.slug}#service`,
        serviceType: "Mudanças residenciais e comerciais",
        provider: { "@id": `${SITE_URL}/mudancas/${c.slug}#business` },
        areaServed: { "@type": "City", name: c.nome },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: c.precoMin,
          highPrice: c.precoMax,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.pergunta,
          acceptedAnswer: { "@type": "Answer", text: f.resposta },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Mudanças", item: `${SITE_URL}/mudancas` },
          { "@type": "ListItem", position: 3, name: c.nome, item: `${SITE_URL}/mudancas/${c.slug}` },
        ],
      },
    ],
  };

  const vizinhas = c.cidadesVizinhas
    .map((slug) => CIDADES_MUDANCAS.find((v) => v.slug === slug))
    .filter((v): v is (typeof CIDADES_MUDANCAS)[number] => Boolean(v));

  return (
    <div className="bg-gradient-to-br from-white via-emerald-50/30 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Breadcrumb ── */}
      <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-6 text-xs text-slate-500 sm:px-6">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="hover:text-emerald-600">Início</Link></li>
          <li>›</li>
          <li><Link href="/mudancas" className="hover:text-emerald-600">Mudanças</Link></li>
          <li>›</li>
          <li className="font-semibold text-slate-800">{c.nome}</li>
        </ol>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              <MapPin className="h-3 w-3" /> {c.nome} · {c.distrito}
            </div>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Mudanças em {c.nome}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Serviço completo de mudanças residenciais e comerciais em {c.nome} —
              embalagem, carga, transporte, descarga e montagem. Equipa profissional,
              orçamento em 24 horas e sem surpresas.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/simulador"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 hover:shadow-lg"
              >
                Pedir orçamento grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={`tel:${BUSINESS_PHONE}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
              >
                <Phone className="h-4 w-4" /> Ligar {BUSINESS_PHONE}
              </a>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Preços desde <strong className="text-emerald-600">{c.precoMin}€</strong> para T0/T1 em {c.nome}
            </p>
          </div>

          {/* Info cards à direita */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Distância à base</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{c.distanceKm} km</p>
              <p className="text-xs text-slate-400">~{c.tempoMedio} de viagem</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Orçamento em</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">24 horas</p>
              <p className="text-xs text-slate-400">Resposta rápida</p>
            </div>
            <div className="col-span-full rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Faixa de preço {c.nome}</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {c.precoMin}€ – {c.precoMax}€
              </p>
              <p className="text-xs text-slate-400">Consoante volume e acessos</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rotas comuns ── */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Rotas mais pedidas a partir de {c.nome}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Cobrimos todas as rotas na região. Algumas das mais comuns:
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {c.rotasComuns.map((rota) => (
            <div
              key={rota}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
            >
              <Route className="h-4 w-4 shrink-0 text-emerald-500" />
              {rota}
            </div>
          ))}
        </div>
      </section>

      {/* ── Landmarks / Zonas ── */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Zonas de {c.nome} onde atuamos
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Conhecemos as particularidades logísticas das principais zonas da cidade — cada bairro tem os seus desafios.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {c.landmarks.map((l) => (
            <li key={l} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-sm text-slate-700">{l}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Particularidade logística de {c.nome}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{c.desafio}</p>
        </div>
      </section>

      {/* ── Testemunho (se existir) ── */}
      {c.testemunho && (
        <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <blockquote className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm">
            <div className="mb-3 flex gap-0.5">
              {Array.from({ length: c.testemunho.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-base italic leading-relaxed text-slate-700">
              &ldquo;{c.testemunho.texto}&rdquo;
            </p>
            <footer className="mt-4 text-sm font-semibold text-slate-600">— {c.testemunho.autor}</footer>
          </blockquote>
        </section>
      )}

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <FAQSection
          title={`Perguntas frequentes sobre mudanças em ${c.nome}`}
          faqs={c.faqs.map((f) => ({ question: f.pergunta, answer: f.resposta }))}
        />
      </section>

      {/* ── CTA ── */}
      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <CTABlock
            variant="centered"
            title={`Precisa de mudança em ${c.nome}?`}
            description="Orçamento grátis em 24 horas, sem compromisso."
            primaryText="Pedir orçamento"
            primaryHref="/simulador"
            showWhatsApp
            showPhone
            whatsappMessage={`Olá! Preciso de mudança em ${c.nome}. Podem dar-me um orçamento?`}
          />
        </div>
      </section>

      {/* ── Cidades vizinhas (internal linking) ── */}
      {vizinhas.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="text-xl font-bold text-slate-900">
            Também operamos nestas cidades próximas
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {vizinhas.map((v) => (
              <Link
                key={v.slug}
                href={`/mudancas/${v.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <MapPin className="h-3.5 w-3.5" /> Mudanças em {v.nome}
              </Link>
            ))}
            <Link
              href="/mudancas"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-400"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ── Trust block ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white border border-slate-100 p-5 text-center">
            <Shield className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-bold text-slate-800">Sem stress</p>
            <p className="text-xs text-slate-500">Equipa profissional, seguros incluídos</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-5 text-center">
            <Clock3 className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-bold text-slate-800">Resposta em 24h</p>
            <p className="text-xs text-slate-500">Orçamento personalizado por telefone ou email</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-5 text-center">
            <Star className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-bold text-slate-800">163 reviews 5★</p>
            <p className="text-xs text-slate-500">Feedback verificado de clientes CLYON</p>
          </div>
        </div>
      </section>
    </div>
  );
}
