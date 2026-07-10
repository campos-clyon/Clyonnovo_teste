import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Phone,
  Shield,
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
  title: "Mudanças em Lisboa e Setúbal — Rápidas, Seguras, Sem Stress",
  description:
    "Mudanças residenciais e comerciais em Lisboa e Setúbal. Equipa profissional, embalagem, carga, transporte e montagem. Resposta em 24h, 163 reviews 5⭐. Orçamento grátis!",
  alternates: { canonical: `${SITE_URL}/mudancas` },
  openGraph: {
    title: "Mudanças em Lisboa e Setúbal — Profissional e Sem Stress",
    description:
      "Mudanças rápidas com equipa profissional. Carga, transporte, descarga e montagem. Preços desde 150€. Orçamento grátis!",
    url: `${SITE_URL}/mudancas`,
  },
};

const keyCities = ["lisboa", "almada", "seixal", "setubal", "sintra", "cascais", "oeiras", "amadora"]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

const pricingRows = [
  { service: "Mudança T0/T1 (até 20m³)", priceFrom: "150€", priceTo: "280€", description: "Estúdio ou apartamento pequeno" },
  { service: "Mudança T2 (até 40m³)", priceFrom: "280€", priceTo: "450€", description: "Apartamento familiar médio" },
  { service: "Mudança T3/T4 (até 60m³)", priceFrom: "450€", priceTo: "700€", description: "Apartamento ou moradia grande" },
  { service: "Mudança de escritório", priceFrom: "350€", priceTo: "800€", description: "Depende do volume e equipamento" },
  { service: "Transporte avulso (até 3 peças)", priceFrom: "80€", priceTo: "150€", description: "Sofá, cama ou armário isolado" },
];

const faqs = [
  {
    question: "Quanto custa uma mudança em Lisboa?",
    answer: "O preço depende do volume (tamanho do apartamento), distância entre moradas, necessidade de desmontagem/montagem e andar (com ou sem elevador). Um T1 dentro de Lisboa fica entre 150EUR e 280EUR em média.",
  },
  {
    question: "Fazem desmontagem e montagem de móveis?",
    answer: "Sim, a nossa equipa faz desmontagem na origem e montagem no destino. O serviço pode ser incluído no orçamento ou pedido separadamente conforme a complexidade dos móveis.",
  },
  {
    question: "Com quantos dias de antecedência devo marcar?",
    answer: "Recomendamos marcar com pelo menos 3 a 5 dias de antecedência, especialmente em fins de semana e fim de mês. Para datas urgentes, contacte-nos para verificar disponibilidade.",
  },
  {
    question: "Fornecem material de embalagem?",
    answer: "Sim, disponibilizamos caixas, plástico bolha, fita adesiva e cobertores de proteção. Pode incluir o material no orçamento ou comprar separadamente.",
  },
  {
    question: "Fazem mudanças ao fim de semana?",
    answer: "Sim, trabalhamos aos sábados e, mediante disponibilidade, aos domingos. Os preços podem ter um acréscimo de 10-20% dependendo do dia e horário.",
  },
];

const includedItems = [
  "Carga e descarga de todos os volumes",
  "Transporte em veículo adequado ao volume",
  "Proteção de móveis com cobertores",
  "Desmontagem e montagem básica",
  "Subida e descida de escadas",
  "Equipa de 2 a 4 pessoas conforme necessidade",
];

const differentiators = [
  "Equipa profissional treinada para cargas pesadas",
  "Veículos de vários tamanhos (carrinhas a camiões)",
  "Proteção de paredes, elevadores e acessos",
  "Seguro de responsabilidade civil incluído",
  "Orçamento detalhado sem surpresas",
  "Flexibilidade de horário (manhã, tarde, fim de semana)",
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Serviço de Mudanças",
  description: "Mudanças residenciais e comerciais em Lisboa, Margem Sul e Setúbal com carga, transporte, descarga e montagem.",
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

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: BUSINESS_NAME, item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Serviços", item: `${SITE_URL}/servicos` },
    { "@type": "ListItem", position: 3, name: "Mudanças", item: `${SITE_URL}/mudancas` },
  ],
};

export const revalidate = 86400;

export default function MudancasPage() {
  const lisboaCities = getCitiesByRegion("lisboa");
  const margemSulCities = getCitiesByRegion("margem-sul");
  const setubalCities = getCitiesByRegion("setubal");

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.15),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(5,150,105,0.10),_transparent_32%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
          <Breadcrumb
            items={[
              { label: "Serviços", href: "/servicos" },
              { label: "Mudanças" },
            ]}
            className="mb-6"
          />
          <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
                <Truck className="h-4 w-4" />
                Mudanças em Lisboa e Setúbal
              </div>
              <h1 className="mt-5 max-w-[16ch] text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
                Mudanças Residenciais e Comerciais
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Tratamos da sua mudança do início ao fim: embalagem, carga, transporte,
                descarga e montagem de móveis. Equipa profissional, veículos adequados
                e orçamento sem surpresas.
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
                  <p className="text-sm font-semibold text-slate-950">Cobertura</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Lisboa, Margem Sul, Setúbal</p>
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
            { icon: Clock3, title: "Pontualidade", desc: "Chegamos à hora combinada e cumprimos o planeamento acordado." },
            { icon: Shield, title: "Proteção incluída", desc: "Seguro de responsabilidade civil e proteção dos seus bens durante o transporte." },
            { icon: Package, title: "Serviço completo", desc: "Embalagem, desmontagem, transporte, descarga e montagem no destino." },
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

      {/* O que incluímos + Diferenciadores */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[30px] border border-emerald-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(5,150,105,0.1)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">O que incluímos</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Serviço de mudança completo</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {includedItems.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-[18px] border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-slate-950 p-7 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Porquê a CLYON</p>
            <h2 className="mt-3 text-2xl font-bold">Mudanças sem stress</h2>
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
            title="Preços de Mudanças"
            subtitle="Valores orientativos para Lisboa e Setúbal"
            rows={pricingRows}
          />
        </div>
      </section>

      {/* Zonas de cobertura */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Mudanças por Zona
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-slate-600">
            Fazemos mudanças dentro de Lisboa, entre Lisboa e Margem Sul, e para Setúbal. 
            <Link href={`/${getCityServiceSlug("mudancas", "lisboa")}`} className="ml-1 font-medium text-emerald-600 hover:underline">
              Ver preços de mudanças em Lisboa
            </Link>
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Lisboa */}
            <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Grande Lisboa</h3>
              <div className="flex flex-wrap gap-2">
                {lisboaCities.slice(0, 8).map((city) => (
                  <span
                    key={city.slug}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Margem Sul */}
            <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
                Margem Sul
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Base CLYON</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {margemSulCities.map((city) => (
                  <span
                    key={city.slug}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Setúbal */}
            <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Setúbal</h3>
              <div className="flex flex-wrap gap-2">
                {setubalCities.map((city) => (
                  <span
                    key={city.slug}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/areas-de-atuacao" className="inline-flex items-center gap-2 text-emerald-600 transition-colors hover:text-emerald-700">
              Ver todas as áreas de atuação
            </Link>
          </div>
        </div>
      </section>

      {/* Serviços relacionados */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-[30px] border border-emerald-100 bg-emerald-50/50 p-7">
          <h2 className="text-2xl font-bold text-slate-950">Serviços relacionados</h2>
          <p className="mt-2 text-slate-600">Muitas vezes a mudança vem acompanhada de outros serviços:</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              { href: "/recolha-de-moveis", label: "Recolha de Móveis", desc: "Retirar móveis que não vão para a nova casa" },
              { href: "/esvaziamento-casas", label: "Esvaziamento de Casas", desc: "Libertar o imóvel completamente" },
              { href: "/recolha-de-entulho", label: "Recolha de Entulho", desc: "Se houver obras na nova casa" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[20px] border border-emerald-100 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="font-bold text-slate-900">{item.label}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                  Ver serviço <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50">
        <FAQSection title="Perguntas sobre Mudanças" faqs={faqs} includeSchema={false} />
      </section>

      {/* CTA Final */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Precisa de fazer uma mudança?"
            description="Peça um orçamento grátis. Respondemos em 24 horas com um valor detalhado para a sua mudança."
            whatsappMessage="Olá! Preciso de fazer uma mudança. Podem dar-me um orçamento?"
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    </div>
  );
}
