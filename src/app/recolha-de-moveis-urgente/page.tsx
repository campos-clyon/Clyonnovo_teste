import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageCircle,
  Phone,
  Truck,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Recolha de Móveis Urgente Lisboa | Resposta Rápida | CLYON",
  description:
    "Recolha de móveis urgente em Lisboa, Margem Sul e Setúbal. Resposta no próprio dia, desmontagem incluída e carregamento porta a porta. Ligue agora: 931 632 622.",
  keywords: [
    "recolha de móveis urgente",
    "recolha de móveis urgente Lisboa",
    "recolha urgente de sofá",
    "retirar móveis hoje",
    "recolha de móveis no próprio dia",
    "recolha de móveis rápida",
  ],
  alternates: {
    canonical: "https://clyon.pt/recolha-de-moveis-urgente",
  },
  openGraph: {
    title: "Recolha de Móveis Urgente Lisboa | Resposta Rápida | CLYON",
    description:
      "Recolha de móveis urgente em Lisboa, Margem Sul e Setúbal. Resposta no próprio dia, desmontagem incluída e carregamento porta a porta.",
    url: "https://clyon.pt/recolha-de-moveis-urgente",
    siteName: "CLYON",
    locale: "pt_PT",
    type: "website",
  },
};

const faqs = [
  {
    question: "Conseguem recolher móveis hoje?",
    answer:
      "Sim, quando existe disponibilidade operacional conseguimos responder no próprio dia. A forma mais rápida de confirmar é ligar para o 931 632 622 ou enviar mensagem no WhatsApp com fotos e morada.",
  },
  {
    question: "Qual é o tempo médio de resposta?",
    answer:
      "Em pedidos urgentes, a resposta comercial costuma ser dada em menos de 1 hora. A execução depende da agenda e localização, mas muitos pedidos em Lisboa e Margem Sul são tratados no próprio dia ou no dia seguinte.",
  },
  {
    question: "A recolha urgente tem custo extra?",
    answer:
      "O orçamento depende do volume, tipo de móveis, acessos e necessidade de desmontagem. A urgência por si só não implica custo adicional, mas disponibilidade imediata pode influenciar a priorização.",
  },
  {
    question: "Fazem desmontagem em pedidos urgentes?",
    answer:
      "Sim. A equipa desmonta armários, camas e outros móveis quando necessário, mesmo em recolhas urgentes. Basta indicar no pedido o que precisa de desmontagem.",
  },
  {
    question: "Recolhem ao fim de semana?",
    answer:
      "A operação funciona maioritariamente em dias úteis, mas em casos urgentes pode haver disponibilidade ao sábado. Contacte-nos para verificar.",
  },
];

const whenToHire = [
  "Entrega de chaves de imóvel com prazo apertado",
  "Mudança de última hora com móveis para deixar",
  "Obra a começar e mobília ainda no local",
  "Despejo urgente por fim de arrendamento",
  "Venda de casa com necessidade de esvaziamento rápido",
];

const howItWorks = [
  {
    step: "01",
    title: "Contacto directo",
    description: "Ligue, envie WhatsApp ou preencha o formulário com fotos e morada.",
  },
  {
    step: "02",
    title: "Resposta rápida",
    description: "Recebe orçamento claro com janela de execução disponível.",
  },
  {
    step: "03",
    title: "Execução no local",
    description: "Equipa chega, desmonta se necessário, carrega e transporta tudo.",
  },
];

const internalLinks = [
  { href: "/recolha-de-moveis", label: "Recolha de Móveis", desc: "Página principal" },
  { href: "/recolha-de-sofas", label: "Recolha de Sofás", desc: "Sofás e cadeirões" },
  { href: "/recolha-de-camas", label: "Recolha de Camas", desc: "Camas e colchões" },
  { href: "/recolha-de-armarios", label: "Recolha de Armários", desc: "Armários e roupeiros" },
  { href: "/recolha-de-eletrodomesticos", label: "Eletrodomésticos", desc: "Máquinas e frigoríficos" },
  { href: "/recolha-gratuita-de-moveis-usados", label: "Gratuita vs Privada", desc: "Comparação" },
];

export default function RecolhaMoveisUrgentePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Recolha de Móveis Urgente",
        description:
          "Recolha de móveis urgente em Lisboa, Margem Sul e Setúbal com resposta no próprio dia, desmontagem incluída e carregamento porta a porta.",
        provider: {
          "@type": "LocalBusiness",
          name: "CLYON",
          telephone: "+351931632622",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Lisboa",
            addressCountry: "PT",
          },
        },
        areaServed: ["Lisboa", "Margem Sul", "Setúbal"],
        serviceType: "Recolha de Móveis Urgente",
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: "https://clyon.pt" },
          { "@type": "ListItem", position: 2, name: "Recolha de Móveis", item: "https://clyon.pt/recolha-de-moveis" },
          { "@type": "ListItem", position: 3, name: "Recolha Urgente", item: "https://clyon.pt/recolha-de-moveis-urgente" },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
            <Clock className="h-4 w-4" />
            Resposta no próprio dia
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Recolha de móveis urgente em Lisboa, Margem Sul e Setúbal
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-slate-600">
            Precisa de retirar móveis com urgência? A CLYON responde no próprio dia quando há disponibilidade.
            Desmontagem, carregamento e transporte incluídos. Contacte agora para verificar disponibilidade imediata.
          </p>

          {/* CTAs acima da dobra */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/simulador"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-6 text-[0.9375rem] font-semibold text-white transition hover:bg-cyan-700"
            >
              <Zap className="h-4 w-4" />
              Simular Orçamento
            </Link>
            <a
              href="tel:+351931632622"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 text-[0.9375rem] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Phone className="h-4 w-4" />
              931 632 622
            </a>
            <a
              href="https://wa.me/351931632622?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20m%C3%B3veis%20urgente."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 text-[0.9375rem] font-semibold text-white transition hover:bg-emerald-600"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Urgente
            </a>
          </div>
        </section>

        {/* Quando contratar */}
        <section className="bg-slate-50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Quando contratar recolha urgente de móveis
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {whenToHire.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
                  <span className="text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Como funciona a recolha urgente
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {howItWorks.map((step) => (
              <div key={step.step} className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-cyan-700">
                  {step.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* O que recolhemos */}
        <section className="bg-slate-50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              O que recolhemos com urgência
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "Sofás e cadeirões",
                "Camas, estrados e colchões",
                "Armários e roupeiros",
                "Mesas e cadeiras",
                "Secretárias e estantes",
                "Eletrodomésticos grandes",
                "Recheios completos",
                "Móveis de escritório",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <Truck className="h-4 w-4 text-cyan-600" />
                  <span className="text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Dúvidas sobre recolha urgente
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">{faq.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Links internos */}
        <section className="bg-slate-50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Outros serviços de recolha de móveis
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {internalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-200 hover:shadow-sm"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-cyan-700">
                      {link.label}
                    </h3>
                    <p className="text-sm text-slate-500">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-600" />
                </Link>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href="/simulador"
                className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-800"
              >
                Simular orçamento agora
              </Link>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="rounded-2xl bg-cyan-600 px-8 py-10 text-center text-white">
            <h2 className="text-2xl font-bold">Precisa de recolha urgente?</h2>
            <p className="mt-2 text-cyan-100">
              Contacte agora para verificar disponibilidade imediata.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="tel:+351931632622"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 font-semibold text-cyan-700 transition hover:bg-cyan-50"
              >
                <Phone className="h-4 w-4" />
                <span>Ligar Agora</span>
              </a>
              <a
                href="https://wa.me/351931632622?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20m%C3%B3veis%20urgente."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 font-semibold text-white transition hover:bg-emerald-600"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
