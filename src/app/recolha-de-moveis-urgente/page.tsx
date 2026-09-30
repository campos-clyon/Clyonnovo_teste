import type { Metadata } from "next";
// Com outro nome: esta página já tem uma constante `jsonLd`, que é o objecto.
import { jsonLd as paraScriptJsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
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
import { PRESTADOR } from "@/lib/dados-estruturados";

import {
  ACRESCIMO_POR_URGENCIA,
  AO_FIM_DE_SEMANA,
  DESMONTAGEM_A_PEDIDO,
  NO_MESMO_DIA,
  PROPOSTAS_EM_ATE,
  RECEBE_PROPOSTAS,
} from "@/lib/promessas-publicas";

/*
 * 30-09-2026: o título dizia «— Hoje», a FAQ «resposta em menos de 1 hora» e
 * «a urgência não implica custo adicional», e a landing do lado dizia que
 * podia ter. O que a CLYON cumpre é o prazo das propostas; a data e o
 * acréscimo por urgência são do profissional, e vêm na proposta dele.
 */
export const metadata: Metadata = {
  title: "Recolha de Móveis Urgente em Lisboa: Propostas em 6h",
  description:
    "Recolha de móveis urgente em Lisboa, Margem Sul e Setúbal. Diga a urgência no pedido e receba propostas de profissionais da zona em menos de 6 horas.",
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
  openGraph: og({
    title: "Recolha de Móveis Urgente em Lisboa: Propostas em 6h",
    description:
      "Recolha de móveis urgente em Lisboa, Margem Sul e Setúbal. Diga a urgência no pedido e receba propostas de profissionais da zona em menos de 6 horas.",
    url: "https://clyon.pt/recolha-de-moveis-urgente",
  }),
};

const faqs = [
  {
    question: "Conseguem recolher móveis hoje?",
    answer: NO_MESMO_DIA,
  },
  {
    question: "Quanto tempo demora a receber resposta?",
    answer: `${RECEBE_PROPOSTAS} A data do trabalho combina-se com o profissional que escolher — diga no pedido para quando precisa.`,
  },
  {
    question: "A recolha urgente tem custo extra?",
    answer: `O preço depende do volume, do tipo de móveis, dos acessos e da necessidade de desmontagem. ${ACRESCIMO_POR_URGENCIA}`,
  },
  {
    question: "Fazem desmontagem em pedidos urgentes?",
    answer: `Sim, mesmo em recolhas urgentes. ${DESMONTAGEM_A_PEDIDO}`,
  },
  {
    question: "Recolhem ao fim de semana?",
    answer: AO_FIM_DE_SEMANA,
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
    title: "Contacto direto",
    description: "Ligue, envie WhatsApp ou preencha o formulário com fotos e morada.",
  },
  {
    step: "02",
    title: "Receba propostas",
    description: `Profissionais da zona respondem ${PROPOSTAS_EM_ATE}, com o preço e a data que propõem.`,
  },
  {
    step: "03",
    title: "Recolha no local",
    description: "O profissional que escolher chega, desmonta se o pedir, carrega e transporta tudo.",
  },
];

const internalLinks = [
  { href: "/recolha-de-moveis", label: "Recolha de Móveis", desc: "Página principal" },
  { href: "/recolha-de-sofas", label: "Recolha de Sofás", desc: "Sofás e cadeirões" },
  { href: "/recolha-de-camas", label: "Recolha de Camas", desc: "Camas e colchões" },
  { href: "/recolha-de-armarios", label: "Recolha de Armários", desc: "Armários e roupeiros" },
  { href: "/recolha-de-eletrodomesticos", label: "Eletrodomésticos", desc: "Máquinas e frigoríficos" },
  // Âncora: era «Gratuita vs Privada» (29-09-2026, ver FurnitureSeoLinks).
  { href: "/recolha-gratuita-de-moveis-usados", label: "Doar móveis usados", desc: "Quem recolhe de graça" },
];

export default function RecolhaMoveisUrgentePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Recolha de Móveis Urgente",
        description:
          "Recolha de móveis urgente em Lisboa, Margem Sul e Setúbal por profissionais da zona, com carregamento porta a porta e propostas em menos de 6 horas.",
        // O prestador é o LocalBusiness do layout, por @id — e não uma cópia
        // sem morada (ou com uma morada inventada) em cada página (29-09-2026).
        provider: PRESTADOR,
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
        dangerouslySetInnerHTML={{ __html: paraScriptJsonLd(jsonLd) }}
      />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
            <Clock className="h-4 w-4" />
            Propostas em menos de 6 horas
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Recolha de móveis urgente em Lisboa, Margem Sul e Setúbal
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-slate-600">
            Precisa de retirar móveis com urgência? Diga a data no pedido e recebe propostas de profissionais
            da zona {PROPOSTAS_EM_ATE}; a data do trabalho combina-se com quem escolher. Carregamento e transporte
            fazem parte da recolha, e a desmontagem pode ser pedida.
          </p>

          {/* CTAs acima da dobra */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/simulador"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-acao px-6 text-[0.9375rem] font-semibold text-white transition hover:bg-acao-hover"
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
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-acao" />
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-acao">
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
              O que se recolhe com urgência
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
                  <Truck className="h-4 w-4 text-acao" />
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
                    <h3 className="font-semibold text-slate-900 group-hover:text-acao-hover">
                      {link.label}
                    </h3>
                    <p className="text-sm text-slate-500">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-tinta-fraca group-hover:text-acao-hover" />
                </Link>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href="/simulador"
                className="inline-flex items-center gap-2 text-sm font-medium text-acao hover:text-cyan-800"
              >
                Simular orçamento agora
              </Link>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="rounded-2xl bg-acao px-8 py-10 text-center text-white">
            <h2 className="text-2xl font-bold">Precisa de recolha urgente?</h2>
            <p className="mt-2 text-cyan-100">
              {RECEBE_PROPOSTAS} A data combina-se com o profissional.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="tel:+351931632622"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 font-semibold text-acao transition hover:bg-cyan-50"
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
