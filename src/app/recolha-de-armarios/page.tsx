import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Recycle,
  Shield,
  Archive,
  Truck,
  Users,
} from "lucide-react";

import FurnitureSeoLinks from "@/components/FurnitureSeoLinks";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  SITE_URL,
  AVALIACOES_TOTAL,
  NOTA_DE_PRECO,
} from "@/lib/seo-data";
import {
  DESMONTAGEM_A_PEDIDO,
  NO_MESMO_DIA,
  PROPOSTAS_EM_ATE,
  RECEBE_PROPOSTAS,
} from "@/lib/promessas-publicas";
import { PRECOS } from "@/lib/precos-publicos";
import { PRESTADOR, validadeDoPreco } from "@/lib/dados-estruturados";

/*
 * A recolha de armários é recolha de móveis: mesma faixa, mesma fonte.
 *
 * Esta página não mostrava preço nenhum e mesmo assim declarava um ao Google
 * (55 €) — um número que não existe na tabela. Agora o preço está visível
 * na página e é o mesmo que o schema declara, lido de
 * src/lib/precos-publicos.ts.
 */
const PRECO_MOVEIS = PRECOS.recolha_moveis;

export const metadata: Metadata = {
  title: "Recolha de Armários e Roupeiros em Lisboa",
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description:
    "Recolha de armários, roupeiros, cómodas e aparadores em Lisboa, Margem Sul e Setúbal. Desmontagem, carregamento porta a porta e destino responsável.",
  keywords: [
    "recolha de armários usados",
    "recolha de armários",
    "recolha de roupeiros",
    "retirar armário velho",
    "levar armário usado",
    "recolha de cómoda",
    "remoção de armário",
    "desmontagem de armário",
  ],
  alternates: {
    canonical: `${SITE_URL}/recolha-de-armarios`,
  },
  openGraph: og({
    title: "Recolha de Armários Usados em Lisboa, Margem Sul e Setúbal",
    description:
      "Recolha de armários usados com desmontagem, carregamento porta a porta e destino licenciado.",
    url: `${SITE_URL}/recolha-de-armarios`,
  }),
};

const areaServedCities = [
  "Lisboa", "Amadora", "Sintra", "Oeiras", "Cascais", "Almada", "Seixal", "Barreiro", "Setúbal",
];

const benefits = [
  { icon: Clock3, title: `Propostas ${PROPOSTAS_EM_ATE}`, desc: "A data da recolha combina-se com o profissional que escolher" },
  { icon: Users, title: "Desmontagem a pedido", desc: DESMONTAGEM_A_PEDIDO },
  { icon: Truck, title: "Carregamento completo", desc: "Retirada a partir do interior do imóvel" },
  { icon: Recycle, title: "Destino responsável", desc: "Ecocentro ou operador de resíduos licenciado" },
];

const includedItems = [
  "Armários de quarto e roupeiros",
  "Armários de cozinha e despensa",
  "Cómodas, gaveteiros e semanários",
  "Aparadores e cristaleiras",
  "Armários de casa de banho",
  "Estantes e prateleiras grandes",
];

const pricingFactors = [
  "Tamanho e peso do armário",
  "Necessidade de desmontagem",
  "Tipo de acesso (escadas, elevador, portas estreitas)",
  "Andar do imóvel",
  "Material (madeira maciça, aglomerado, etc.)",
  "Distância e localização",
];

const faqs = [
  {
    q: "Quanto custa a recolha de um armário?",
    a: `A recolha de um armário custa ${PRECO_MOVEIS.etiqueta}, consoante o tamanho, a necessidade de desmontagem, os acessos e a localização. São valores orientativos e sem IVA (na proposta, o preço já vem com IVA incluído): a forma mais rápida de fechar o valor é enviar fotos do armário e a morada para receber propostas ${PROPOSTAS_EM_ATE}.`,
  },
  {
    q: "Recolhem armários no mesmo dia?",
    a: NO_MESMO_DIA,
  },
  {
    q: "Os profissionais desmontam os armários?",
    a: `Sim, se o pedir. ${DESMONTAGEM_A_PEDIDO}`,
  },
  {
    q: "Recolhem armários embutidos?",
    a: "Sim, mas a remoção de um armário embutido dá mais trabalho. Envie fotos no pedido, para os profissionais o contarem na proposta.",
  },
  {
    q: "Recolhem roupeiros de correr?",
    a: "Sim. Os profissionais recolhem roupeiros de correr, roupeiros com portas de bater, e qualquer tipo de armário de quarto. A desmontagem pode ser pedida e vem incluída na proposta.",
  },
  {
    q: "O que acontece aos armários recolhidos?",
    // 30-09-2026: prometia «triagem para doação» — não há nada na
    // plataforma que encaminhe peças para doação. Quem as recebe está na
    // página própria, e é para lá que se aponta.
    a: "O profissional leva-o para destino licenciado — ecocentro ou operador de resíduos. Se ainda estiver em bom estado e o quiser doar, a página «Doar móveis usados em Lisboa» diz quem o recebe.",
  },
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: BUSINESS_NAME, item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Serviços", item: `${SITE_URL}/servicos` },
    { "@type": "ListItem", position: 3, name: "Recolha de Móveis", item: `${SITE_URL}/recolha-de-moveis` },
    { "@type": "ListItem", position: 4, name: "Recolha de Armários", item: `${SITE_URL}/recolha-de-armarios` },
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
  name: "Recolha de Armários Usados",
  serviceType: "Recolha de armários e roupeiros usados",
  url: `${SITE_URL}/recolha-de-armarios`,
  description: "Serviço de recolha de armários usados com desmontagem, carregamento porta a porta e destino licenciado em Lisboa, Margem Sul e Setúbal.",
  // O prestador é o LocalBusiness do layout, por @id — e não uma cópia
  // sem morada (ou com uma morada inventada) em cada página (29-09-2026).
  provider: PRESTADOR,
  areaServed: areaServedCities.map((city) => ({ "@type": "City", name: city })),
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "EUR",
    lowPrice: PRECO_MOVEIS.minimo,
    highPrice: PRECO_MOVEIS.maximo,
    // Calculado: a data escrita à mão caducava a 31-12-2026 (29-09-2026).
    priceValidUntil: validadeDoPreco(),
    availability: "https://schema.org/InStock",
  },
};

export const revalidate = 86400;

export default function RecolhaDeArmariosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(serviceSchema) }}
      />

      {/* Hero Section */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-10 lg:px-8 lg:pb-20 lg:pt-14">
          <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Recolha de armários usados em Lisboa, Margem Sul e Setúbal
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Precisa de retirar um armário velho, um roupeiro ou uma cómoda? Pela CLYON, profissionais verificados da sua zona fazem a <strong>recolha de armários usados</strong> com carregamento do interior do imóvel, destino licenciado e desmontagem, se a pedir. Pode pedir em <strong>Lisboa, Amadora, Sintra, Oeiras, Cascais, Almada, Seixal, Barreiro e Setúbal</strong>.
              </p>
              <p className="mt-4 text-base leading-7 text-slate-600">
                A recolha de armários é frequentemente solicitada por quem está a renovar a casa, a fazer uma mudança ou a preparar um imóvel para arrendamento. Armários grandes e pesados exigem desmontagem e manuseamento cuidadoso — diga-o no pedido, para vir incluído na proposta.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-acao px-6 text-base font-semibold text-white shadow-sm transition hover:bg-acao-hover"
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
                  href="https://wa.me/351931632622?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20arm%C3%A1rio."
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
                  <Shield className="h-4 w-4 text-acao" />
                  {AVALIACOES_TOTAL} avaliações 5 estrelas
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-acao" />
                  Lisboa, Margem Sul, Setúbal
                </div>
              </div>
            </div>

            {/* Benefits card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100">
                  <Archive className="h-6 w-6 text-acao" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Recolha de Armários</p>
                  <p className="text-sm text-slate-500">Desmontagem e carregamento incluídos</p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {benefits.map((benefit) => (
                  <div key={benefit.title} className="flex gap-3">
                    <benefit.icon className="mt-0.5 h-5 w-5 shrink-0 text-acao" />
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
            Que tipos de armários se recolhem?
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            Os profissionais recolhem qualquer tipo de armário, incluindo roupeiros, cómodas, aparadores e estantes. Se precisa de libertar espaço, o profissional trata de tudo.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {includedItems.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-acao" />
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
            Como funciona a recolha de armários
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Envie fotos ou uma descrição", desc: "Envie fotos do armário, a morada e indique se precisa de desmontagem." },
              { step: "02", title: "Receba propostas", desc: `Profissionais da zona respondem ${PROPOSTAS_EM_ATE}, cada um com o valor fechado.` },
              { step: "03", title: "Escolha e combine", desc: "Aceita a proposta que preferir e combina o dia e a hora com o profissional." },
              { step: "04", title: "Recolha no local", desc: "O profissional entra no imóvel, carrega, transporta e leva para destino licenciado." },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-slate-200 bg-white p-5">
                <span className="text-sm font-bold text-acao">{item.step}</span>
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
            Quanto custa a recolha de um armário?
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            A recolha de um armário custa, tipicamente, {PRECO_MOVEIS.etiqueta}. O valor depende de vários fatores, e a melhor forma de o saber ao certo é pedir um orçamento com fotos e morada.
          </p>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <p className="font-semibold text-slate-900">Fatores que influenciam o preço:</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pricingFactors.map((factor) => (
                <li key={factor} className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-acao" />
                  {factor}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                href="/simulador"
                className="inline-flex items-center gap-2 text-base font-semibold text-acao hover:text-acao-hover"
              >
                Simular orçamento para recolha de armário
              </Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">{NOTA_DE_PRECO.curta}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Perguntas frequentes sobre recolha de armários
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
          <FurnitureSeoLinks currentPage="/recolha-de-armarios" variant="grid" />
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-acao py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Precisa de recolha de armário?
          </h2>
          <p className="mt-4 text-lg text-cyan-100">
            Envie fotos e morada. {RECEBE_PROPOSTAS}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/simulador"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-acao transition hover:bg-cyan-50"
            >
              Simular orçamento
            </Link>
            <a
              href="https://wa.me/351931632622?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20arm%C3%A1rio."
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
