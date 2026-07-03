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
  Sofa,
  Truck,
  Users,
} from "lucide-react";

import Breadcrumb from "@/components/Breadcrumb";
import FurnitureSeoLinks from "@/components/FurnitureSeoLinks";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  SITE_URL,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Recolha de Sofás em Lisboa, Margem Sul e Setúbal | CLYON",
  description:
    "Recolha de sofás usados, sofás velhos, chaise longues e cadeirões em Lisboa, Margem Sul e Setúbal. Carregamento porta a porta, transporte e destino responsável. Peça orçamento.",
  keywords: [
    "recolha de sofá lisboa",
    "recolha de sofás",
    "recolha de sofás usados",
    "retirar sofá velho",
    "levar sofá usado",
    "remoção de sofá",
    "recolha de chaise longue",
    "recolha de cadeirão",
  ],
  alternates: {
    canonical: `${SITE_URL}/recolha-de-sofas`,
  },
  openGraph: {
    title: "Recolha de Sofás em Lisboa, Margem Sul e Setúbal",
    description:
      "Recolha de sofás usados com carregamento porta a porta, transporte e encaminhamento responsável.",
    url: `${SITE_URL}/recolha-de-sofas`,
    locale: "pt_PT",
    type: "website",
  },
};

const areaServedCities = [
  "Lisboa", "Amadora", "Sintra", "Oeiras", "Cascais", "Almada", "Seixal", "Barreiro", "Setúbal",
];

const benefits = [
  { icon: Clock3, title: "Resposta rápida", desc: "Orçamento em minutos, recolha em 24-48h quando disponível" },
  { icon: Users, title: "Carregamento completo", desc: "A equipa retira o sofá do interior do imóvel" },
  { icon: Truck, title: "Transporte incluído", desc: "Levamos o sofá até ao destino adequado" },
  { icon: Recycle, title: "Destino responsável", desc: "Triagem, doação ou encaminhamento correto" },
];

const includedItems = [
  "Sofás de 2, 3 ou mais lugares",
  "Chaise longues e sofás com chaise",
  "Sofás-cama e sofás reclináreis",
  "Cadeirões e poltronas",
  "Pufes e bancos estofados",
  "Sofás de canto e modulares",
];

const pricingFactors = [
  "Tamanho e peso do sofá",
  "Tipo de acesso (escadas, elevador, portas estreitas)",
  "Andar do imóvel",
  "Necessidade de manobras especiais",
  "Distância e localização",
  "Urgência do pedido",
];

const faqs = [
  {
    q: "Quanto custa a recolha de um sofá?",
    a: "O preço da recolha de sofá depende do tamanho, peso, tipo de acesso e localização. A forma mais rápida de saber o valor é enviar fotos do sofá e a morada para receber um orçamento imediato.",
  },
  {
    q: "Recolhem sofás no mesmo dia?",
    a: "Sim. Quando há disponibilidade operacional, a recolha de sofás pode ser feita no próprio dia ou no dia seguinte, especialmente em Lisboa, Amadora, Sintra, Oeiras, Cascais, Almada e Setúbal.",
  },
  {
    q: "Recolhem o sofá de dentro do apartamento?",
    a: "Sim. A equipa da CLYON retira o sofá do interior do imóvel, incluindo apartamentos sem elevador ou com escadas estreitas. É carregamento porta a porta.",
  },
  {
    q: "Recolhem chaise longues e sofás de canto?",
    a: "Sim. Recolhemos chaise longues, sofás de canto, sofás modulares e qualquer tipo de sofá, independentemente do tamanho ou formato.",
  },
  {
    q: "O que acontece ao sofá depois da recolha?",
    a: "Sempre que o estado do sofá permite, fazemos triagem para doação ou reaproveitamento. Sofás danificados ou sem condições seguem para encaminhamento responsável.",
  },
  {
    q: "Qual a diferença entre a CLYON e deixar o sofá na rua?",
    a: "Deixar o sofá na rua pode resultar em multa e demora na recolha municipal. A CLYON oferece recolha imediata, carregamento do interior do imóvel e destino legal garantido.",
  },
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: BUSINESS_NAME, item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Serviços", item: `${SITE_URL}/servicos` },
    { "@type": "ListItem", position: 3, name: "Recolha de Móveis", item: `${SITE_URL}/recolha-de-moveis` },
    { "@type": "ListItem", position: 4, name: "Recolha de Sofás", item: `${SITE_URL}/recolha-de-sofas` },
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
  name: "Recolha de Sofás",
  serviceType: "Recolha de sofás usados",
  url: `${SITE_URL}/recolha-de-sofas`,
  description: "Serviço de recolha de sofás usados com carregamento porta a porta, transporte e encaminhamento responsável em Lisboa, Margem Sul e Setúbal.",
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

export default function RecolhaDeSofasPage() {
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
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-10 lg:px-8 lg:pb-20 lg:pt-14">
          <Breadcrumb
            items={[
              { label: "Serviços", href: "/servicos" },
              { label: "Recolha de Móveis", href: "/recolha-de-moveis" },
              { label: "Recolha de Sofás" },
            ]}
          />

          <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Recolha de sofás em Lisboa, Margem Sul e Setúbal
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Precisa de retirar um sofá velho, uma chaise longue ou um cadeirão? A CLYON faz a <strong>recolha de sofás usados</strong> com carregamento do interior do imóvel, transporte e destino responsável. Atendemos pedidos em <strong>Lisboa, Amadora, Sintra, Oeiras, Cascais, Almada, Seixal, Barreiro e Setúbal</strong>.
              </p>
              <p className="mt-4 text-base leading-7 text-slate-600">
                A recolha de sofá Lisboa é um dos serviços mais pedidos à CLYON. Muitos clientes precisam de libertar espaço rapidamente por mudança, renovação ou venda de casa. Nós tratamos de tudo: entramos no imóvel, carregamos o sofá e levamos para destino adequado.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-cyan-700"
                >
                  Simular orçamento
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={`tel:${BUSINESS_PHONE}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Phone className="h-4 w-4" />
                  Ligar agora
                </a>
                <a
                  href="https://wa.me/351965785395?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20sof%C3%A1."
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
                  <Sofa className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Recolha de Sofás</p>
                  <p className="text-sm text-slate-500">Serviço completo porta a porta</p>
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
            Que tipos de sofás recolhemos?
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            A CLYON recolhe qualquer tipo de sofá, independentemente do tamanho, formato ou estado de conservação. Se está a pensar em como se livrar de um sofá velho, nós tratamos de tudo.
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
            Como funciona a recolha de sofás
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Envia fotos ou descrição", desc: "Envia fotos do sofá, morada e indica o andar, elevador e tipo de acesso." },
              { step: "02", title: "Recebe orçamento", desc: "Recebe uma resposta rápida com valor fechado e janela de recolha disponível." },
              { step: "03", title: "Agendamos a recolha", desc: "Confirmamos o dia e a hora. Muitos pedidos são atendidos em 24-48 horas." },
              { step: "04", title: "Fazemos a recolha", desc: "A equipa entra no imóvel, carrega o sofá, transporta e encaminha para destino responsável." },
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
            Quanto custa a recolha de um sofá?
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            O preço da recolha de sofá não é fixo. Depende de vários factores que influenciam o trabalho necessário. A melhor forma de saber o valor exacto é pedir um orçamento com fotos e morada.
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
                Simular orçamento para recolha de sofá
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Perguntas frequentes sobre recolha de sofás
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
          <FurnitureSeoLinks currentPage="/recolha-de-sofas" variant="grid" />
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-cyan-600 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Precisa de recolha de sofá?
          </h2>
          <p className="mt-4 text-lg text-cyan-100">
            Envie fotos e morada para receber um orçamento rápido. A equipa CLYON trata de tudo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/simulador"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-cyan-600 transition hover:bg-cyan-50"
            >
              Simular orçamento
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://wa.me/351965785395?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20sof%C3%A1."
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
