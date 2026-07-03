import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  TreePine,
  MapPin,
  Phone,
  Recycle,
  Truck,
  Leaf,
} from "lucide-react";

import CTABlock from "@/components/CTABlock";
import FAQSection from "@/components/service/FAQSection";
import TrustBadges from "@/components/TrustBadges";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CITIES,
  SITE_URL,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Limpeza de Quintais em Lisboa e Setúbal — Resposta em 24h | CLYON",
  description:
    "Limpeza de quintais, jardins e espaços exteriores em Lisboa, Margem Sul e Setúbal. Recolha de lixo verde, entulho e resíduos. Orçamento grátis em 24h!",
  alternates: { canonical: `${SITE_URL}/limpeza-de-quintais` },
  openGraph: {
    title: "Limpeza de Quintais em Lisboa e Setúbal — Resposta em 24h | CLYON",
    description:
      "Limpeza de quintais e jardins. Recolha de lixo verde e resíduos exteriores em Lisboa e Setúbal.",
    url: `${SITE_URL}/limpeza-de-quintais`,
  },
};

const keyCities = ["lisboa", "almada", "seixal", "setubal", "sintra", "cascais", "oeiras", "amadora"]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

const faqs = [
  {
    question: "Que tipo de resíduos recolhem nos quintais?",
    answer: "Recolhemos lixo verde (ramos, folhas, relva), móveis de jardim velhos, entulho de pequenas obras exteriores, vasos partidos, ferramentas avariadas e outros materiais acumulados em quintais e jardins.",
  },
  {
    question: "Quanto custa a limpeza de um quintal?",
    answer: "O preço depende do tamanho do quintal e da quantidade de resíduos. Para pequenos quintais, a limpeza pode começar nos 80€. Envie fotos para um orçamento preciso.",
  },
  {
    question: "Fazem poda de árvores?",
    answer: "Não fazemos serviços de jardinagem ou poda. O nosso foco é a recolha e remoção dos resíduos já existentes. Se precisar de poda, recomendamos contratar um jardineiro e depois chamar-nos para recolher os resíduos.",
  },
  {
    question: "Recolhem lixo verde de grandes dimensões?",
    answer: "Sim, recolhemos troncos, ramos grandes, sebes cortadas e outros resíduos verdes volumosos. A nossa carrinha e equipa estão preparadas para cargas de grande volume.",
  },
  {
    question: "Em quanto tempo fazem a limpeza?",
    answer: "Na maioria das zonas de Lisboa e Setúbal conseguimos fazer a recolha em 24 a 48 horas. O tempo no local depende da quantidade de material a recolher.",
  },
];

const includedItems = [
  "Ramos, folhas e relva cortada",
  "Troncos e sebes",
  "Móveis de jardim velhos",
  "Vasos e floreiras partidas",
  "Entulho de pequenas obras",
  "Ferramentas avariadas",
  "Resíduos de limpeza exterior",
  "Objetos acumulados no quintal",
];

const differentiators = [
  "Recolha em 24 a 48 horas na maioria das zonas",
  "Carregamento directo pela nossa equipa",
  "Limpeza de quintais, pátios e varandas grandes",
  "Encaminhamento para reciclagem quando possível",
  "Equipa preparada para acessos difíceis",
  "Cobertura em Lisboa, Margem Sul e Setúbal",
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Limpeza de Quintais",
  description: "Serviço de limpeza de quintais e recolha de lixo verde em Lisboa, Margem Sul e Setúbal.",
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
      price: "80",
      priceCurrency: "EUR",
      minPrice: "80",
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

export default function LimpezaQuintaisPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-50 via-green-50/50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.15),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(22,163,74,0.10),_transparent_32%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-green-700 shadow-sm">
                <TreePine className="h-4 w-4" />
                Limpeza de quintais
              </div>
              <h1 className="mt-5 max-w-[18ch] text-4xl font-bold tracking-tight text-slate-950 md:text-5xl lg:text-6xl">
                Limpeza de Quintais em Lisboa e Setúbal
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Limpe o seu quintal ou jardim sem preocupações. Recolhemos lixo verde, 
                entulho, móveis de exterior e outros resíduos acumulados.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-green-600 px-6 text-base font-semibold text-white shadow-lg shadow-green-600/25 transition-all hover:-translate-y-0.5 hover:bg-green-700"
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
                Preços desde <span className="font-semibold text-green-600">80€</span> para pequenos quintais
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-green-100 bg-white p-6 shadow-xl">
              <TrustBadges variant="grid" />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-green-100 bg-green-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-950">Resposta em</p>
                  <p className="mt-2 text-2xl font-bold text-green-600">24 horas</p>
                </div>
                <div className="rounded-2xl border border-green-100 bg-white p-4">
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
            { icon: Truck, title: "Carregamento incluído", desc: "A nossa equipa carrega todos os resíduos — não precisa de os preparar." },
            { icon: Leaf, title: "Lixo verde aceite", desc: "Ramos, folhas, relva, troncos e outros resíduos de jardim." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
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
          <div className="rounded-3xl border border-green-100 bg-white p-7 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-green-700">O que recolhemos</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Resíduos de quintal</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {includedItems.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50/70 p-4 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-7 text-white">
            <p className="text-sm font-semibold uppercase tracking-wider text-green-300">Porquê a CLYON</p>
            <h2 className="mt-3 text-2xl font-bold">Limpeza completa de quintais</h2>
            <div className="mt-6 space-y-3">
              {differentiators.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100">
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
            Limpeza de Quintais por Zona
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
                <MapPin className="h-4 w-4 text-green-500" />
                {city.name}
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/areas-de-atuacao" className="inline-flex items-center gap-2 text-green-600 transition-colors hover:text-green-700">
              Ver todas as áreas de atuação
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <FAQSection title="Perguntas sobre Limpeza de Quintais" faqs={faqs} includeSchema={false} />
      </section>

      {/* CTA Final */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Precisa de limpar o quintal?"
            description="Envie fotos e morada para receber um orçamento rápido. A equipa chega em 24h e trata de tudo."
            whatsappMessage="Olá! Preciso de limpeza de quintal. Podem dar-me um orçamento?"
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </div>
  );
}
