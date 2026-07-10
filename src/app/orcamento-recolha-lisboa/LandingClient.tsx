"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Package,
  Phone,
  Quote,
  ShieldCheck,
  Sofa,
  Sparkles,
  Star,
  Trash2,
  Truck,
  Users,
  XCircle,
} from "lucide-react";

const PHONE_DISPLAY = "+351 965 785 395";
const PHONE_TEL = "+351965785395";
const PHONE_SMS = "+351965785395";
const EMAIL = "geral@clyon.pt";
const WHATSAPP_BASE = "https://wa.me/351965785395";
const REVIEWS_COUNT = 163;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

type DataLayerEvent = Record<string, unknown>;

const GOOGLE_ADS_CONVERSION = "AW-18221538324/UOx5CO2e87ocEJS42vBD";

function pushDataLayer(event: DataLayerEvent) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

function trackLeadConversion() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "conversion", {
    send_to: GOOGLE_ADS_CONVERSION,
    value: 10.0,
    currency: "EUR",
  });
}

function trackWhatsApp(location: string) {
  pushDataLayer({ event: "click_whatsapp", location });
}

function trackCall(location: string) {
  pushDataLayer({ event: "click_call", location });
}

function trackSms(location: string) {
  pushDataLayer({ event: "click_sms", location });
}

function trackEmail(location: string) {
  pushDataLayer({ event: "click_email", location });
}

const EMAIL_SUBJECT = "Pedido de Orçamento - CLYON";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
] as const;

function captureUtms() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const stored: Record<string, string> = {};
  let hasNew = false;
  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) {
      stored[key] = value;
      hasNew = true;
    }
  });
  if (hasNew) {
    try {
      localStorage.setItem("clyon_utms", JSON.stringify(stored));
    } catch {
      /* ignore */
    }
  }
}

function getStoredUtms(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("clyon_utms");
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const AREAS = [
  "Lisboa",
  "Amadora",
  "Odivelas",
  "Loures",
  "Oeiras",
  "Cascais",
  "Sintra",
  "Almada",
  "Seixal",
  "Barreiro",
  "Montijo",
  "Moita",
  "Setúbal",
  "Sesimbra",
  "Palmela",
  "Quinta do Conde",
  "Fernão Ferro",
  "Amora",
  "Corroios",
];

const FAQ_ITEMS = [
  {
    q: "Como peço orçamento?",
    a: "É simples: envie fotos do material pelo WhatsApp, indique a morada ou localidade e diga se há escadas, elevador ou acesso difícil. Com essas informações a CLYON avalia o volume e envia-lhe uma estimativa.",
  },
  {
    q: "O orçamento é gratuito?",
    a: "Sim. O pedido de orçamento é totalmente gratuito e sem compromisso. Só paga se decidir avançar com o serviço de recolha.",
  },
  {
    q: "O serviço de recolha é pago?",
    a: "Sim. A recolha é um serviço privado e pago. O valor é definido conforme o volume, o peso, a localização, o acesso e o tipo de material a recolher.",
  },
  {
    q: "A equipa carrega os materiais?",
    a: "Sim. A equipa trata de todo o carregamento e transporte. Não precisa de descer nem preparar nada — fazemos o trabalho pesado por si.",
  },
  {
    q: "Posso enviar fotos pelo WhatsApp?",
    a: "Sim, e é a forma mais rápida de receber uma estimativa. As fotos ajudam a avaliar o volume e o acesso, tornando o orçamento mais certo.",
  },
  {
    q: "Fazem recolha urgente?",
    a: "Sim, mediante disponibilidade da equipa. Serviços urgentes ou no próprio dia podem ter um custo adicional. Indique a urgência no pedido.",
  },
  {
    q: "Recolhem entulho de obra?",
    a: "Sim. Recolhemos sacos de obra, restos de remodelação, madeira, tijolo, azulejo e cimento, desde que não envolvam materiais perigosos.",
  },
  {
    q: "Que materiais não recolhem?",
    a: "Não recolhemos amianto, químicos, resíduos perigosos ou contaminados, nem fazemos demolição pesada. Em caso de dúvida, envie foto para confirmarmos.",
  },
  {
    q: "Quais zonas atendem?",
    a: "Atendemos Lisboa, Grande Lisboa, Margem Sul e Setúbal. Se a sua localidade não constar da lista, envie mensagem para confirmarmos a disponibilidade.",
  },
];

function WhatsAppIcon({ className }: { className?: string }) {
  return <MessageCircle className={className} aria-hidden="true" />;
}

export default function LandingClient() {
  const [showStickyBar, setShowStickyBar] = useState(false);
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    captureUtms();
    pushDataLayer({ event: "page_view_landing" });
  }, []);

  useEffect(() => {
    const node = heroRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-white text-slate-900" style={{ zoom: 0.89 }}>
      <TopBar />
      <Hero heroRef={heroRef} />
      <TrustBar />
      <HowItWorks />
      <SendForQuote />
      <ServicesSection />
      <PricingGuide />
      <WhyChooseSection />
      <ReviewsSection />
      <AreasSection />
      <FAQSection />
      <FinalCTA />
      <StickyMobileCTA visible={showStickyBar} />
      <FloatingWhatsAppButton />
      <div className="h-20 md:h-0" aria-hidden="true" />
    </div>
  );
}

/* ----------------------------- Top Bar ----------------------------- */
function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-clyon-landing.png"
            alt="CLYON - Recolha de móveis e entulho em Lisboa"
            width={150}
            height={48}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">
            Lisboa • Margem Sul • Setúbal
          </span>
        </div>
        <a
          href={`${WHATSAPP_BASE}?text=${encodeURIComponent("Olá CLYON, gostaria de pedir um orçamento.")}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsApp("top_bar")}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
        >
          <WhatsAppIcon className="h-4 w-4" />
          WhatsApp
        </a>
      </div>
    </header>
  );
}

/* ------------------------------ Hero ------------------------------ */
function Hero({ heroRef }: { heroRef: React.RefObject<HTMLDivElement | null> }) {
  const bullets = [
    { icon: Truck, label: "Carregamento feito pela equipa" },
    { icon: MapPin, label: "Lisboa, Margem Sul e Setúbal" },
    { icon: ShieldCheck, label: "Serviço privado, rápido e profissional" },
  ];

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden bg-gradient-to-b from-cyan-50/60 via-white to-white"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-cyan-100/40 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2 lg:items-start lg:py-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Orçamento rápido por WhatsApp
          </span>
          <h1 className="mt-4 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Recolha de Entulho, Móveis e Monos em Lisboa
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
            Envie fotos, indique a morada e receba uma estimativa para recolha
            com carregamento e transporte incluídos.
          </p>

          <ul className="mt-6 space-y-3">
            {bullets.map((bullet) => (
              <li
                key={bullet.label}
                className="flex items-center gap-3 text-sm font-medium text-slate-700 sm:text-base"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                  <bullet.icon className="h-4 w-4" />
                </span>
                {bullet.label}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href={`${WHATSAPP_BASE}?text=${encodeURIComponent("Olá CLYON, gostaria de pedir um orçamento. Vou enviar fotos do material.")}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsApp("hero")}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Enviar Fotos no WhatsApp
            </a>
            <a
              href={`tel:${PHONE_TEL}`}
              onClick={() => trackCall("hero")}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-800 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700"
            >
              <Phone className="h-5 w-5" />
              Ligar Agora
            </a>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Pedido de orçamento gratuito. Serviço de recolha pago mediante
            avaliação.
          </p>

          <DirectContactStrip />
        </div>

        <div className="lg:pl-4">
          <LeadForm />
        </div>
      </div>
    </section>
  );
}

/* --------------------- Direct Contact Strip --------------------- */
function DirectContactStrip() {
  const quickMsg = encodeURIComponent(
    "Olá CLYON, gostaria de pedir um orçamento.",
  );
  const buttons = [
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: `${WHATSAPP_BASE}?text=${quickMsg}`,
      external: true,
      onClick: () => trackWhatsApp("hero_direct"),
    },
    {
      label: "Ligar",
      icon: Phone,
      href: `tel:${PHONE_TEL}`,
      external: false,
      onClick: () => trackCall("hero_direct"),
    },
    {
      label: "SMS",
      icon: MessageSquare,
      href: `sms:${PHONE_SMS}`,
      external: false,
      onClick: () => trackSms("hero_direct"),
    },
    {
      label: "Email",
      icon: Mail,
      href: `mailto:${EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`,
      external: false,
      onClick: () => trackEmail("hero_direct"),
    },
  ];

  return (
    <div className="mt-7 rounded-2xl border border-slate-200 bg-white/70 p-4">
      <p className="text-sm font-semibold text-slate-700">
        Prefere falar diretamente?
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {buttons.map((btn) => (
          <a
            key={btn.label}
            href={btn.href}
            onClick={btn.onClick}
            {...(btn.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700"
          >
            <btn.icon className="h-5 w-5 text-cyan-600" />
            {btn.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Simulator CTA Card ------------------------- */
function LeadForm() {
  function handleOpenSimulator() {
    const utms = getStoredUtms();
    pushDataLayer({
      event: "lead_form_submit",
      form_name: "orcamento_recolha",
      cta: "abrir_simulador",
      ...utms,
    });
    trackLeadConversion();
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-300/40 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Peça o seu orçamento
          </h2>
          <p className="text-xs text-slate-500">
            Calcule o preço em 3 passos, sem compromisso.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
        <li className="flex items-center gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700">1</span>
          Escolha o serviço
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700">2</span>
          Indique a morada e o acesso
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700">3</span>
          Deixe o seu contacto e envie
        </li>
      </ul>

      <a
        href="/simulador"
        onClick={handleOpenSimulator}
        className="mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600"
      >
        <Sparkles className="h-5 w-5" />
        Abrir Simulador de Orçamento
      </a>
      <p className="mt-3 text-center text-xs text-slate-500">
        Prefere enviar fotos diretamente? Use o WhatsApp abaixo.
      </p>
      <p className="text-center text-xs text-slate-400">
        O pedido de orçamento é gratuito. O serviço de recolha é pago mediante
        avaliação.
      </p>
    </div>
  );
}

/* --------------------------- Trust Bar --------------------------- */
function TrustBar() {
  const items = [
    {
      icon: Star,
      title: `${REVIEWS_COUNT} avaliações 5 estrelas`,
      highlight: true,
    },
    { icon: BadgeCheck, title: "Orçamento gratuito" },
    { icon: Clock, title: "Resposta rápida" },
    { icon: Truck, title: "Carregamento incluído" },
    { icon: MapPin, title: "Lisboa, Margem Sul e Setúbal" },
  ];

  return (
    <section className="border-y border-slate-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm"
            >
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  item.highlight
                    ? "bg-amber-50 text-amber-500"
                    : "bg-cyan-50 text-cyan-600"
                }`}
              >
                <item.icon
                  className="h-5 w-5"
                  fill={item.highlight ? "currentColor" : "none"}
                />
              </span>
              <span className="text-xs font-semibold leading-tight text-slate-700">
                {item.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Section Title --------------------------- */
function SectionTitle({
  eyebrow,
  title,
  subtitle,
  dark = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow ? (
        <span
          className={`text-xs font-bold uppercase tracking-[0.18em] ${dark ? "text-cyan-400" : "text-cyan-600"}`}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={`mt-2 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl ${dark ? "text-white" : "text-slate-900"}`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mt-3 text-pretty text-base leading-relaxed ${dark ? "text-slate-300" : "text-slate-600"}`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------- How It Works --------------------------- */
function HowItWorks() {
  const steps = [
    {
      icon: Camera,
      title: "Envie fotos",
      text: "Mostre o volume e o tipo de material pelo WhatsApp.",
    },
    {
      icon: MapPin,
      title: "Informe a morada",
      text: "Diga a localidade e o tipo de acesso ao local.",
    },
    {
      icon: BadgeCheck,
      title: "Receba o orçamento",
      text: "A CLYON avalia o serviço e envia uma estimativa clara.",
    },
    {
      icon: Truck,
      title: "Agende a recolha",
      text: "A equipa vai ao local, carrega e transporta tudo.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
      <SectionTitle eyebrow="Simples e rápido" title="Como funciona" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <span className="absolute right-5 top-4 text-4xl font-extrabold text-slate-100">
              {index + 1}
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
              <step.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {step.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- Send For Quote --------------------------- */
function SendForQuote() {
  const cards = [
    {
      icon: Camera,
      title: "Fotos do material",
      text: "Imagens claras do que precisa recolher.",
    },
    {
      icon: MapPin,
      title: "Morada ou localidade",
      text: "Onde está o material a recolher.",
    },
    {
      icon: Building2,
      title: "Escadas ou elevador",
      text: "Informação sobre o acesso ao local.",
    },
    {
      icon: Clock,
      title: "Urgência do serviço",
      text: "Quando precisa que a recolha aconteça.",
    },
  ];

  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Pré-qualificação"
          title="Para receber um orçamento mais certo, envie:"
          subtitle="Com estas informações, a CLYON consegue avaliar volume, acesso e logística com mais precisão."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
            >
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <card.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                {card.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {card.text}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <a
            href={`${WHATSAPP_BASE}?text=${encodeURIComponent("Olá CLYON, gostaria de um orçamento. Vou enviar fotos do material.")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsApp("send_for_quote")}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-emerald-600"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Enviar Fotos Agora
          </a>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Services --------------------------- */
function ServicesSection() {
  const services = [
    {
      icon: Trash2,
      title: "Recolha de Entulho",
      text: "Remoção de resíduos de obra e remodelação.",
      examples: ["Sacos de obra", "Madeira e tijolo", "Azulejo e cimento"],
    },
    {
      icon: Sofa,
      title: "Recolha de Móveis",
      text: "Retirada de mobiliário usado de qualquer divisão.",
      examples: ["Sofás e camas", "Armários e mesas", "Colchões e cadeiras"],
    },
    {
      icon: Package,
      title: "Recolha de Monos",
      text: "Remoção de objetos volumosos e tralha acumulada.",
      examples: [
        "Eletrodomésticos",
        "Materiais de garagem",
        "Arrecadações cheias",
      ],
    },
    {
      icon: Home,
      title: "Esvaziamento de Casas",
      text: "Limpeza completa de imóveis e espaços.",
      examples: ["Heranças", "Mudanças", "Imóveis para venda"],
    },
    {
      icon: Sparkles,
      title: "Limpeza Pós-Obra",
      text: "Remoção de resíduos e limpeza após obras.",
      examples: ["Restos de obra", "Pó e detritos", "Espaços remodelados"],
    },
  ];

  function handleCardCta(service: string) {
    pushDataLayer({ event: "service_card_click", service_name: service });
    trackWhatsApp("service_card");
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
      <SectionTitle
        eyebrow="O que recolhemos"
        title="Serviços de recolha e esvaziamento"
        subtitle="Soluções para particulares e empresas em toda a região de Lisboa, Margem Sul e Setúbal."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.title}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 transition group-hover:bg-cyan-100">
              <service.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {service.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {service.text}
            </p>
            <ul className="mt-4 space-y-2">
              {service.examples.map((ex) => (
                <li
                  key={ex}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                  {ex}
                </li>
              ))}
            </ul>
            <a
              href={`${WHATSAPP_BASE}?text=${encodeURIComponent(`Olá CLYON, gostaria de um orçamento para ${service.title}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleCardCta(service.title)}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 transition group-hover:gap-2.5"
            >
              Pedir orçamento
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- Pricing Guide --------------------------- */
function PricingGuide() {
  const cards = [
    {
      title: "Entulho",
      text: "Avaliado por volume, peso e acesso ao local.",
      icon: Trash2,
    },
    {
      title: "Móveis e monos",
      text: "Avaliado por quantidade e tipo de material.",
      icon: Sofa,
    },
    {
      title: "Esvaziamento",
      text: "Avaliado conforme número de divisões e volume.",
      icon: Home,
    },
    {
      title: "Pós-obra",
      text: "Avaliado conforme área, resíduos e limpeza necessária.",
      icon: Sparkles,
    },
  ];

  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Valores orientativos"
          title="Quanto custa a recolha?"
          subtitle="O valor depende do volume, peso, localização, acesso, distância até à carrinha, necessidade de desmontagem e urgência."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <card.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                {card.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {card.text}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <a
            href={`${WHATSAPP_BASE}?text=${encodeURIComponent("Olá CLYON, gostaria de uma estimativa. Vou enviar fotos.")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsApp("pricing")}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-emerald-600"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Enviar fotos para estimativa
          </a>
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-slate-500">
          O pedido de orçamento é gratuito. O serviço de recolha é pago mediante
          avaliação. Valores podem não incluir IVA, quando aplicável.
        </p>
      </div>
    </section>
  );
}

/* --------------------------- Why Choose --------------------------- */
function WhyChooseSection() {
  const items = [
    { icon: MapPin, label: "Empresa local" },
    { icon: Users, label: "Equipa preparada para carregar" },
    { icon: MessageCircle, label: "Atendimento por WhatsApp" },
    { icon: Building2, label: "Serviço para particulares e empresas" },
    { icon: ShieldCheck, label: "Cobertura em Lisboa, Margem Sul e Setúbal" },
    { icon: Camera, label: "Orçamento simples mediante fotos" },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
      <SectionTitle
        eyebrow="Confiança"
        title="Porque escolher a CLYON?"
        subtitle="Ajudamos particulares e empresas a libertar espaço com recolha profissional e orçamento simples."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- Reviews --------------------------- */
function ReviewsSection() {
  const reviews = [
    {
      text: "Serviço de recolha rápido e a equipa tratou de todo o carregamento. Recomendo.",
      name: "Cliente CLYON",
      detail: "Avaliação real do Google",
    },
    {
      text: "Pedi orçamento por WhatsApp com fotos e tive resposta no próprio dia. Muito prático.",
      name: "Cliente CLYON",
      detail: "Serviço de recolha em Lisboa",
    },
    {
      text: "Esvaziamento de casa feito com profissionalismo e sem complicações. Bom atendimento.",
      name: "Cliente CLYON",
      detail: "Avaliação real do Google",
    },
  ];

  return (
    <section className="bg-slate-50 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Testemunhos"
          title="O que dizem os clientes"
        />
        <div className="mt-5 flex items-center justify-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className="h-5 w-5 text-amber-400"
                fill="currentColor"
              />
            ))}
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {REVIEWS_COUNT} avaliações 5 estrelas
          </span>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {reviews.map((review, index) => (
            <div
              key={index}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <Quote className="h-7 w-7 text-cyan-200" />
              <div className="mt-3 flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 text-amber-400"
                    fill="currentColor"
                  />
                ))}
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">
                {review.text}
              </p>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-sm font-bold text-slate-900">
                  {review.name}
                </p>
                <p className="text-xs text-slate-500">{review.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Areas --------------------------- */
function AreasSection() {
  return (
    <section className="bg-slate-900 py-14 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">
          Áreas atendidas
        </span>
        <h2 className="mt-2 text-balance text-2xl font-extrabold text-white sm:text-3xl">
          Atendimento em Lisboa, Margem Sul e Setúbal
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {AREAS.map((area) => (
            <span
              key={area}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white"
            >
              {area}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-xl text-sm text-slate-300">
          Se a sua localidade não estiver na lista, envie mensagem para
          confirmar disponibilidade.
        </p>
      </div>
    </section>
  );
}

/* --------------------------- FAQ --------------------------- */
function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  function toggle(index: number) {
    const next = open === index ? null : index;
    setOpen(next);
    if (next !== null) {
      pushDataLayer({
        event: "faq_open",
        question: FAQ_ITEMS[index].q,
      });
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
      <SectionTitle eyebrow="Dúvidas frequentes" title="Perguntas e respostas" />
      <div className="mt-8 space-y-3">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = open === index;
          return (
            <div
              key={item.q}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-slate-900 sm:text-base">
                  {item.q}
                </span>
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-cyan-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------- Final CTA --------------------------- */
function FinalCTA() {
  return (
    <section className="bg-slate-900 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Precisa libertar espaço?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate-300">
          Envie fotos agora e receba uma estimativa para recolha de entulho,
          móveis, monos ou limpeza pós-obra.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`${WHATSAPP_BASE}?text=${encodeURIComponent("Olá CLYON, gostaria de pedir um orçamento. Vou enviar fotos do material.")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsApp("final_cta")}
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Enviar Fotos no WhatsApp
          </a>
          <a
            href={`tel:${PHONE_TEL}`}
            onClick={() => trackCall("final_cta")}
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/10"
          >
            <Phone className="h-5 w-5" />
            Ligar para a CLYON
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-400">{PHONE_DISPLAY}</p>
      </div>
    </section>
  );
}

/* --------------------------- Sticky Mobile CTA --------------------------- */
function StickyMobileCTA({ visible }: { visible: boolean }) {
  const [showMore, setShowMore] = useState(false);
  const quickMsg = encodeURIComponent(
    "Olá CLYON, gostaria de pedir um orçamento.",
  );

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      } transition-transform duration-300`}
    >
      {showMore ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setShowMore(false)}
          className="fixed inset-0 z-0 bg-slate-900/20"
        />
      ) : null}

      {showMore ? (
        <div className="relative z-10 mx-3 mb-2 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <a
            href={`sms:${PHONE_SMS}?body=${quickMsg}`}
            onClick={() => {
              trackSms("sticky_mobile");
              setShowMore(false);
            }}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <MessageSquare className="h-5 w-5" />
            SMS
          </a>
          <a
            href={`mailto:${EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`}
            onClick={() => {
              trackEmail("sticky_mobile");
              setShowMore(false);
            }}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <Mail className="h-5 w-5" />
            Email
          </a>
        </div>
      ) : null}

      <div className="relative z-10 flex gap-2 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.2)]">
        <a
          href={`${WHATSAPP_BASE}?text=${quickMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsApp("sticky_mobile")}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-3 text-sm font-semibold text-white"
        >
          <WhatsAppIcon className="h-5 w-5" />
          WhatsApp
        </a>
        <a
          href={`tel:${PHONE_TEL}`}
          onClick={() => trackCall("sticky_mobile")}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-3 text-sm font-semibold text-white"
        >
          <Phone className="h-5 w-5" />
          Ligar
        </a>
        <button
          type="button"
          onClick={() => setShowMore((prev) => !prev)}
          aria-label="Mais opções de contacto"
          aria-expanded={showMore}
          className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
        >
          <MoreHorizontal className="h-5 w-5" />
          Mais
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Floating WhatsApp --------------------------- */
function FloatingWhatsAppButton() {
  return (
    <a
      href={`${WHATSAPP_BASE}?text=${encodeURIComponent("Olá CLYON, gostaria de pedir um orçamento.")}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsApp("floating_button")}
      aria-label="Contactar via WhatsApp"
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-600 md:flex"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
