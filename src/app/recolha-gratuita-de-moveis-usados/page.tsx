import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Shield,
  Truck,
  Users,
  AlertCircle,
  Building2,
  Heart,
} from "lucide-react";

import FurnitureSeoLinks from "@/components/FurnitureSeoLinks";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  SITE_URL,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Recolha Gratuita de Móveis Usados: Quando é Possível e Quando Escolher a CLYON",
  description:
    "Recolha gratuita de móveis usados existe? Sim, através de doação ou recolha municipal. Mas quando precisa de rapidez, desmontagem ou carregamento completo, a CLYON é a solução.",
  keywords: [
    "recolha gratuita de móveis usados",
    "recolha de móveis grátis",
    "onde doar móveis usados",
    "recolha municipal de móveis",
    "como desfazer de móveis velhos",
    "recolha de móveis lisboa",
    "levar móveis usados",
  ],
  alternates: {
    canonical: `${SITE_URL}/recolha-gratuita-de-moveis-usados`,
  },
  openGraph: {
    title: "Recolha Gratuita de Móveis Usados: Quando é Possível e Quando Escolher a CLYON",
    description:
      "Guia completo sobre recolha gratuita de móveis usados em Portugal. Quando a opção gratuita resolve e quando faz sentido contratar um serviço profissional.",
    url: `${SITE_URL}/recolha-gratuita-de-moveis-usados`,
    locale: "pt_PT",
    type: "website",
  },
};

const areaServedCities = [
  "Lisboa", "Amadora", "Sintra", "Oeiras", "Cascais", "Almada", "Seixal", "Barreiro", "Setúbal",
];

const freeOptions = [
  {
    icon: Building2,
    title: "Recolha municipal",
    desc: "As câmaras municipais oferecem recolha gratuita de monos e móveis volumosos, mas com agendamento prévio, horários limitados e sem entrada no imóvel.",
  },
  {
    icon: Heart,
    title: "Doação a instituições",
    desc: "Instituições de solidariedade aceitam móveis em bom estado, mas exigem que estejam limpos, funcionais e, muitas vezes, que o cliente os entregue ou prepare para recolha.",
  },
  {
    icon: Users,
    title: "Venda ou doação online",
    desc: "Plataformas como OLX ou Facebook permitem vender ou doar móveis, mas o cliente tem de esperar por interessados e coordenar a recolha com terceiros.",
  },
];

const whenClyonMakesSense = [
  "Precisa de desmontagem de armários, camas ou roupeiros",
  "O móvel está num andar alto ou sem elevador",
  "Quer recolha no mesmo dia ou em 24-48 horas",
  "Precisa de carregamento do interior do imóvel",
  "Não quer deixar móveis na rua ou no passeio",
  "Tem vários móveis para recolher de uma só vez",
  "Está a fazer mudança, venda de casa ou herança",
  "O móvel está em mau estado e não serve para doação",
];

const faqs = [
  {
    q: "A CLYON faz recolha gratuita de móveis usados?",
    a: "Não. A CLYON é um serviço privado e pago. Oferecemos rapidez, desmontagem, carregamento completo do interior do imóvel e destino responsável. Se procura uma opção gratuita, considere a recolha municipal ou doação a instituições.",
  },
  {
    q: "Quando faz sentido usar a recolha municipal?",
    a: "A recolha municipal é indicada quando não tem pressa, consegue colocar os móveis no exterior do imóvel e o volume está dentro dos limites permitidos. Costuma ter agendamento com vários dias de espera.",
  },
  {
    q: "Posso doar móveis usados a instituições?",
    a: "Sim, desde que os móveis estejam em bom estado, limpos e funcionais. Muitas instituições pedem que o cliente entregue os móveis no local ou aguarde disponibilidade para recolha.",
  },
  {
    q: "Qual a vantagem de contratar a CLYON?",
    a: "A CLYON entra no imóvel, desmonta quando necessário, carrega, transporta e encaminha os móveis para destino responsável. Resposta rápida, geralmente em 24-48 horas, sem precisar de deixar nada na rua.",
  },
  {
    q: "A CLYON recolhe móveis em mau estado?",
    a: "Sim. Recolhemos móveis em qualquer estado, incluindo peças danificadas, húmidas ou inutilizáveis. O encaminhamento é feito de forma responsável, mesmo quando não é possível doar ou reaproveitar.",
  },
  {
    q: "Quanto custa a recolha de móveis com a CLYON?",
    a: "O preço depende do volume, acessos, necessidade de desmontagem e localização. A forma mais rápida de saber o valor é enviar fotos e morada para receber um orçamento imediato.",
  },
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: BUSINESS_NAME, item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Serviços", item: `${SITE_URL}/servicos` },
    { "@type": "ListItem", position: 3, name: "Recolha de Móveis", item: `${SITE_URL}/recolha-de-moveis` },
    { "@type": "ListItem", position: 4, name: "Recolha Gratuita de Móveis Usados", item: `${SITE_URL}/recolha-gratuita-de-moveis-usados` },
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
  name: "Recolha de Móveis Usados",
  serviceType: "Recolha de móveis usados",
  url: `${SITE_URL}/recolha-gratuita-de-moveis-usados`,
  description: "Serviço de recolha de móveis usados com desmontagem, carregamento porta a porta e encaminhamento responsável em Lisboa, Margem Sul e Setúbal. Serviço pago, rápido e completo.",
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

export default function RecolhaGratuitaDeMoveisUsadosPage() {
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
          <div className="mt-8 max-w-4xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Recolha gratuita de móveis usados: quando é possível e quando escolher a CLYON
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              A pesquisa por <strong>recolha gratuita de móveis usados</strong> é muito comum em Portugal. E sim, existem opções gratuitas: a recolha municipal, a doação a instituições ou a venda/doação online. Mas quando precisa de <strong>rapidez, desmontagem, carregamento do interior do imóvel ou remoção urgente</strong>, a recolha privada é a solução mais eficaz.
            </p>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Neste guia, explicamos quando a recolha gratuita funciona, quais são as suas limitações, e quando faz sentido contratar um serviço profissional como a CLYON.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/simulador"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-cyan-700"
              >
                Simular orçamento CLYON
              </Link>
              <a
                href={`tel:${BUSINESS_PHONE}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Phone className="h-4 w-4" />
                Ligar agora
              </a>
              <a
                href="https://wa.me/351965785395?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20m%C3%B3veis."
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
        </div>
        <div className="border-t border-slate-200" />
      </section>

      {/* Opções gratuitas */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Opções de recolha gratuita de móveis usados
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            Existem formas de se desfazer de móveis usados sem pagar, mas todas têm limitações importantes que deve conhecer.
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {freeOptions.map((option) => (
              <div key={option.title} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <option.icon className="h-8 w-8 text-cyan-600" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{option.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{option.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Limitações da recolha gratuita */}
      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-amber-500" />
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Limitações da recolha gratuita
              </h2>
            </div>
            <p className="mt-4 text-base text-slate-600">
              A recolha gratuita de móveis usados funciona bem em algumas situações, mas tem limitações importantes:
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Agendamento com vários dias ou semanas de espera",
                "Horários restritos e pouca flexibilidade",
                "Volume máximo limitado (geralmente poucos itens por vez)",
                "Sem desmontagem: o cliente tem de preparar os móveis",
                "Sem entrada no imóvel: os móveis têm de estar no exterior",
                "Sem garantia de destino responsável em todos os casos",
                "Recolha municipal não cobre todas as localidades",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Quando a CLYON faz sentido */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Quando faz sentido contratar a CLYON?
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            A CLYON é um serviço privado e pago. Não fazemos recolha gratuita. Mas quando precisa de um serviço completo, rápido e sem complicações, somos a solução indicada.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {whenClyonMakesSense.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-600" />
                <span className="text-sm font-medium text-slate-700">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-cyan-200 bg-cyan-50 p-6">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-6 w-6 text-cyan-600" />
              <div>
                <p className="font-semibold text-slate-900">
                  A diferença principal
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Na recolha gratuita ou municipal, o cliente tem de colocar os móveis no exterior e aguardar. Na recolha privada CLYON, a equipa entra no imóvel, desmonta o necessário e resolve tudo num só pedido, geralmente em 24-48 horas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona a CLYON */}
      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Como funciona a recolha de móveis com a CLYON
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Envia fotos ou descrição", desc: "Envia fotos dos móveis, morada e indica acessos, andar e elevador." },
              { step: "02", title: "Recebe orçamento", desc: "Recebe uma resposta rápida com valor fechado e janela de recolha disponível." },
              { step: "03", title: "Agendamos a recolha", desc: "Confirmamos o dia e a hora. Muitos pedidos são atendidos em 24-48 horas." },
              { step: "04", title: "Fazemos a recolha", desc: "A equipa desmonta, carrega, transporta e encaminha para destino responsável." },
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

      {/* FAQ */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Perguntas frequentes sobre recolha de móveis
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="font-semibold text-slate-900">{faq.q}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal Links */}
      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FurnitureSeoLinks currentPage="/recolha-gratuita-de-moveis-usados" variant="grid" />
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-cyan-600 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Precisa de recolha de móveis rápida e completa?
          </h2>
          <p className="mt-4 text-lg text-cyan-100">
            A CLYON resolve. Envie fotos e morada para receber um orçamento imediato.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/simulador"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-cyan-600 transition hover:bg-cyan-50"
            >
              Simular orçamento
            </Link>
            <a
              href="https://wa.me/351965785395?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20m%C3%B3veis."
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
