import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  MessageCircle,
  Phone,
  Star,
} from "lucide-react";

import { BUSINESS_NAME, BUSINESS_PHONE, SITE_URL } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Serviços de Recolha de Entulho, Limpezas e Mudanças",
  description:
    "Recolha de entulho, móveis, monos, limpeza pós-obra, esvaziamentos e mudanças em Lisboa e Setúbal. Preços desde 120EUR, orçamento grátis em 24h!",
  alternates: { canonical: `${SITE_URL}/servicos` },
  openGraph: {
    title: "Serviços de Recolha de Entulho, Limpezas e Mudanças",
    description:
      "Recolha de entulho, móveis, limpeza pós-obra e mudanças em Lisboa e Setúbal. Preços desde 120EUR!",
    url: `${SITE_URL}/servicos`,
  },
};

const WA_HREF = `https://wa.me/351931632622?text=${encodeURIComponent(
  "Olá CLYON, quero pedir orçamento para um serviço.",
)}`;

type Message = { from: "cliente" | "clyon"; text: string; time: string };

type Service = {
  title: string;
  tagline: string;
  price: string;
  href: string;
  accent: string;        // gradient
  emoji: string;         // service marker
  messages: Message[];   // stylized conversation
};

const services: Service[] = [
  {
    title: "Recolha de Móveis",
    tagline: "Sofás, camas, armários, eletrodomésticos",
    price: "desde 60€",
    href: "/recolha-de-moveis",
    accent: "from-cyan-400 to-blue-500",
    emoji: "🛋️",
    messages: [
      { from: "cliente", text: "Tenho um sofá e um armário para levar em Lisboa. Quanto fica?", time: "09:12" },
      { from: "clyon",   text: "Bom dia! Recolhemos amanhã de manhã — 75€ tudo incluído. Confirma?", time: "09:14" },
    ],
  },
  {
    title: "Recolha de Entulho",
    tagline: "Restos de obra, sacos e materiais mistos",
    price: "desde 120€",
    href: "/recolha-de-entulho",
    accent: "from-amber-400 to-orange-500",
    emoji: "🧱",
    messages: [
      { from: "cliente", text: "Fiz obras na cozinha, tenho ~2m³ de entulho. É possível hoje?", time: "14:03" },
      { from: "clyon",   text: "Hoje entre as 17h e 19h. Fica em 130€ com transporte incluído.", time: "14:05" },
    ],
  },
  {
    title: "Esvaziamento de Casas",
    tagline: "Libertação completa do imóvel",
    price: "orçamento no local",
    href: "/esvaziamento-de-casas",
    accent: "from-emerald-400 to-teal-500",
    emoji: "🏠",
    messages: [
      { from: "cliente", text: "Herdei um T2 cheio e preciso de esvaziar para vender. Ajudam?", time: "10:40" },
      { from: "clyon",   text: "Passamos amanhã para avaliar — tratamos de tudo, incluindo entrega da chave.", time: "10:42" },
    ],
  },
  {
    title: "Recolha de Monos",
    tagline: "Volumes grandes e acumulados",
    price: "desde 80€",
    href: "/recolha-de-monos",
    accent: "from-fuchsia-400 to-pink-500",
    emoji: "📦",
    messages: [
      { from: "cliente", text: "Tenho garagem cheia de tralha antiga, quero libertar espaço.", time: "16:20" },
      { from: "clyon",   text: "Envie 2 ou 3 fotos por WhatsApp e mando preço em 15 minutos.", time: "16:21" },
    ],
  },
  {
    title: "Mudanças",
    tagline: "Casa, escritório, com desmontagem",
    price: "orçamento personalizado",
    href: "/mudancas",
    accent: "from-indigo-400 to-purple-500",
    emoji: "🚚",
    messages: [
      { from: "cliente", text: "Mudança de T2 no dia 15, com desmontagem de guarda-roupa.", time: "11:08" },
      { from: "clyon",   text: "Temos disponibilidade. Envio orçamento por email ainda hoje.", time: "11:10" },
    ],
  },
  {
    title: "Limpeza pós-obra",
    tagline: "Pronto a habitar depois de obra",
    price: "desde 150€",
    href: "/limpeza-de-quintais",
    accent: "from-sky-400 to-cyan-500",
    emoji: "✨",
    messages: [
      { from: "cliente", text: "Acabei remodelação, quero entregar a casa a brilhar.", time: "18:47" },
      { from: "clyon",   text: "Equipa disponível na quarta às 09h — 180€ com produtos incluídos.", time: "18:49" },
    ],
  },
];

const steps = [
  { n: "1", title: "Envie fotos", text: "Por WhatsApp ou simulador. Basta a morada e algumas fotos." },
  { n: "2", title: "Receba o preço", text: "Orçamento claro em minutos, sem visitas nem surpresas." },
  { n: "3", title: "Marcamos e recolhemos", text: "Muitas vezes no próprio dia em Lisboa e Setúbal." },
];

const reviews = [
  { name: "Rita M.", initial: "R", text: "Rápido, profissional e sem confusão. Voltaria a contratar." },
  { name: "Carlos S.", initial: "C", text: "Recolha do sofá antigo no mesmo dia. Preço justo." },
  { name: "Patricia C.", initial: "P", text: "Equipa educada, chegou à hora e deixou tudo limpo." },
];

const faqs = [
  {
    q: "Que tipo de pedidos a CLYON aceita?",
    a: "Recolha de entulho, móveis, monos, recheios, limpeza pós-obra, esvaziamento de casas e mudanças — para particulares e empresas.",
  },
  {
    q: "Recolhem no mesmo dia?",
    a: "Sempre que há disponibilidade, sim. Em Lisboa, Grande Lisboa, Margem Sul e Setúbal muitos pedidos ficam feitos no próprio dia ou no seguinte.",
  },
  {
    q: "Fazem desmontagem dentro de casa?",
    a: "Sim. Desmontamos móveis e tratamos do carregamento a partir do interior do imóvel, loja, escritório ou arrecadação.",
  },
  {
    q: "Como pagar?",
    a: "MB WAY, transferência ou numerário na altura do serviço. Emitimos fatura sempre.",
  },
  {
    q: "Trabalham com empresas e condomínios?",
    a: "Sim — particulares, senhorios, empresas, gestores de património, condomínios e equipas de obra.",
  },
];

export const revalidate = 86400;

const serviceListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Serviços CLYON",
  itemListElement: services.map((s, i) => ({
    "@type": "Service",
    position: i + 1,
    name: s.title,
    description: s.tagline,
    provider: { "@type": "LocalBusiness", name: BUSINESS_NAME, telephone: BUSINESS_PHONE },
    areaServed: ["Lisboa", "Setúbal", "Almada", "Seixal"],
  })),
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

// ─── Chat card ─────────────────────────────────────────────────────────────
function ChatCard({ service }: { service: Service }) {
  return (
    <Link
      href={service.href}
      className="group relative flex flex-col overflow-hidden rounded-[26px] border border-[#E2EEF3] bg-white shadow-[0_10px_40px_-24px_rgba(14,116,144,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-24px_rgba(14,116,144,0.35)]"
    >
      {/* Header com gradiente e emoji */}
      <div className={`relative flex items-center gap-3 bg-gradient-to-r ${service.accent} px-5 pb-5 pt-4 text-white`}>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/25 text-xl backdrop-blur-sm">
          {service.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white/85">CLYON · Lisboa</p>
          <h3 className="truncate text-[15px] font-bold leading-tight">{service.title}</h3>
        </div>
        <span className="rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-900">
          {service.price}
        </span>
      </div>

      {/* Bolhas de conversa */}
      <div className="flex flex-col gap-2.5 bg-[#F5F9FC] px-4 py-4">
        {service.messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "cliente" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug shadow-sm ${
                m.from === "cliente"
                  ? "rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200/70"
                  : "rounded-br-md bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
              }`}
            >
              <p>{m.text}</p>
              <div
                className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                  m.from === "cliente" ? "text-slate-400" : "text-white/75"
                }`}
              >
                <span>{m.time}</span>
                {m.from === "clyon" && <Check className="h-3 w-3" strokeWidth={3} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-3.5">
        <p className="text-sm text-slate-600">{service.tagline}</p>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 transition group-hover:text-cyan-500">
          Ver mais
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export default function ServicosPage() {
  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 md:pb-12 md:pt-16 lg:px-8">
          <h1 className="max-w-[16ch] text-[2rem] font-bold leading-[1.08] tracking-tight text-[#0B1929] sm:text-5xl md:text-6xl">
            Recolhas, limpezas e mudanças <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">sem complicar.</span>
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Envie fotos, recebemos o pedido e damos preço claro. Lisboa, Margem Sul e Setúbal — muitas vezes no mesmo dia.
          </p>

          {/* CTAs primárias */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={WA_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:text-base"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp — orçamento agora
            </a>
            <Link
              href="/simulador"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 sm:text-base"
            >
              Simular preço
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:text-base"
            >
              <Phone className="h-4 w-4" />
              931 632 622
            </a>
          </div>

          {/* Reassurance strip */}
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 sm:grid-cols-4 sm:text-sm">
            {[
              "Orçamento grátis",
              "Sem visita prévia",
              "Fatura sempre",
              "Destino responsável",
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-cyan-600" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-10 md:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-3 md:mb-8">
            <div>
              <h2 className="text-2xl font-bold leading-tight text-[#0B1929] sm:text-3xl md:text-4xl">
                O que fazemos
              </h2>
              <p className="mt-1 text-sm text-slate-500 sm:text-base">Exemplos reais do que respondemos por dia.</p>
            </div>
            <Link
              href="/precos"
              className="hidden text-sm font-semibold text-cyan-700 hover:text-cyan-500 sm:inline-flex sm:items-center sm:gap-1"
            >
              Ver preços <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ChatCard key={s.title} service={s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="bg-white py-10 md:py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold leading-tight text-[#0B1929] sm:text-3xl md:text-4xl">
            Como pedir — 3 passos
          </h2>
          <p className="mt-2 max-w-lg text-sm text-slate-600 sm:text-base">
            Sem visita prévia, sem burocracia. Foto + morada = preço.
          </p>

          <ol className="mt-6 grid gap-3 md:grid-cols-3 md:gap-5">
            {steps.map((step) => (
              <li key={step.n} className="relative rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5">
                <span className="absolute -top-3 left-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-md">
                  {step.n}
                </span>
                <h3 className="mt-2 text-base font-bold text-[#0B1929] sm:text-lg">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── REVIEWS ──────────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-10 md:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between gap-3 md:mb-8">
            <div>
              <div className="flex items-center gap-1.5 text-amber-400">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
                <span className="ml-1 text-sm font-semibold text-slate-900">4,9 / 5</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Baseado em clientes reais em Lisboa e Setúbal.</p>
            </div>
            <Link
              href="/avaliacoes"
              className="hidden text-sm font-semibold text-cyan-700 hover:text-cyan-500 sm:inline-flex sm:items-center sm:gap-1"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {reviews.map((r) => (
              <figure key={r.name} className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-1 text-amber-400">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-2 text-sm leading-6 text-slate-700">&ldquo;{r.text}&rdquo;</blockquote>
                <figcaption className="mt-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white">
                    {r.initial}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-10 md:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold leading-tight text-[#0B1929] sm:text-3xl md:text-4xl">
            Perguntas frequentes
          </h2>
          <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {faqs.map((f) => (
              <details key={f.q} className="group px-4 py-3.5 open:bg-slate-50 sm:px-5">
                <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-semibold text-slate-900 sm:text-base [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition group-open:rotate-45 group-open:border-cyan-500 group-open:text-cyan-600">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="bg-white pb-10 md:pb-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-8 text-white shadow-xl md:px-10 md:py-12">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">
                  Já sabe o serviço? Peça agora.
                </h2>
                <p className="mt-2 max-w-lg text-sm text-cyan-50 sm:text-base">
                  Envie o pedido pelo WhatsApp ou simulador — resposta em minutos.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <a
                  href={WA_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <Link
                  href="/simulador"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950/25 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-slate-950/40"
                >
                  Simular preço
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STICKY MOBILE CTA ────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <a
            href={WA_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-3 text-sm font-semibold text-white active:bg-emerald-600"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <Link
            href="/simulador"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-3 text-sm font-semibold text-white active:brightness-110"
          >
            Simular
          </Link>
          <a
            href={`tel:${BUSINESS_PHONE}`}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-700 active:bg-slate-100"
            aria-label="Ligar agora"
          >
            <Phone className="h-4 w-4" />
          </a>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  );
}
