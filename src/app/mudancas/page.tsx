import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Package,
  Phone,
  Shield,
} from "lucide-react";

import CTABlock from "@/components/CTABlock";
import FAQSection from "@/components/service/FAQSection";
import { getCitiesByRegion } from "@/lib/city-content";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CITIES,
  SITE_URL,
  getCityServiceSlug, AVALIACOES_TOTAL } from "@/lib/seo-data";
import { CIDADES_MUDANCAS } from "@/lib/mudancas-cidades";

export const metadata: Metadata = {
  title: "Mudanças em Lisboa e Setúbal — Rápidas, Seguras, Sem Stress",
  description:
    `Mudanças residenciais e comerciais em Lisboa e Setúbal. Embalagem, carga, transporte e montagem por profissionais verificados. Resposta em 24h, ${AVALIACOES_TOTAL} avaliações 5★ no Google e na Fixando. Orçamento grátis!`,
  alternates: { canonical: `${SITE_URL}/mudancas` },
  openGraph: {
    title: "Mudanças em Lisboa e Setúbal — Profissional e Sem Stress",
    // Dizia "Preços desde 150€". Nos metadados vale a mesma regra do texto
    // visível: a página deixou de anunciar número, os metadados também.
    description:
      "Mudanças rápidas com equipa profissional. Carga, transporte, descarga e montagem. Orçamento personalizado e grátis em 24 horas!",
    url: `${SITE_URL}/mudancas`,
  },
};

const keyCities = ["lisboa", "almada", "seixal", "setubal", "sintra", "cascais", "oeiras", "amadora"]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

/*
 * A grelha de preços das mudanças foi substituída por esta lista sem números.
 *
 * A tabela abria em "150€ - 280€" para um T0/T1. O motor factura a mudança a
 * partir de 490 € — sete horas a 70 €/h —, ou seja, o valor mais visível da
 * página prometia menos de metade do que a factura ia dizer.
 *
 * Não se troca 150 por 490: a mudança não tem um piso que se possa anunciar
 * honestamente sem conhecer o volume e os acessos. O que fica é a tipologia
 * (que ajuda o cliente a reconhecer-se) e o que faz variar o preço.
 */
const tiposDeMudanca = [
  { tipo: "Mudança T0/T1 (até 20m³)", description: "Estúdio ou apartamento pequeno" },
  { tipo: "Mudança T2 (até 40m³)", description: "Apartamento familiar médio" },
  { tipo: "Mudança T3/T4 (até 60m³)", description: "Apartamento ou moradia grande" },
  { tipo: "Mudança de escritório", description: "Depende do volume e equipamento" },
  { tipo: "Transporte avulso (até 3 peças)", description: "Sofá, cama ou armário isolado" },
];

/** O que pesa no orçamento — substitui os números que estavam na grelha. */
const fatoresDePreco = [
  "Volume real a transportar",
  "Andar e existência de elevador",
  "Distância entre as duas moradas",
  "Desmontagem e montagem de móveis",
  "Material de embalagem necessário",
  "Dia e hora (fim de semana tem procura maior)",
];

const faqs = [
  {
    question: "Quanto custa uma mudança em Lisboa?",
    // Respondia "entre 150EUR e 280EUR em média" — e esta resposta vai para o
    // FAQPage do JSON-LD, por isso o número aparecia também no Google. O motor
    // factura a partir de 490 €. Fica a explicação do que faz variar o preço.
    answer: "O preço depende do volume (tamanho do apartamento), da distância entre moradas, da necessidade de desmontagem e montagem e do andar (com ou sem elevador). Por isso não trabalhamos com tabela: fazemos um orçamento personalizado e grátis em 24 horas, fechado antes de o trabalho começar.",
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
  /*
   * Sem bloco `offers` — e sem outro número no lugar dele.
   *
   * Estava aqui um `PriceSpecification` com price e minPrice a "150", o mesmo
   * valor que a página anunciava e que o motor não pratica (factura a partir
   * de 490 €). Declarar ao Google um preço que a página não mostra é a
   * divergência que ele penaliza, por isso o bloco sai inteiro.
   */
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
          <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
            <div className="max-w-3xl">
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
              {/*
                Dizia "Preços desde 150EUR para T0/T1" — número que o motor não
                pratica (factura a partir de 490 €) e escrito num formato que
                mais nenhuma página usava. Sai o valor, fica o prazo.
              */}
              <p className="mt-4 text-sm text-slate-500">
                <span className="font-semibold text-emerald-600">Orçamento personalizado</span>, grátis e em 24 horas
              </p>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white p-6 shadow-[0_24px_60px_-34px_rgba(5,150,105,0.14)]">
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

          <div className="rounded-[30px] border border-slate-200 bg-[#F4F8FB] p-7">
            <h2 className="mt-3 text-2xl font-bold text-tinta">Mudanças sem stress</h2>
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

      {/* Preços — sem tabela, ver a nota em `tiposDeMudanca` */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(5,150,105,0.12)] sm:p-8">
            <h2 className="text-2xl font-bold text-slate-900">Quanto custa uma mudança</h2>
            <p className="mt-2 text-slate-600">
              Não publicamos tabela de preços para mudanças, e é uma decisão: duas
              mudanças da mesma tipologia podem ter custos muito diferentes conforme
              o volume real e os acessos. O orçamento é personalizado, grátis e
              chega-lhe em 24 horas — fechado antes de o trabalho começar.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {tiposDeMudanca.map((item) => (
                <div
                  key={item.tipo}
                  className="rounded-[18px] border border-emerald-100 bg-emerald-50/70 p-4"
                >
                  <p className="font-medium text-slate-900">{item.tipo}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                O que faz variar o preço
              </h3>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {fatoresDePreco.map((fator) => (
                  <li key={fator} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {fator}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/contactos"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 hover:shadow-lg"
            >
              Pedir orçamento grátis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
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
            {/* Dizia "Ver preços de mudanças em Lisboa" — a página de destino
                deixou de mostrar preços, o link deixa de os prometer. */}
            <Link href="/mudancas/lisboa" className="ml-1 font-medium text-emerald-600 hover:underline">
              Ver mudanças em Lisboa
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

      {/* Hub de cidades — links para páginas dedicadas por cidade */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Cidades com página dedicada
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600">
            {/* Prometia "faixa de preço" nos dados locais — as páginas de
                cidade deixaram de a mostrar. */}
            Para cada cidade principal temos uma página com dados locais — distância à base, rotas mais pedidas, particularidades de acesso e FAQ específico.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CIDADES_MUDANCAS.map((cidade) => (
              <Link
                key={cidade.slug}
                href={`/mudancas/${cidade.slug}`}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md"
              >
                <div>
                  <p className="text-base font-bold text-slate-800 group-hover:text-emerald-700">
                    Mudanças em {cidade.nome}
                  </p>
                  {/*
                    Dizia "Desde {precoMin}€ · {distanceKm}km da base" — treze
                    cartões, treze pisos entre 140 e 220 €, todos abaixo dos
                    490 € a que o motor factura. Fica a distância, que é um
                    facto verificável, e o prazo de resposta.
                  */}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {cidade.distanceKm} km da base · orçamento em 24 h
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-tinta-fraca group-hover:translate-x-0.5 group-hover:text-emerald-600" />
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
