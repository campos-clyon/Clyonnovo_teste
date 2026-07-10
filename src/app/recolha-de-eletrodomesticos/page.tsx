import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Recycle,
  Shield,
  Refrigerator,
  Truck,
  Users,
} from "lucide-react";

import FurnitureSeoLinks from "@/components/FurnitureSeoLinks";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  SITE_URL,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Recolha de Eletrodomésticos Usados em Lisboa, Margem Sul e Setúbal | CLYON",
  description:
    "Recolha de eletrodomésticos usados: frigoríficos, máquinas de lavar, fogões, micro-ondas e outros equipamentos em Lisboa, Margem Sul e Setúbal. Carregamento e destino responsável.",
  keywords: [
    "recolha de eletrodomésticos usados",
    "recolha de eletrodomésticos",
    "recolha de frigorífico",
    "recolha de máquina de lavar",
    "retirar eletrodoméstico velho",
    "levar frigorífico usado",
    "remoção de eletrodomésticos",
    "recolha de fogão",
  ],
  alternates: {
    canonical: `${SITE_URL}/recolha-de-eletrodomesticos`,
  },
  openGraph: {
    title: "Recolha de Eletrodomésticos Usados em Lisboa, Margem Sul e Setúbal",
    description:
      "Recolha de eletrodomésticos usados com carregamento porta a porta e encaminhamento responsável.",
    url: `${SITE_URL}/recolha-de-eletrodomesticos`,
    locale: "pt_PT",
    type: "website",
  },
};

const areaServedCities = [
  "Lisboa", "Amadora", "Sintra", "Oeiras", "Cascais", "Almada", "Seixal", "Barreiro", "Setúbal",
];

const benefits = [
  { icon: Clock3, title: "Resposta rápida", desc: "Orçamento em minutos, recolha em 24-48h quando disponível" },
  { icon: Users, title: "Carregamento completo", desc: "A equipa retira o eletrodoméstico do interior do imóvel" },
  { icon: Truck, title: "Transporte incluído", desc: "Levamos o equipamento até ao destino adequado" },
  { icon: Recycle, title: "Destino responsável", desc: "Encaminhamento para reciclagem ou reutilização" },
];

const includedItems = [
  "Frigoríficos e combinados",
  "Máquinas de lavar roupa e loiça",
  "Máquinas de secar",
  "Fogões e placas de cozinha",
  "Fornos e micro-ondas",
  "Ar condicionado e aquecedores",
];

const pricingFactors = [
  "Tipo e tamanho do eletrodoméstico",
  "Peso do equipamento",
  "Tipo de acesso (escadas, elevador)",
  "Andar do imóvel",
  "Número de equipamentos",
  "Distância e localização",
];

const faqs = [
  {
    q: "Quanto custa a recolha de um eletrodoméstico?",
    a: "O preço da recolha de eletrodoméstico depende do tipo, peso, acessos e localização. A forma mais rápida de saber o valor é enviar fotos do equipamento e a morada para receber um orçamento imediato.",
  },
  {
    q: "Recolhem frigoríficos e máquinas de lavar?",
    a: "Sim. Recolhemos frigoríficos, máquinas de lavar roupa, máquinas de lavar loiça, máquinas de secar e qualquer eletrodoméstico de grande porte.",
  },
  {
    q: "Recolhem eletrodomésticos no mesmo dia?",
    a: "Sim. Quando há disponibilidade operacional, a recolha pode ser feita no próprio dia ou no dia seguinte, especialmente em Lisboa, Amadora, Sintra, Oeiras, Cascais, Almada e Setúbal.",
  },
  {
    q: "A equipa retira o eletrodoméstico de dentro de casa?",
    a: "Sim. A equipa da CLYON retira o eletrodoméstico do interior do imóvel, incluindo apartamentos sem elevador ou com escadas estreitas. É carregamento porta a porta.",
  },
  {
    q: "Qual o destino dos eletrodomésticos recolhidos?",
    a: "Os eletrodomésticos recolhidos são encaminhados para reciclagem ou reutilização, conforme o estado e tipo de equipamento. Cumprimos a legislação de resíduos elétricos e eletrónicos.",
  },
  {
    q: "Recolhem pequenos eletrodomésticos também?",
    a: "A CLYON foca-se principalmente em grandes eletrodomésticos. Pequenos equipamentos podem ser incluídos quando combinados com uma recolha maior de móveis ou eletrodomésticos grandes.",
  },
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: BUSINESS_NAME, item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Serviços", item: `${SITE_URL}/servicos` },
    { "@type": "ListItem", position: 3, name: "Recolha de Móveis", item: `${SITE_URL}/recolha-de-moveis` },
    { "@type": "ListItem", position: 4, name: "Recolha de Eletrodomésticos", item: `${SITE_URL}/recolha-de-eletrodomesticos` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Recolha de Eletrodomésticos Usados",
  serviceType: "Recolha de eletrodomésticos usados",
  url: `${SITE_URL}/recolha-de-eletrodomesticos`,
  description: "Serviço de recolha de eletrodomésticos usados com carregamento porta a porta e encaminhamento responsável em Lisboa, Margem Sul e Setúbal.",
  provider: {
    "@type": "LocalBusiness",
    name: BUSINESS_NAME,
    telephone: BUSINESS_PHONE,
    url: SITE_URL,
  },
  areaServed: areaServedCities.map((city) => ({ "@type": "City", name: city })),
  offers: {
    "@type": "Offer",
    priceCurrency: "EUR",
    price: "35",
    priceValidUntil: "2026-12-31",
    availability: "https://schema.org/InStock",
  },
};

export const revalidate = 86400;

export default function RecolhaDeEletrodomesticosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />

      {/* Hero Section */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-16 lg:px-8 lg:pb-20 lg:pt-20">

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Recolha de eletrodomésticos usados em Lisboa, Margem Sul e Setúbal
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Precisa de retirar um frigorífico velho, uma máquina de lavar ou um fogão? A CLYON faz a <strong>recolha de eletrodomésticos usados</strong> com carregamento do interior do imóvel, transporte e destino responsável. Atendemos pedidos em <strong>Lisboa, Amadora, Sintra, Oeiras, Cascais, Almada, Seixal, Barreiro e Setúbal</strong>.
              </p>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Eletrodomésticos grandes são pesados e difíceis de transportar. Além disso, exigem encaminhamento adequado por serem resíduos elétricos e eletrónicos. A equipa CLYON trata de tudo: retira do imóvel, carrega, transporta e encaminha para reciclagem ou reutilização.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-cyan-700"
                >
                  Simular orçamento
                </Link>
                <a
                  href={`tel:${BUSINESS_PHONE}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Phone className="h-4 w-4" />
                  Ligar agora
                </a>
                <a
                  href="https://wa.me/351965785395?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20eletrodom%C3%A9stico."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 text-base font-semibold text-white transition hover:bg-emerald-600"
                >
                  WhatsApp
                </a>
              </div>

              {/* Trust indicators */}
              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-cyan-600" />
                  163 avaliações 5 estrelas
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-cyan-600" />
                  Lisboa, Margem Sul, Setúbal
                </div>
              </div>
            </div>

            {/* Benefits card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100">
                  <Refrigerator className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Recolha de Eletrodomésticos</p>
                  <p className="text-sm text-slate-500">Carregamento e destino responsável</p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {benefits.map((benefit) => (
                  <div key={benefit.title} className="flex gap-3">
                    <benefit.icon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
                    <div>
                      <p className="font-medium text-slate-900">{benefit.title}</p>
                      <p className="text-sm text-slate-600">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200" />
      </section>

      {/* O que recolhemos */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Que eletrodomésticos recolhemos?
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            A CLYON recolhe eletrodomésticos de grande porte, incluindo frigoríficos, máquinas de lavar, fogões e outros equipamentos pesados. Se precisa de libertar espaço, tratamos de tudo.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {includedItems.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-600" />
                <span className="text-sm font-medium text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Como funciona a recolha de eletrodomésticos
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Envia fotos ou descrição", desc: "Envia fotos do eletrodoméstico, morada e indica o andar e acessos." },
              { step: "02", title: "Recebe orçamento", desc: "Recebe uma resposta rápida com valor fechado e janela de recolha disponível." },
              { step: "03", title: "Agendamos a recolha", desc: "Confirmamos o dia e a hora. Muitos pedidos são atendidos em 24-48 horas." },
              { step: "04", title: "Fazemos a recolha", desc: "A equipa entra no imóvel, carrega o eletrodoméstico e encaminha para reciclagem." },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-slate-200 bg-white p-5">
                <span className="text-sm font-bold text-cyan-600">{item.step}</span>
                <h3 className="mt-2 font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quanto custa */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Quanto custa a recolha de eletrodomésticos?
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            O preço da recolha de eletrodoméstico depende de vários factores. A melhor forma de saber o valor exacto é pedir um orçamento com fotos e morada.
          </p>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <p className="font-semibold text-slate-900">Factores que influenciam o preço:</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pricingFactors.map((factor) => (
                <li key={factor} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                  {factor}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                href="/simulador"
                className="inline-flex items-center gap-2 text-base font-semibold text-cyan-600 hover:text-cyan-700"
              >
                Simular orçamento para recolha de eletrodoméstico
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Perguntas frequentes sobre recolha de eletrodomésticos
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">{faq.q}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal Links */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FurnitureSeoLinks currentPage="/recolha-de-eletrodomesticos" variant="grid" />
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-cyan-600 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Precisa de recolha de eletrodoméstico?
          </h2>
          <p className="mt-4 text-lg text-cyan-100">
            Envie fotos e morada para receber um orçamento rápido. A equipa CLYON carrega e encaminha.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/simulador"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold transition hover:bg-cyan-50"
              style={{ color: '#0891b2' }}
            >
              Simular orçamento
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold transition hover:bg-slate-100"
              style={{ color: '#0f172a' }}
            >
              <Phone className="h-4 w-4" />
              <span>Ligar Agora</span>
            </a>
            <a
              href="https://wa.me/351965785395?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20eletrodom%C3%A9stico."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 text-base font-semibold text-white transition hover:bg-emerald-600"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
