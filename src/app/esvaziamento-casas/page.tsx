import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Home,
  MapPin,
  Package,
  Phone,
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
  title: "Esvaziamento de Casas em Lisboa e Setúbal | Heranças e Recheios",
  description:
    "Esvaziamento completo de casas, apartamentos e heranças em Lisboa e Setúbal. Removemos tudo: móveis, eletrodomésticos, roupas e objetos. Preços desde 350EUR.",
  alternates: { canonical: `${SITE_URL}/esvaziamento-casas` },
  openGraph: {
    title: "Esvaziamento de Casas e Heranças em Lisboa e Setúbal",
    description:
      "Esvaziamento completo de casas e heranças. Preços desde 350EUR em Lisboa e Setúbal.",
    url: `${SITE_URL}/esvaziamento-casas`,
  },
};

const keyCities = ["lisboa", "almada", "seixal", "setubal", "sintra", "cascais", "oeiras", "amadora"]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

const pricingRows = [
  { service: "Esvaziamento T0/T1", priceFrom: "350€", priceTo: "550€", description: "Apartamento pequeno até 60m²" },
  { service: "Esvaziamento T2", priceFrom: "450€", priceTo: "700€", description: "Apartamento até 90m²" },
  { service: "Esvaziamento T3/T4", priceFrom: "600€", priceTo: "1000€", description: "Apartamento grande 90-150m²" },
  { service: "Esvaziamento moradia", priceFrom: "800€", priceTo: "1500€", description: "Moradia completa com garagem/cave" },
  { service: "Esvaziamento arrecadação/cave", priceFrom: "150€", priceTo: "400€", description: "Espaços de arrumação" },
  { service: "Esvaziamento loja/escritório", priceFrom: "400€", priceTo: "900€", description: "Espaços comerciais" },
];

const faqs = [
  {
    question: "O que inclui o esvaziamento de casa?",
    answer: "Retiramos absolutamente tudo: móveis, eletrodomésticos, roupas, objetos pessoais, decoração, livros, loiças e qualquer outro conteúdo. Deixamos o espaço vazio, pronto para obras, venda ou arrendamento.",
  },
  {
    question: "Também fazem esvaziamento de heranças?",
    answer: "Sim, especializamo-nos em esvaziamento de heranças. Tratamos de todo o processo com sensibilidade e cuidado. Podemos separar objetos de valor que a família queira guardar antes de esvaziar o resto.",
  },
  {
    question: "O que acontece aos objetos retirados?",
    answer: "Fazemos triagem: objetos em bom estado vão para doação ou reaproveitamento, materiais recicláveis são separados, e o restante é encaminhado para destino final adequado.",
  },
  {
    question: "Quanto tempo demora um esvaziamento?",
    answer: "Um T1/T2 demora geralmente meio dia. Apartamentos maiores ou moradias podem demorar um dia completo. Heranças acumuladas podem requerer mais tempo.",
  },
  {
    question: "Precisam que eu esteja presente?",
    answer: "Não é obrigatório. Basta entregar as chaves no início e recolhê-las no final. Se preferir acompanhar, também é possível.",
  },
  {
    question: "Podem separar objetos antes de esvaziar?",
    answer: "Sim. Podemos separar documentos, fotografias, objetos de valor sentimental ou qualquer item que queira guardar antes de proceder ao esvaziamento.",
  },
];

const includedServices = [
  "Remoção de todos os móveis e eletrodomésticos",
  "Retirada de roupas, objetos e decoração",
  "Desmontagem de armários e camas",
  "Limpeza básica do espaço no final",
  "Triagem para doação e reciclagem",
  "Encaminhamento legal de todos os materiais",
];

const differentiators = [
  "Serviço porta-a-porta: não precisa de carregar nada",
  "Desmontagem de móveis incluída no preço",
  "Triagem cuidada para separar objetos de valor",
  "Ideal para heranças, mudanças e renovações",
  "Podemos combinar com limpeza pós-esvaziamento",
  "Cobertura em Lisboa, Margem Sul e Setúbal",
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Esvaziamento de Casas",
  description: "Serviço de esvaziamento completo de casas, apartamentos e heranças em Lisboa e Setúbal.",
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
      price: "350",
      priceCurrency: "EUR",
      minPrice: "350",
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

export default function EsvaziamentoCasasPage() {
  const lisboaCities = getCitiesByRegion("lisboa");
  const margemSulCities = getCitiesByRegion("margem-sul");
  const setubalCities = getCitiesByRegion("setubal");

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-violet-50/50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.15),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(124,58,237,0.1),_transparent_32%)]" />
<div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
  <Breadcrumb
    items={[
      { label: "Serviços", href: "/servicos" },
      { label: "Esvaziamento de Casas" },
    ]}
    className="mb-6"
  />
  <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
  <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-violet-700 shadow-sm">
                <Home className="h-4 w-4" />
                Esvaziamento de casas em Lisboa e Setúbal
              </div>
              <h1 className="mt-5 max-w-[16ch] text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
                Esvaziamento Completo de Casas e Heranças
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Esvaziamos apartamentos, moradias, heranças e espaços comerciais.
                Retiramos tudo: móveis, eletrodomésticos, roupas, objetos e decoração.
                Deixamos o espaço pronto para obras, venda ou arrendamento.
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
                Preços desde <span className="font-semibold text-violet-600">350EUR</span> para T0/T1
              </p>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_24px_60px_-34px_rgba(124,58,237,0.12)]">
              <TrustBadges variant="grid" />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-violet-100 bg-violet-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-950">Orçamento em</p>
                  <p className="mt-2 text-2xl font-bold text-violet-600">24 horas</p>
                </div>
                <div className="rounded-[22px] border border-violet-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Serviço</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Completo porta-a-porta</p>
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
            { icon: Package, title: "Retiramos tudo", desc: "Móveis, eletrodomésticos, roupas, objetos, decoração... não deixamos nada." },
            { icon: Clock3, title: "Rapidez", desc: "Um T2 fica vazio em meio dia. Moradias em 1-2 dias conforme o volume." },
            { icon: Truck, title: "Serviço completo", desc: "Desmontagem, carregamento, transporte e encaminhamento. Você não precisa fazer nada." },
          ].map((item) => (
            <div key={item.title} className="rounded-[28px] border border-violet-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(124,58,237,0.1)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
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
          <div className="rounded-[30px] border border-violet-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(124,58,237,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-700">O que inclui</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Serviço completo</h2>
            <div className="mt-6 grid gap-3">
              {includedServices.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[18px] border border-violet-100 bg-violet-50/70 p-4 text-sm text-slate-700">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-violet-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-slate-950 p-7 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">Porquê a CLYON</p>
            <h2 className="mt-3 text-2xl font-bold">Esvaziamento sem preocupações</h2>
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
            title="Preços de Esvaziamento"
            subtitle="Valores orientativos para Lisboa e Setúbal"
            rows={pricingRows}
            footnote="O preço final depende do volume, acessos (escadas, elevador) e localização."
          />
        </div>
      </section>

      {/* Zonas de cobertura */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Esvaziamento de Casas por Zona
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-slate-600">
            Clique na sua cidade para ver detalhes específicos.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Grande Lisboa</h3>
              <div className="flex flex-wrap gap-2">
                {lisboaCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("esvaziamento-casas", city.slug)}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-violet-300 hover:bg-violet-50"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
                Margem Sul
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Base CLYON</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {margemSulCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("esvaziamento-casas", city.slug)}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-violet-300 hover:bg-violet-50"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Setúbal</h3>
              <div className="flex flex-wrap gap-2">
                {setubalCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${getCityServiceSlug("esvaziamento-casas", city.slug)}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-violet-300 hover:bg-violet-50"
                    style={{ color: '#0f172a' }}
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/areas-de-atuacao" className="inline-flex items-center gap-2 text-violet-600 transition-colors hover:text-violet-700">
              Ver todas as áreas de atuação
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Links principais */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-[30px] border border-violet-100 bg-violet-50/50 p-7">
          <h2 className="text-2xl font-bold text-slate-950">Páginas mais procuradas</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {keyCities.slice(0, 8).map((city) => (
              <Link
                key={city.slug}
                href={`/${getCityServiceSlug("esvaziamento-casas", city.slug)}`}
                className="rounded-[20px] border border-violet-100 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-violet-700">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-semibold uppercase tracking-wide">{city.regionLabel}</span>
                </div>
                <h3 className="mt-2 font-bold text-slate-900">Esvaziamento em {city.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50">
        <FAQSection title="Perguntas sobre Esvaziamento de Casas" faqs={faqs} includeSchema={false} />
      </section>

      {/* CTA Final */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Precisa de esvaziar uma casa?"
            description="Peça um orçamento grátis. Tratamos de tudo do início ao fim."
            whatsappMessage="Olá! Preciso de esvaziar uma casa. Podem dar-me um orçamento?"
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </div>
  );
}
