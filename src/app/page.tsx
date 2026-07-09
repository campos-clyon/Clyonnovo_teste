import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Hammer,
  HardHat,
  Handshake,
  Home,
  Leaf,
  MapPin,
  MessageCircle,
  Package,
  Quote,
  Sofa,
  Sparkles,
  Star,
  Truck,
  UserCheck,
  Wrench,
} from "lucide-react";

import RotatingHeroCopy from "@/components/RotatingHeroCopy";
import ImageCarousel from "@/components/ImageCarousel";
import { getHeroCarouselImages } from "@/lib/work-gallery";
import HeroCTAButton from "@/components/HeroCTAButton";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { reviews } from "@/lib/reviews-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "CLYON — Recolha de Móveis, Entulho, Monos e Esvaziamento de Casas em Lisboa e Setúbal",
  description:
    "Recolha de móveis, entulho, monos, esvaziamento de casas e limpeza pós-obra em Lisboa, Margem Sul e Setúbal. Resposta em 24h, 163 avaliações 5 estrelas. Orçamento grátis!",
  alternates: {
    canonical: "https://clyon.pt",
  },
  openGraph: {
    title: "CLYON — Recolha de Móveis, Entulho, Monos e Esvaziamento de Casas em Lisboa e Setúbal",
    description:
      "Recolha de móveis, entulho, monos, esvaziamento de casas e limpeza pós-obra em Lisboa e Setúbal. Resposta em 24h. Orçamento grátis!",
    url: "https://clyon.pt",
  },
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  recolha_moveis: Sofa,
  recolha_monos: Package,
  recolha_entulho: HardHat,
  esvaziamento_casa: Home,
  esvaziamento_apartamento: Building2,
  mudanca: Truck,
  montagem_moveis: Wrench,
  jardinagem: Leaf,
  manutencao_casa: Hammer,
  outro: Star,
};

const priceHighlights = [
  "Sofá ou cadeirão: orçamento conforme acesso",
  "Cama completa: valor sob avaliação",
  "Armário grande: depende do volume e piso",
  "Vários móveis: orçamento personalizado",
];

const collectedItems = [
  "Móveis velhos, recheios, sofás e colchões",
  "Eletrodomésticos e volumes grandes",
  "Entulho de obra e restos de remodelação",
  "Monos, sucata e acumulação em arrecadações",
  "Limpeza pós-obra e apoio em mudanças",
  "Pedidos de esvaziamento com recolha completa",
];

const steps = [
  {
    step: "01",
    title: "Captação estruturada",
    description: "Descreva o serviço, envie fotos e indique morada e condições de acesso no simulador.",
    icon: ClipboardList,
    accent: "cyan" as const,
  },
  {
    step: "02",
    title: "Orçamento instantâneo por IA",
    description: "A IA analisa o pedido e calcula um preço fixo em segundos, com base no preçário oficial.",
    icon: Sparkles,
    accent: "premium" as const,
  },
  {
    step: "03",
    title: "Revisão humana",
    description: "Um assistente confirma morada, data e orçamento consigo antes de avançar. Nada segue sem validação.",
    icon: UserCheck,
    accent: "cyan" as const,
  },
  {
    step: "04",
    title: "Execução verificada",
    description: "Um profissional verificado aceita o trabalho e executa o serviço na data combinada.",
    icon: Truck,
    accent: "cyan" as const,
  },
];

const comparisonRows = [
  { label: "Modelo de preço", others: "Orçamentos concorrentes (leilão)", clyon: "Preço fixo calculado por IA" },
  { label: "Validação", others: "Nenhuma", clyon: "Sempre por um assistente humano" },
  { label: "Tempo de resposta", others: "Horas a dias", clyon: "Imediato + validação em menos de 2h" },
  { label: "Especialização", others: "Generalista", clyon: "Remoções, transportes e esvaziamentos" },
];

const homeFaqs = [
  {
    question: "Quanto custa a recolha de monos ou móveis?",
    answer:
      "O valor depende do volume, acessos, tipo de material, urgência e necessidade de desmontagem. A forma mais rápida de receber um valor certo é enviar fotos e morada.",
  },
  {
    question: "Recolhem no mesmo dia?",
    answer:
      "Quando existe disponibilidade operacional, sim. Muitos pedidos em Lisboa, Grande Lisboa, Margem Sul e Setúbal conseguem resposta no próprio dia ou no dia seguinte.",
  },
  {
    question: "Retiram sofás, colchões e eletrodomésticos?",
    answer:
      "Sim. A CLYON retira sofás, camas, colchões, armários, eletrodomésticos e outros volumes grandes, desde que o pedido seja identificado no orçamento.",
  },
  {
    question: "Fazem desmontagem?",
    answer:
      "Sim. Quando necessário, a equipa desmonta móveis e trata da retirada a partir do interior do imóvel.",
  },
  {
    question: "Atendem empresas e condomínios?",
    answer:
      "Sim. A operação atende particulares, senhorios, empresas, equipas de obra e condomínios com necessidade de recolha, limpeza ou esvaziamento.",
  },
  {
    question: "O destino dos resíduos é legal?",
    answer:
      "Sempre que possível, a equipa separa materiais para reaproveitamento ou encaminhamento adequado. O restante segue para destino responsável.",
  },
];

const regionalHighlights = [
  {
    heading: "Grande Lisboa",
    description: "Recolha de sofás, camas, armários e eletrodomésticos com apoio completo dentro da cidade.",
    mainHref: "/recolha-moveis-lisboa",
    cta: "Ver Lisboa",
    links: [
      { href: "/recolha-moveis-lisboa", title: "Recolha de móveis em Lisboa" },
      { href: "/recolha-moveis-benfica", title: "Recolha de móveis em Benfica" },
      { href: "/recolha-moveis-lumiar", title: "Recolha de móveis no Lumiar" },
    ],
  },
  {
    heading: "Linha de Cascais",
    description: "Cobertura em Cascais, Oeiras e Sintra para retirar móveis usados, recheios e volumes grandes.",
    mainHref: "/recolha-moveis-cascais",
    cta: "Ver Cascais",
    links: [
      { href: "/recolha-moveis-cascais", title: "Recolha de móveis em Cascais" },
      { href: "/recolha-moveis-oeiras", title: "Recolha de móveis em Oeiras" },
      { href: "/recolha-moveis-sintra", title: "Recolha de móveis em Sintra" },
    ],
  },
];

const homeFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export const revalidate = 3600;

export default async function HomePage() {
  const workImages = await getHeroCarouselImages();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative min-h-[525px] overflow-hidden bg-gradient-to-b from-slate-50 to-white md:min-h-[605px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_50%)]" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-14 lg:px-8 lg:pb-21 lg:pt-18">
          <div className="grid items-center gap-9 lg:grid-cols-2 lg:gap-12">

            {/* Left: text content */}
            <div className="max-w-lg">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 flex-shrink-0 text-violet-600" />
                <span className="text-sm font-semibold text-violet-700">
                  Preço fixo calculado por IA, confirmado por um assistente humano
                </span>
              </div>

              <h1 className="text-balance text-[1.675rem] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-[2.1rem] lg:text-[2.35rem]">
                Recolha de Móveis, Entulho e Esvaziamento de Casas em Lisboa
              </h1>

              <div className="mt-3">
                <RotatingHeroCopy />
              </div>

              <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate-600">
                Recolha rápida de móveis, entulho, monos e limpeza pós-obra em Lisboa, Margem Sul e Setúbal. Orçamento grátis em 24h.
              </p>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <HeroCTAButton />
                <a
                  href="https://wa.me/351965785395?text=Ol%C3%A1!%20Gostava%20de%20pedir%20um%20or%C3%A7amento%20%C3%A0%20CLYON."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#1ebe5d] hover:shadow-xl"
                >
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span className="text-white">WhatsApp</span>
                </a>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200 pt-6">
                {[
                  { value: "163", label: "Avaliações" },
                  { value: "24h", label: "Resposta" },
                  { value: "Grátis", label: "Orçamento" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-lg font-bold text-slate-900 sm:text-xl">{stat.value}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: carousel — hidden on mobile */}
            <div className="hidden lg:block">
              <div className="overflow-hidden rounded-2xl shadow-xl">
                <div className="aspect-[4/3]">
                  <ImageCarousel
                    images={workImages}
                    autoPlayInterval={5000}
                    sizes="(max-width: 1023px) 0px, (max-width: 1279px) 50vw, 620px"
                  />
                </div>
              </div>
              <p className="mt-3 text-center text-xs font-medium text-slate-500">
                Equipa profissional em Lisboa e Setúbal — resposta média em 11 minutos
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Onde Operamos */}
      <section className="bg-slate-50 py-8 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center sm:mb-12">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Onde Operamos</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 sm:mt-3 sm:text-lg">
              Mais de 24 localidades cobertas em Lisboa, Margem Sul e Setúbal.
            </p>
          </div>

          <div className="grid gap-3 sm:gap-6 md:grid-cols-3">
            {[
              { name: "Grande Lisboa", slug: "lisboa", cities: ["Lisboa", "Amadora", "Sintra", "Cascais", "Oeiras"], highlight: "Mais procurado" },
              { name: "Margem Sul", slug: "margem-sul", cities: ["Almada", "Seixal", "Barreiro", "Moita", "Montijo"], highlight: "Base CLYON" },
              { name: "Setúbal", slug: "setubal", cities: ["Setúbal", "Palmela", "Sesimbra"], highlight: null },
            ].map((region) => (
              <div key={region.slug} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-cyan-200 hover:shadow-lg sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 sm:h-12 sm:w-12">
                    <MapPin className="h-4.5 w-4.5 text-cyan-600 sm:h-6 sm:w-6" />
                  </div>
                  {region.highlight && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 sm:px-3 sm:text-xs">
                      {region.highlight}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-bold text-slate-900 sm:mt-5 sm:text-xl">{region.name}</h3>
                <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
                  {region.cities.map((city) => (
                    <span key={city} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:px-3 sm:py-1.5 sm:text-sm">
                      {city}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/regioes/${region.slug}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 transition-colors group-hover:text-cyan-700 sm:mt-5"
                >
                  Ver serviços na região
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Servicos */}
      <section className="bg-white py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center sm:mb-12">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">O que fazemos</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 sm:mt-3 sm:text-lg">
              Da recolha de um único sofá ao esvaziamento completo de uma casa — mesma equipa, mesmo processo, sem surpresas no preço.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {SERVICE_CATEGORIES.map((category) => {
              const CategoryIcon = CATEGORY_ICONS[category.id] ?? Star;
              return (
                <div key={category.id} className="group rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-cyan-200 hover:shadow-lg sm:p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 sm:h-14 sm:w-14">
                    <CategoryIcon className="h-5 w-5 text-cyan-600 sm:h-7 sm:w-7" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900 sm:mt-5 sm:text-lg">{category.label}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:mt-2 sm:text-sm">{category.description}</p>
                  <Link
                    href={category.href}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 transition-colors group-hover:text-cyan-700 sm:mt-4 sm:text-sm"
                  >
                    Saber mais
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testemunhos */}
      <section className="bg-slate-50 py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center sm:mb-12">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">O que dizem os clientes</h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
              Histórias reais de quem já recolheu com a CLYON em Lisboa, Margem Sul e Setúbal.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {reviews.slice(0, 3).map((review) => (
              <article
                key={review.name}
                className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.18)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-bold text-slate-950">{review.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{review.date}</div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                    <Quote className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-5 flex gap-1 text-cyan-500">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-5 text-sm leading-8 text-slate-600">{review.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/avaliacoes" className="inline-flex items-center gap-2 text-base font-semibold text-cyan-600 transition-colors hover:text-cyan-700">
              Ver todas as avaliações
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Destaques regionais */}
      <section className="py-10 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Onde somos mais procurados</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              As duas zonas com maior volume de pedidos — cobertura garantida e resposta rápida.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {regionalHighlights.map((zone) => (
              <div key={zone.heading} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h3 className="text-lg font-bold text-slate-900">{zone.heading}</h3>
                <p className="mt-2 text-sm text-slate-600">{zone.description}</p>
                <div className="mt-5 space-y-2.5">
                  {zone.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-cyan-200 hover:bg-cyan-50"
                    >
                      <span className="text-sm font-medium text-slate-900">{link.title}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
                    </Link>
                  ))}
                </div>
                <Link
                  href={zone.mainHref}
                  className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-700"
                >
                  {zone.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Precos e O que recolhemos */}
      <section className="bg-slate-50 py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Valores de referência</h2>
              <p className="mt-2 text-slate-600">Orçamento final depende do volume e acesso.</p>
              <div className="mt-6 space-y-3">
                {priceHighlights.map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">{item.split(":")[0]}</span>
                    <span className="text-sm font-bold text-slate-900">{item.split(":")[1]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link href="/precos" className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-cyan-700 shadow-lg shadow-cyan-600/20">
                  Ver tabela completa
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Do sofá ao entulho</h2>
              <p className="mt-2 text-slate-600">Serviço completo para particulares e empresas.</p>
              <div className="mt-6 space-y-3">
                {collectedItems.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                    <span className="text-sm font-medium text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="bg-white py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">
              O modelo único da CLYON
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
              IA para a velocidade, um assistente humano para a confiança. Sem negociação, sem surpresas.
            </p>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-x-[12.5%] top-6 hidden h-px bg-slate-200 md:block" />
            <div className="grid gap-10 md:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step.step} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white ring-4 ring-white">
                    {index + 1}
                  </div>
                  <step.icon
                    className={`mt-4 h-7 w-7 ${step.accent === "premium" ? "text-violet-600" : "text-cyan-600"}`}
                  />
                  <h3 className="mt-3 text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/como-funciona" className="inline-flex items-center gap-2 text-base font-semibold text-cyan-600 transition-colors hover:text-cyan-700">
              Saber mais sobre o modelo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Comparação com o mercado */}
      <section className="bg-slate-50 py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center sm:mb-12">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">
              Diferente das plataformas de orçamentos
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
              Sem leilão de orçamentos, sem espera por respostas de vários prestadores.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Zaask / Fixando</h3>
              <div className="mt-6 space-y-5">
                {comparisonRows.map((row) => (
                  <div key={row.label}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{row.label}</div>
                    <div className="mt-1 text-sm text-slate-600">{row.others}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Oscar</h3>
              <div className="mt-6 space-y-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Modelo de preço</div>
                  <div className="mt-1 text-sm text-slate-600">Preço fixo (limitado)</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Validação</div>
                  <div className="mt-1 text-sm text-slate-600">Automática</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tempo de resposta</div>
                  <div className="mt-1 text-sm text-slate-600">Imediato</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Especialização</div>
                  <div className="mt-1 text-sm text-slate-600">Generalista</div>
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl border-2 border-violet-300 bg-white p-8 shadow-lg shadow-violet-500/10">
              <div className="absolute -top-3 right-8 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
                CLYON
              </div>
              <h3 className="text-lg font-bold text-slate-900">CLYON</h3>
              <div className="mt-6 space-y-5">
                {comparisonRows.map((row) => (
                  <div key={row.label}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{row.label}</div>
                    <div className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-slate-900">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-600" />
                      {row.clyon}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="bg-white py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center sm:mb-12">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">Dúvidas comuns</h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
              Respostas às perguntas mais frequentes sobre os nossos serviços.
            </p>
          </div>

          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 shadow-sm sm:px-8">
            <Accordion type="single" collapsible>
              {homeFaqs.map((faq) => (
                <AccordionItem key={faq.question} value={faq.question} className="border-slate-200">
                  <AccordionTrigger className="text-base font-bold text-slate-900 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-slate-600">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-10 text-center">
            <Link href="/faq" className="inline-flex items-center gap-2 text-base font-semibold text-cyan-600 transition-colors hover:text-cyan-700">
              Ver FAQ completa
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Torna-te parceiro */}
      <section className="bg-slate-50 py-10 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-violet-200 bg-white p-8 text-center sm:p-12 lg:flex-row lg:justify-between lg:text-left">
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-violet-600">
                <Handshake className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  És uma empresa de remoções ou transportes?
                </h2>
                <p className="mt-2 max-w-xl text-slate-600">
                  Cresce com a CLYON: trabalhos verificados na tua zona, sem gastar em leads que não convertem.
                </p>
              </div>
            </div>
            <a
              href={`https://wa.me/351965785395?text=${encodeURIComponent("Olá! Sou uma empresa de remoções/transportes e quero saber mais sobre ser parceiro CLYON.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-xl"
            >
              Torna-te parceiro
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-white py-10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12 lg:p-16">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">Pronto para libertar espaço?</h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
                Simule o pedido, confirme os detalhes e receba uma resposta clara em minutos.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/simulador"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#0891b2] px-8 text-base font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all hover:-translate-y-0.5 hover:bg-[#0e7490] hover:shadow-xl"
                >
                  <span className="text-white">Simular orçamento grátis</span>
                  <ArrowRight className="h-5 w-5 text-white" />
                </Link>
                <a
                  href={`https://wa.me/351965785395?text=${encodeURIComponent("Olá! Gostava de pedir um orçamento à CLYON.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-8 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5 hover:bg-[#1ebe5d] hover:shadow-xl"
                >
                  <MessageCircle className="h-5 w-5 text-white" />
                  <span className="text-white">Contactar por WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqSchema) }} />
    </div>
  );
}
