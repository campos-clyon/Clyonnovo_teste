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
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CITIES,
  SITE_URL,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Recolha de Monos em Lisboa — Volumosos e Móveis Antigos | CLYON",
  description:
    "Recolha de monos em Lisboa, Margem Sul e Setúbal: sofás velhos, colchões, eletrodomésticos, móveis danificados e volumes grandes. Alternativa rápida à recolha municipal. Preços desde 50€. Orçamento grátis em 24h.",
  keywords: [
    "recolha de monos",
    "recolha de monos Lisboa",
    "recolha de volumosos",
    "recolha de objetos volumosos",
    "recolha de monos Amadora",
    "recolha de monos Almada",
    "recolha municipal de monos",
    "recolha de volumosos Lisboa",
    "levar monos",
    "remoção de volumosos",
  ],
  alternates: { canonical: `${SITE_URL}/recolha-de-monos` },
  openGraph: {
    title: "Recolha de Monos em Lisboa — Volumosos e Móveis Antigos | CLYON",
    description:
      "Recolha de monos e volumes grandes em Lisboa e Setúbal. Alternativa rápida à recolha municipal. Desde 50€. Resposta em 24h.",
    url: `${SITE_URL}/recolha-de-monos`,
  },
};

const keyCities = ["lisboa", "almada", "seixal", "setubal", "sintra", "cascais", "oeiras", "amadora"]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

const faqs = [
  {
    question: "O que são monos?",
    answer: "Monos são objetos volumosos que já não têm utilidade: móveis velhos, colchões usados, eletrodomésticos avariados, bicicletas partidas, estantes, cadeiras e outros volumes grandes que ocupam espaço em casa ou garagem.",
  },
  {
    question: "Quanto custa a recolha de monos?",
    answer: "O preço depende da quantidade e do tipo de materiais. Para pequenas quantidades, a recolha pode começar nos 60€. Envie fotos para um orçamento preciso e rápido.",
  },
  {
    question: "Recolhem monos em apartamentos sem elevador?",
    answer: "Sim, a nossa equipa faz o carregamento mesmo em andares altos ou com acessos difíceis. O transporte está incluído no serviço.",
  },
  {
    question: "Fazem recolha de monos no mesmo dia?",
    answer: "Sempre que possível, sim. Na maioria das zonas de Lisboa e Setúbal conseguimos fazer a recolha em 24 a 48 horas. Em situações urgentes, podemos ir no mesmo dia.",
  },
  {
    question: "Que tipo de monos não recolhem?",
    answer: "Não recolhemos materiais perigosos, produtos químicos, amianto, resíduos hospitalares ou lixo doméstico comum. Para estes casos, contacte os serviços municipais.",
  },
];

const includedItems = [
  "Móveis velhos e danificados",
  "Colchões e bases de cama",
  "Eletrodomésticos avariados",
  "Estantes, prateleiras e armários",
  "Bicicletas, carrinhos e trotinetes",
  "Objetos de jardim e varandas",
  "Malas, caixas e arcas",
  "Cadeiras, sofás rasgados e puffs",
];

const differentiators = [
  "Recolha de monos em 24 a 48 horas na maioria das zonas",
  "Carregamento directo pela nossa equipa",
  "Sem necessidade de descer os objetos à rua",
  "Encaminhamento para reciclagem quando possível",
  "Equipa preparada para acessos difíceis",
  "Cobertura em Lisboa, Margem Sul e Setúbal",
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Recolha de Monos",
  description: "Serviço de recolha de monos e volumes grandes em Lisboa, Margem Sul e Setúbal.",
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
      price: "60",
      priceCurrency: "EUR",
      minPrice: "60",
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

export default function RecolhaMonosPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-violet-50/50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.15),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(124,58,237,0.10),_transparent_32%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
            <div className="max-w-3xl">
              <h1 className="mt-5 max-w-[18ch] text-4xl font-bold tracking-tight text-slate-950 md:text-5xl lg:text-6xl">
                Recolha de Monos em Lisboa e Setúbal
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Livre-se de objetos volumosos que já não usa. Recolhemos móveis velhos, colchões, 
                eletrodomésticos avariados e outros monos com carregamento directo.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-base font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Pedir Orçamento Grátis
                </Link>
                <a
                  href={`tel:${BUSINESS_PHONE}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-900 transition-all hover:bg-slate-50"
                >
                  <Phone className="h-4 w-4" />
                  <span>Ligar Agora</span>
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Preços desde <span className="font-semibold text-violet-600">60€</span> para pequenas recolhas
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white p-6 shadow-xl">
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-950">Resposta em</p>
                  <p className="mt-2 text-2xl font-bold text-violet-600">24 horas</p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Carregamento</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Incluído no serviço</p>
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
            { icon: Truck, title: "Carregamento incluído", desc: "A nossa equipa carrega os monos — não precisa de os descer à rua." },
            { icon: Recycle, title: "Destino responsável", desc: "Encaminhamento para reciclagem sempre que possível." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
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
          <div className="rounded-3xl border border-violet-100 bg-white p-7 shadow-sm">
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Tipos de monos</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {includedItems.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 p-4 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-violet-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-[#F4F8FB] p-7">
            <h2 className="mt-3 text-2xl font-bold text-[#0B1929]">Serviço completo de monos</h2>
            <div className="mt-6 space-y-3">
              {differentiators.map((item) => (
                <div key={item} className="rounded-xl border border-[#E2EEF3] bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Zonas de cobertura */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Recolha de Monos por Zona
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-slate-600">
            Cobrimos Lisboa, Margem Sul e Setúbal com resposta rápida.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {keyCities.map((city) => (
              <div
                key={city.slug}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
              >
                <MapPin className="h-4 w-4 text-violet-500" />
                {city.name}
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/areas-de-atuacao" className="inline-flex items-center gap-2 text-violet-600 transition-colors hover:text-violet-700">
              Ver todas as áreas de atuação
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <FAQSection title="Perguntas sobre Recolha de Monos" faqs={faqs} includeSchema={false} />
      </section>

      {/* CTA Final */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Precisa de recolher monos?"
            description="Envie fotos e morada para receber um orçamento rápido. A equipa chega em 24h e trata de tudo."
            whatsappMessage="Olá! Preciso de recolha de monos. Podem dar-me um orçamento?"
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </div>
  );
}
