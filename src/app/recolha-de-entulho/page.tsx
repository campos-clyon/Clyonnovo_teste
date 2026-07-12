import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Recycle,
  Truck,
} from "lucide-react";

import CTABlock from "@/components/CTABlock";
import FAQSection from "@/components/service/FAQSection";
import PricingTable from "@/components/service/PricingTable";
import { getCitiesByRegion } from "@/lib/city-content";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CITIES,
  SITE_URL,
  getCityServiceSlug,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Recolha de Entulho em Lisboa — Obras e Remodelações | CLYON",
  description:
    "Recolha de entulho de obras, demolições e remodelações em Lisboa, Margem Sul e Setúbal. Big bags, contentores e carregamento directo. Resposta em 24h, preços desde 80€. Orçamento grátis.",
  keywords: [
    "recolha de entulho",
    "recolha de entulho Lisboa",
    "recolha de entulho de obras",
    "recolha de escombros",
    "big bag entulho",
    "carga de entulho",
    "recolha de entulho Setúbal",
    "recolha de entulho Almada",
    "remoção de entulho",
    "recolha de resíduos de construção",
  ],
  alternates: { canonical: `${SITE_URL}/recolha-de-entulho` },
  openGraph: {
    title: "Recolha de Entulho em Lisboa — Obras e Remodelações | CLYON",
    description:
      "Recolha de entulho de obras e remodelações em Lisboa e Setúbal. Big bags e carga completa. Resposta em 24h desde 80€.",
    url: `${SITE_URL}/recolha-de-entulho`,
  },
};

const keyCities = ["lisboa", "almada", "seixal", "setubal", "sintra", "cascais", "oeiras", "amadora"]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

const pricingRows = [
  { service: "Sacos de entulho (até 10 sacos)", priceFrom: "80€", priceTo: "120€", description: "Pequenas quantidades em saco big bag" },
  { service: "Recolha pequena (até 1m³)", priceFrom: "120€", priceTo: "180€", description: "Remodelações de WC ou cozinha" },
  { service: "Recolha média (até 3m³)", priceFrom: "180€", priceTo: "280€", description: "Obras de apartamento T1/T2" },
  { service: "Recolha grande (até 5m³)", priceFrom: "280€", priceTo: "400€", description: "Demolições e renovações completas" },
  { service: "Recolha extra (acima de 5m³)", priceFrom: "400€", priceTo: "—", description: "Orçamento personalizado" },
];

const faqs = [
  {
    question: "Quanto tempo demora a recolha de entulho?",
    answer: "Na maioria das zonas de Lisboa, Margem Sul e Setúbal conseguimos fazer a recolha em 24 a 48 horas. Em situações urgentes, podemos ir no mesmo dia mediante disponibilidade.",
  },
  {
    question: "Que tipo de entulho recolhem?",
    answer: "Recolhemos restos de obra como tijolos, cimento, azulejos, telhas, gesso cartonado e madeira. Não aceitamos amianto, resíduos perigosos ou lixo doméstico misturado.",
  },
  {
    question: "Fazem carregamento do entulho?",
    answer: "Sim, a nossa equipa carrega o entulho diretamente para a carrinha. Não precisa de se preocupar com o transporte — nós tratamos de tudo.",
  },
  {
    question: "Qual o preço mínimo para recolha de entulho?",
    answer: "Para pequenas quantidades em saco, o preço começa nos 80€. Para volumes maiores, o valor depende da quantidade, acessos e localização. Envie fotos para orçamento rápido.",
  },
  {
    question: "Recolhem entulho em apartamentos?",
    answer: "Sim, recolhemos entulho em apartamentos, moradias, lojas e escritórios. A equipa trata do carregamento mesmo em andares altos ou com acessos difíceis.",
  },
];

const includedItems = [
  "Restos de obra (tijolos, cimento, azulejos)",
  "Telhas, pedras e materiais de construção",
  "Gesso cartonado e isolamentos",
  "Madeiras de obra e carpintarias",
  "Sanitários e louças partidas",
  "Ferragens e materiais metálicos",
];

const differentiators = [
  "Recolha de entulho em 24 a 48 horas na maioria das zonas",
  "Carregamento directo pela nossa equipa",
  "Recolha pontual e encaminhamento para reciclagem",
  "Sem espera: chegamos, carregamos e levamos",
  "Equipa preparada para sacos, montes ou entulho disperso",
  "Cobertura em Lisboa, Margem Sul e Setúbal",
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Recolha de Entulho",
  description: "Serviço de recolha de entulho de obras e remodelações em Lisboa, Margem Sul e Setúbal.",
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
      price: "120",
      priceCurrency: "EUR",
      minPrice: "120",
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

export default function RecolhaEntulhoPage() {
  const lisboaCities = getCitiesByRegion("lisboa");
  const margemSulCities = getCitiesByRegion("margem-sul");
  const setubalCities = getCitiesByRegion("setubal");

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-amber-50/50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_32%)]" />
<div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
  <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
  <div className="max-w-3xl">
              <h1 className="mt-5 max-w-[18ch] text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
                Recolha de Entulho em Lisboa e Setúbal
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Recolhemos entulho de obras, remodelações e limpezas com carregamento directo. 
                Sem espera: a equipa chega, carrega e encaminha para destino responsável.
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
                Preços desde <span className="font-semibold text-amber-600">80EUR</span> para recolha de sacos
              </p>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-amber-100 bg-white p-6 shadow-[0_24px_60px_-34px_rgba(180,83,9,0.14)]">
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-amber-100 bg-amber-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-950">Resposta em</p>
                  <p className="mt-2 text-2xl font-bold text-amber-600">24 horas</p>
                </div>
                <div className="rounded-[22px] border border-amber-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Carregamento</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Directo pela equipa</p>
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
            { icon: Clock3, title: "Resposta rápida", desc: "Recolha em 24 a 48 horas na maioria das zonas de Lisboa e Setúbal." },
            { icon: Truck, title: "Carregamento directo", desc: "A nossa equipa carrega o entulho — sem espera nem trabalho para si." },
            { icon: Recycle, title: "Destino legal", desc: "Encaminhamento para reciclagem com guia de transporte e destino final." },
          ].map((item) => (
            <div key={item.title} className="rounded-[28px] border border-amber-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(180,83,9,0.12)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* O que recolhemos + Diferenciadores */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[30px] border border-amber-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(180,83,9,0.1)]">
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Tipos de entulho</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {includedItems.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-[18px] border border-amber-100 bg-amber-50/70 p-4 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-[#F4F8FB] p-7">
            <h2 className="mt-3 text-2xl font-bold text-[#0B1929]">Serviço completo de entulho</h2>
            <div className="mt-6 space-y-3">
              {differentiators.map((item) => (
                <div key={item} className="rounded-[18px] border border-[#E2EEF3] bg-white px-4 py-3 text-sm font-medium text-slate-700">
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
            title="Preços de Recolha de Entulho"
            subtitle="Valores orientativos para Lisboa e Setúbal"
            rows={pricingRows}
          />
        </div>
      </section>

      {/* Zonas de cobertura */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Recolha de Entulho por Zona
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-slate-600">
            Clique na sua cidade para ver preços e detalhes específicos.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Lisboa */}
            <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Grande Lisboa</h3>
              <div className="flex flex-wrap gap-2">
                {lisboaCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("recolha-entulho", city.slug)}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-amber-300 hover:bg-amber-50"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Margem Sul */}
            <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
                Margem Sul
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Base CLYON</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {margemSulCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("recolha-entulho", city.slug)}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-amber-300 hover:bg-amber-50"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Setúbal */}
            <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Setúbal</h3>
              <div className="flex flex-wrap gap-2">
                {setubalCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("recolha-entulho", city.slug)}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-amber-300 hover:bg-amber-50"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/areas-de-atuacao" className="inline-flex items-center gap-2 text-amber-600 transition-colors hover:text-amber-700">
              Ver todas as áreas de atuação
            </Link>
          </div>
        </div>
      </section>

      {/* Links principais */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-[30px] border border-amber-100 bg-amber-50/50 p-7">
          <h2 className="text-2xl font-bold text-slate-950">Páginas mais procuradas</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {keyCities.slice(0, 8).map((city) => (
              <Link
                key={city.slug}
                href={`/${getCityServiceSlug("recolha-entulho", city.slug)}`}
                className="rounded-[20px] border border-amber-100 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-amber-700">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-semibold uppercase tracking-wide">{city.regionLabel}</span>
                </div>
                <h3 className="mt-2 font-bold text-slate-900">Entulho em {city.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50">
        <FAQSection title="Perguntas sobre Recolha de Entulho" faqs={faqs} includeSchema={false} />
      </section>

      {/* CTA Final */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Precisa de recolher entulho?"
            description="Peça um orçamento grátis. A equipa chega em 24h, carrega o entulho e encaminha para destino responsável."
            whatsappMessage="Olá! Preciso de recolha de entulho. Podem dar-me um orçamento?"
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </div>
  );
}
