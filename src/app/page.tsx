import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  ClipboardList,
  Hammer,
  HardHat,
  Home,
  Leaf,
  MessageCircle,
  Package,
  Shield,
  Sofa,
  Star,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { reviews } from "@/lib/reviews-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "CLYON — Plataforma de Serviços para Casa em Lisboa e Setúbal",
  description:
    "Encontre profissionais verificados para recolha de móveis, entulho, esvaziamento de casas e mais em Lisboa, Margem Sul e Setúbal. Orçamento confirmado em minutos. 188 trabalhos concluídos com 5,0 ★.",
  alternates: { canonical: "https://clyon.pt" },
  openGraph: {
    title: "CLYON — Plataforma de Serviços para Casa em Lisboa e Setúbal",
    description:
      "Profissionais verificados para recolha, esvaziamento e serviços em casa em Lisboa. Orçamento online em 2 minutos.",
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
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  recolha_moveis: { bg: "bg-cyan-50", text: "text-cyan-600" },
  recolha_monos: { bg: "bg-amber-50", text: "text-amber-600" },
  recolha_entulho: { bg: "bg-orange-50", text: "text-orange-600" },
  esvaziamento_casa: { bg: "bg-emerald-50", text: "text-emerald-600" },
  esvaziamento_apartamento: { bg: "bg-blue-50", text: "text-blue-600" },
  mudanca: { bg: "bg-violet-50", text: "text-violet-600" },
  montagem_moveis: { bg: "bg-rose-50", text: "text-rose-600" },
  jardinagem: { bg: "bg-lime-50", text: "text-lime-600" },
  manutencao_casa: { bg: "bg-sky-50", text: "text-sky-600" },
};

const HERO_PILLS = [
  { id: "recolha_moveis", label: "Móveis", href: "/recolha-de-moveis" },
  { id: "recolha_entulho", label: "Entulho", href: "/recolha-de-entulho" },
  { id: "esvaziamento_casa", label: "Esvaziamento", href: "/esvaziamento-de-casas" },
  { id: "recolha_monos", label: "Monos", href: "/recolha-de-monos" },
  { id: "mudanca", label: "Mudança", href: "/mudancas" },
];

const PLATFORM_STATS = [
  { value: "5,0 ★", label: "Avaliação dos clientes", sub: "Baseado em opiniões reais", accent: "text-amber-500" },
  { value: "188", label: "Trabalhos concluídos", sub: "e a contar", accent: "text-cyan-600" },
  { value: "9", label: "Categorias de serviço", sub: "Casa, jardim e mais", accent: "text-emerald-600" },
  { value: "24+", label: "Localidades cobertas", sub: "Lisboa · Margem Sul · Setúbal", accent: "text-blue-600" },
];

const HOW_IT_WORKS = [
  {
    icon: ClipboardList,
    title: "Descreva o trabalho",
    description:
      "Use o simulador em 2 minutos: tipo de serviço, morada, acesso e fotos. Quanto mais detalhe, mais preciso o orçamento.",
  },
  {
    icon: CheckCircle2,
    title: "Confirmamos preço e data",
    description:
      "Um assistente confirma o orçamento e agenda a data consigo. Nada avança sem a sua aprovação explícita.",
  },
  {
    icon: Truck,
    title: "Profissional na sua porta",
    description:
      "Um profissional verificado executa o trabalho na data acordada. O espaço fica limpo e pronto a usar.",
  },
];

const GUARANTEES = [
  {
    icon: BadgeCheck,
    title: "Profissionais verificados",
    description:
      "Todos os operacionais passam por verificação de identidade e avaliação de qualidade contínua. Nenhum profissional sem historial entra na plataforma.",
  },
  {
    icon: Shield,
    title: "Preço confirmado, sem surpresas",
    description:
      "O orçamento é fechado antes do serviço começar. Não há adicionais no final, nem negociações no dia da recolha.",
  },
  {
    icon: Clock,
    title: "Resposta em menos de 48 horas",
    description:
      "A maioria dos pedidos em Lisboa e Margem Sul recebe confirmação de data no próprio dia. Cobertura em mais de 24 localidades.",
  },
];

const homeFaqs = [
  {
    question: "Quanto custa a recolha de monos ou móveis?",
    answer:
      "O valor depende do volume, acessos, tipo de material, urgência e necessidade de desmontagem. A forma mais rápida de obter um valor exato é usar o simulador — leva 2 minutos.",
  },
  {
    question: "Recolhem no mesmo dia?",
    answer:
      "Quando existe disponibilidade operacional, sim. Muitos pedidos em Lisboa, Grande Lisboa, Margem Sul e Setúbal conseguem resposta no próprio dia ou no dia seguinte.",
  },
  {
    question: "Retiram sofás, colchões e eletrodomésticos?",
    answer:
      "Sim. A CLYON retira sofás, camas, colchões, armários, eletrodomésticos e outros volumes grandes desde que identificados no orçamento.",
  },
  {
    question: "Fazem desmontagem de móveis?",
    answer:
      "Sim. Quando necessário, a equipa desmonta móveis e trata da retirada a partir do interior do imóvel.",
  },
  {
    question: "Atendem empresas e condomínios?",
    answer:
      "Sim. A operação serve particulares, senhorios, empresas, equipas de obra e condomínios com necessidade de recolha, limpeza ou esvaziamento.",
  },
  {
    question: "O destino dos resíduos é responsável?",
    answer:
      "Sempre que possível separamos materiais para reaproveitamento ou encaminhamento adequado. O restante segue para destino responsável e legal.",
  },
];

const homeFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export const revalidate = 3600;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative min-h-[600px] overflow-hidden bg-[#0B1929] md:min-h-[680px] lg:min-h-[740px]">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B1929]/50 via-[#0B1929]/28 to-[#0B1929]/5 lg:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1929]/35 via-transparent to-transparent" />

        {/* Content */}
        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="w-full max-w-2xl">

            {/* H1 */}
            <h1 className="text-[2.1rem] font-bold leading-[1.1] tracking-tight text-white drop-shadow-md sm:text-5xl lg:text-[3.5rem]">
              Profissionais verificados{" "}
              <span className="text-cyan-400">para cada serviço</span>{" "}
              em casa
            </h1>

            {/* Subtitle */}
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
              Peça orçamento online em 2 minutos. Confirmamos preço e data.
              Coordenamos o profissional certo para o seu trabalho em Lisboa e Setúbal.
            </p>

            {/* Category pills */}
            <div className="mt-7 flex flex-wrap gap-2">
              {HERO_PILLS.map((pill) => (
                <Link
                  key={pill.id}
                  href={pill.href}
                  className="rounded-full border border-white/20 bg-white/[0.08] px-4 py-1.5 text-sm font-medium text-white/85 backdrop-blur-sm transition-all hover:border-cyan-400/70 hover:bg-cyan-500/20 hover:text-white"
                >
                  {pill.label}
                </Link>
              ))}
              <Link
                href="/simulador"
                className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-1.5 text-sm font-semibold text-cyan-300 backdrop-blur-sm transition-all hover:border-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-200"
              >
                Ver todos
              </Link>
            </div>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/simulador"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-cyan-500 px-8 text-base font-semibold text-white shadow-xl shadow-cyan-500/30 transition-all hover:-translate-y-0.5 hover:bg-cyan-400"
              >
                Pedir Orçamento Grátis
              </Link>
              <a
                href="https://wa.me/351965785395?text=Ol%C3%A1!%20Gostava%20de%20pedir%20um%20or%C3%A7amento%20%C3%A0%20CLYON."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-8 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────── */}
      <section className="border-b border-[#E2EEF3] bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 divide-x divide-[#E2EEF3] md:grid-cols-4">
            {PLATFORM_STATS.map((stat) => (
              <div key={stat.label} className="px-4 py-6 text-center sm:px-6 sm:py-8">
                <div className={`text-2xl font-bold sm:text-3xl ${stat.accent}`}>{stat.value}</div>
                <div className="mt-0.5 text-sm font-semibold text-[#0B1929]">{stat.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-[#0B1929] sm:text-4xl">
              Simples do início ao fim
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500 sm:text-lg">
              Do pedido à porta fechada — sem chamadas desnecessárias, sem orçamentos que nunca chegam.
            </p>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[16.5%] right-[16.5%] top-7 hidden h-px border-t-2 border-dashed border-slate-200 md:block" />
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 shadow-lg shadow-cyan-500/30 ring-4 ring-white">
                  <step.icon className="h-7 w-7 text-white" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0B1929] text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-[#0B1929]">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/simulador"
              className="inline-flex items-center rounded-xl bg-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:-translate-y-0.5 hover:bg-cyan-400"
            >
              Iniciar pedido agora
            </Link>
          </div>
        </div>
      </section>

      {/* ── SERVICES ──────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {SERVICE_CATEGORIES.filter((c) => c.id !== "outro").map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id] ?? Star;
              const colors = CATEGORY_COLORS[cat.id] ?? { bg: "bg-cyan-50", text: "text-cyan-600" };
              return (
                <Link
                  key={cat.id}
                  href={cat.href}
                  className="group flex flex-col rounded-2xl border border-[#E2EEF3] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg sm:p-6"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors sm:h-14 sm:w-14 ${colors.bg}`}>
                    <Icon className={`h-5 w-5 sm:h-7 sm:w-7 ${colors.text}`} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-[#0B1929] sm:text-base">{cat.label}</h3>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                    {cat.description}
                  </p>
                  <span className={`mt-4 text-xs font-semibold sm:text-sm ${colors.text}`}>
                    Pedir orçamento
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── GUARANTEES ────────────────────────────────────────────── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-[#0B1929] sm:text-4xl">
              Construída para inspirar confiança
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500 sm:text-lg">
              Cada detalhe foi pensado para eliminar incerteza — no preço, no profissional e no resultado.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {GUARANTEES.map((g) => (
              <div key={g.title} className="rounded-2xl border border-[#E2EEF3] bg-[#F4F8FB] p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 shadow-lg shadow-cyan-500/25">
                  <g.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-[#0B1929]">{g.title}</h3>
                <p className="mt-3 leading-relaxed text-slate-500">{g.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ───────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-[#0B1929] sm:text-4xl">
              O que dizem os nossos clientes
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500 sm:text-lg">
              Histórias reais de quem já usou a CLYON em Lisboa, Margem Sul e Setúbal.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {reviews.slice(0, 3).map((review) => (
              <article
                key={review.name}
                className="flex flex-col rounded-2xl border border-[#E2EEF3] bg-white p-7 shadow-sm"
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-7 text-slate-600">
                  &ldquo;{review.text}&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-3 border-t border-[#E2EEF3] pt-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0B1929]">{review.name}</div>
                    <div className="text-xs text-slate-400">{review.date}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/avaliacoes"
              className="inline-flex items-center text-sm font-semibold text-cyan-600 hover:text-cyan-700"
            >
              Ver mais testemunhos
            </Link>
          </div>
        </div>
      </section>

      {/* ── COVERAGE ──────────────────────────────────────────────── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold text-[#0B1929] sm:text-4xl">Onde estamos</h2>
              <p className="mt-4 max-w-md text-slate-500 sm:text-lg">
                Já cobrimos mais de 24 localidades em Lisboa, Margem Sul e Setúbal —
                e continuamos a crescer.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {[
                  "Lisboa", "Amadora", "Loures", "Odivelas", "Sintra", "Cascais",
                  "Oeiras", "Almada", "Seixal", "Barreiro", "Moita", "Montijo",
                  "Setúbal", "Palmela", "Sesimbra", "Azeitão",
                ].map((city) => (
                  <span
                    key={city}
                    className="rounded-xl border border-[#E2EEF3] bg-white px-3.5 py-1.5 text-sm font-medium text-[#0B1929] shadow-sm"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl ring-1 ring-[#B8DDEE]">
              <Image
                src="/mapa-cobertura.webp"
                alt="Mapa de cobertura CLYON — Lisboa, Margem Sul e Setúbal"
                width={1123}
                height={644}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR PROFESSIONALS ─────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-cyan-50 via-white to-blue-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold text-[#0B1929] sm:text-4xl">
                Tem uma empresa de remoções ou transportes?
              </h2>
              <p className="mt-4 text-slate-500 sm:text-lg">
                Receba pedidos verificados na sua zona. Sem investimento em publicidade, sem
                leads frios — só trabalho real com clientes confirmados.
              </p>
              <div className="mt-7 flex flex-wrap gap-6">
                {[
                  { icon: Users, label: "Clientes verificados" },
                  { icon: Shield, label: "Sem leads falhados" },
                  { icon: BadgeCheck, label: "Pagamento garantido" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <item.icon className="h-4 w-4 text-cyan-600" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0">
              <a
                href={`https://wa.me/351965785395?text=${encodeURIComponent(
                  "Olá! Sou uma empresa de remoções/transportes e quero saber mais sobre ser parceiro CLYON.",
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-cyan-500 px-8 text-base font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5 hover:bg-cyan-400"
              >
                Tornar-me parceiro
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-[#0B1929] sm:text-4xl">
              Perguntas frequentes
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">
              Respostas às dúvidas mais comuns sobre recolha de móveis, entulho e esvaziamento em Lisboa.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E2EEF3] bg-[#F4F8FB] px-6 sm:px-8">
            <Accordion type="single" collapsible>
              {homeFaqs.map((faq) => (
                <AccordionItem
                  key={faq.question}
                  value={faq.question}
                  className="border-[#E2EEF3]"
                >
                  <AccordionTrigger className="text-left text-base font-semibold text-[#0B1929] hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-slate-500">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────── */}
      <section className="bg-white py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-50 via-white to-blue-50 px-8 py-12 text-center ring-1 ring-[#E2EEF3] sm:px-12 sm:py-16">
            <h2 className="text-2xl font-bold text-[#0B1929] sm:text-3xl lg:text-4xl">
              Pronto para libertar espaço?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-500 sm:text-lg">
              Orçamento online, sem telefonemas. Confirme os detalhes e receba uma resposta clara.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/simulador"
                className="inline-flex h-12 items-center rounded-xl bg-cyan-500 px-8 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:-translate-y-0.5 hover:bg-cyan-400"
              >
                Pedir Orçamento Grátis
              </Link>
              <a
                href="https://wa.me/351965785395?text=Ol%C3%A1!%20Gostava%20de%20pedir%20um%20or%C3%A7amento%20%C3%A0%20CLYON."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#25D366] px-8 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1ebe5d]"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqSchema) }}
      />
    </div>
  );
}
