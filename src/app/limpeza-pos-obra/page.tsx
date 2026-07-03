import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Sparkles,
  SprayCan,
  Truck,
} from "lucide-react";

import Breadcrumb from "@/components/Breadcrumb";
import CTABlock from "@/components/CTABlock";
import FAQSection from "@/components/service/FAQSection";
import PricingTable from "@/components/service/PricingTable";
import TrustBadges from "@/components/TrustBadges";
import { getCitiesByRegion } from "@/lib/city-content";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CITIES,
  SITE_URL,
  getCityServiceSlug,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Limpeza Pós-Obra Profissional em Lisboa e Setúbal",
  description:
    "Limpeza pós-obra profissional em Lisboa e Setúbal. Remoção de pó, cimento e resíduos de construção. Preços desde 150EUR, orçamento grátis em 24h.",
  alternates: { canonical: `${SITE_URL}/limpeza-pos-obra` },
  openGraph: {
    title: "Limpeza Pós-Obra em Lisboa e Setúbal",
    description:
      "Limpeza profissional após obras de renovação. Preços desde 150EUR em Lisboa e Setúbal.",
    url: `${SITE_URL}/limpeza-pos-obra`,
  },
};

const keyCities = ["lisboa", "almada", "seixal", "setubal", "sintra", "cascais", "oeiras", "amadora"]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

const pricingRows = [
  { service: "Limpeza pós-obra T0/T1", priceFrom: "150€", priceTo: "250€", description: "Apartamento pequeno até 60m²" },
  { service: "Limpeza pós-obra T2", priceFrom: "200€", priceTo: "350€", description: "Apartamento até 90m²" },
  { service: "Limpeza pós-obra T3/T4", priceFrom: "300€", priceTo: "500€", description: "Apartamento grande 90-150m²" },
  { service: "Limpeza pós-obra moradia", priceFrom: "400€", priceTo: "800€", description: "Moradia completa (depende de área)" },
  { service: "Limpeza de espaço comercial", priceFrom: "250€", priceTo: "600€", description: "Lojas e escritórios" },
];

const faqs = [
  {
    question: "O que inclui a limpeza pós-obra?",
    answer: "A limpeza inclui remoção de pó de construção de todas as superfícies, limpeza de janelas e vidros, limpeza de sanitários, cozinha, aspiração e lavagem de chão, limpeza de armários por dentro e por fora, e remoção de restos de tinta e cimento.",
  },
  {
    question: "Quanto tempo demora uma limpeza pós-obra?",
    answer: "Uma limpeza de T1/T2 demora geralmente 4-6 horas. Apartamentos maiores ou moradias podem demorar um dia inteiro ou mais, dependendo do estado e do nível de acabamento da obra.",
  },
  {
    question: "Também retiram o entulho que sobrou da obra?",
    answer: "Sim, podemos combinar a limpeza pós-obra com recolha de entulho e restos de materiais. É um serviço complementar com orçamento à parte.",
  },
  {
    question: "Quando devo fazer a limpeza pós-obra?",
    answer: "O ideal é fazer a limpeza quando a obra estiver totalmente concluída, incluindo pintura seca. Se a pintura ainda não secou, o pó pode voltar a assentar.",
  },
  {
    question: "Trazem os produtos e equipamentos?",
    answer: "Sim, trazemos todos os produtos de limpeza profissionais, aspiradores industriais, panos e equipamentos necessários. O cliente não precisa de fornecer nada.",
  },
];

const includedServices = [
  "Remoção de pó de construção de todas as superfícies",
  "Limpeza e desengordurantes de janelas e vidros",
  "Limpeza completa de sanitários e cozinha",
  "Remoção de manchas de tinta e cimento",
  "Aspiração e lavagem de pavimentos",
  "Limpeza de armários por dentro e fora",
];

const differentiators = [
  "Equipamentos profissionais e aspiradores industriais",
  "Produtos específicos para remoção de resíduos de obra",
  "Equipa experiente em limpezas pós-remodelação",
  "Combinamos com recolha de entulho e móveis se necessário",
  "Disponibilidade rápida para preparar entrega de imóveis",
  "Cobertura em Lisboa, Margem Sul e Setúbal",
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Limpeza Pós-Obra",
  description: "Serviço de limpeza profissional após obras de renovação em Lisboa e Setúbal.",
  provider: {
    "@type": "LocalBusiness",
    name: BUSINESS_NAME,
    telephone: BUSINESS_PHONE,
  },
  areaServed: keyCities.map((city) => ({ "@type": "City", name: city.name })),
  offers: {
    "@type": "Offer",
    priceSpecification: {
      "@type": "PriceSpecification",
      price: "150",
      priceCurrency: "EUR",
      minPrice: "150",
    },
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export const revalidate = 86400;

export default function LimpezaPosObraPage() {
  const lisboaCities = getCitiesByRegion("lisboa");
  const margemSulCities = getCitiesByRegion("margem-sul");
  const setubalCities = getCitiesByRegion("setubal");

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_32%)]" />
<div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
  <Breadcrumb
    items={[
      { label: "Serviços", href: "/servicos" },
      { label: "Limpeza Pós-Obra" },
    ]}
    className="mb-6"
  />
  <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
  <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
                Limpeza pós-obra em Lisboa e Setúbal
              </div>
              <h1 className="mt-5 max-w-[16ch] text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
                Limpeza Pós-Obra Profissional
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Removemos todo o pó, cimento, tinta e resíduos de construção
                para deixar o seu espaço pronto a habitar. Equipamentos
                profissionais e produtos específicos para um acabamento impecável.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/contactos"
                  className="site-btn-primary min-w-[220px] px-6 py-3.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Pedir Orçamento Grátis
                </Link>
                <a
                  href={`tel:${BUSINESS_PHONE}`}
                  className="site-btn-secondary min-w-[220px] border-slate-300 text-slate-900 hover:bg-slate-50"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Ligar {BUSINESS_PHONE}
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Preços desde <span className="font-semibold text-emerald-600">150EUR</span> para T0/T1
              </p>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white p-6 shadow-[0_24px_60px_-34px_rgba(5,150,105,0.14)]">
              <TrustBadges variant="grid" />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-950">Orçamento em</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600">24 horas</p>
                </div>
                <div className="rounded-[22px] border border-emerald-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Produtos</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Profissionais incluídos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: SprayCan, title: "Limpeza profunda", desc: "Remoção completa de pó de construção, manchas de tinta e resíduos de cimento." },
            { icon: Clock3, title: "Rapidez na execução", desc: "Equipa experiente que limpa um T2 em 4-6 horas, pronto para habitar." },
            { icon: Truck, title: "Serviço combinado", desc: "Podemos combinar com recolha de entulho e móveis velhos no mesmo dia." },
          ].map((item) => (
            <div key={item.title} className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(5,150,105,0.12)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* O que inclui + Diferenciadores */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[30px] border border-emerald-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(5,150,105,0.1)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">O que inclui</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Serviço completo</h2>
            <div className="mt-6 grid gap-3">
              {includedServices.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[18px] border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-slate-700">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-slate-950 p-7 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Porquê a CLYON</p>
            <h2 className="mt-3 text-2xl font-bold">Limpeza profissional de obra</h2>
            <div className="mt-6 space-y-3">
              {differentiators.map((item) => (
                <div key={item} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Preços */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PricingTable
            title="Preços de Limpeza Pós-Obra"
            subtitle="Valores orientativos para Lisboa e Setúbal"
            rows={pricingRows}
            footnote="O preço final depende do estado do imóvel, área e nível de acabamento da obra."
          />
        </div>
      </section>

      {/* Zonas de cobertura */}
      <section className="bg-slate-50/50 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Limpeza Pós-Obra por Zona
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-slate-600">
            Clique na sua cidade para ver detalhes específicos.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Grande Lisboa</h3>
              <div className="flex flex-wrap gap-2">
                {lisboaCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("limpeza-pos-obra", city.slug)}`}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm transition-all hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-md"
                    style={{ color: '#1e293b' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200 bg-white p-6 shadow-sm ring-1 ring-cyan-100">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
                Margem Sul
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">Base CLYON</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {margemSulCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("limpeza-pos-obra", city.slug)}`}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm transition-all hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-md"
                    style={{ color: '#1e293b' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Setúbal</h3>
              <div className="flex flex-wrap gap-2">
                {setubalCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("limpeza-pos-obra", city.slug)}`}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm transition-all hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-md"
                    style={{ color: '#1e293b' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/areas-de-atuacao" className="inline-flex items-center gap-2 text-cyan-600 transition-colors hover:text-cyan-700">
              Ver todas as áreas de atuação
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Links principais */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Páginas mais procuradas</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {keyCities.slice(0, 8).map((city) => (
              <Link
                key={city.slug}
                href={`/${getCityServiceSlug("limpeza-pos-obra", city.slug)}`}
                className="group rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-cyan-600">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-semibold uppercase tracking-wide">{city.regionLabel}</span>
                </div>
                <h3 className="mt-2 font-bold text-slate-900 group-hover:text-cyan-700">Limpeza em {city.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50">
        <FAQSection title="Perguntas sobre Limpeza Pós-Obra" faqs={faqs} includeSchema={false} />
      </section>

      {/* CTA Final */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Acabou a obra?"
            description="Peça um orçamento grátis para limpeza pós-obra. Deixamos o espaço pronto a habitar."
            whatsappMessage="Olá! Preciso de limpeza pós-obra. Podem dar-me um orçamento?"
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </div>
  );
}
