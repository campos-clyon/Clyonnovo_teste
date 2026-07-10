import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Home,
  MessageCircle,
  Phone,
  Recycle,
  Truck,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Retirar Móveis Velhos Lisboa, Margem Sul e Setúbal | CLYON",
  description:
    "Precisa de retirar móveis velhos? A CLYON retira sofás, camas, armários e eletrodomésticos antigos em Lisboa, Margem Sul e Setúbal. Orçamento grátis: 931 632 622.",
  keywords: [
    "retirar móveis velhos",
    "retirar móveis velhos Lisboa",
    "levar móveis velhos",
    "recolha de móveis velhos",
    "despejo de móveis antigos",
    "retirar móveis usados",
  ],
  alternates: {
    canonical: "https://clyon.pt/retirar-moveis-velhos",
  },
  openGraph: {
    title: "Retirar Móveis Velhos Lisboa, Margem Sul e Setúbal | CLYON",
    description:
      "Precisa de retirar móveis velhos? A CLYON retira sofás, camas, armários e eletrodomésticos antigos com desmontagem e carregamento incluídos.",
    url: "https://clyon.pt/retirar-moveis-velhos",
    siteName: "CLYON",
    locale: "pt_PT",
    type: "website",
  },
};

const faqs = [
  {
    question: "Que móveis velhos podem retirar?",
    answer:
      "Retiramos praticamente todo o tipo de móvel velho: sofás, camas, colchões, armários, mesas, cadeiras, estantes, secretárias, eletrodomésticos grandes e pequenos, e outros volumes. Se tiver dúvida sobre um item específico, envie foto.",
  },
  {
    question: "Retiram móveis de dentro de casa?",
    answer:
      "Sim. A equipa entra no imóvel, desmonta o que for necessário, carrega e transporta. Não precisa de colocar os móveis no exterior.",
  },
  {
    question: "Quanto custa retirar móveis velhos?",
    answer:
      "O valor depende do volume, tipo de móveis, acessos (escadas, elevador, rua) e necessidade de desmontagem. Para um sofá ou cama com acesso fácil, os valores começam a partir de 35-45 €. Envie fotos para orçamento exacto.",
  },
  {
    question: "Retiram no mesmo dia?",
    answer:
      "Quando há disponibilidade operacional, sim. Muitos pedidos em Lisboa, Margem Sul e Setúbal são tratados no próprio dia ou no dia seguinte.",
  },
  {
    question: "Qual é o destino dos móveis velhos?",
    answer:
      "Móveis em condições são encaminhados para reaproveitamento ou doação. Móveis danificados vão para reciclagem ou destino adequado conforme o tipo de material.",
  },
];

const whenToHire = [
  "Renovação de casa com mobília antiga para retirar",
  "Mudança com móveis que não vão para a nova casa",
  "Herança com recheio para esvaziar",
  "Móveis partidos, danificados ou com pragas",
  "Fim de arrendamento com imóvel para entregar vazio",
  "Compra de móveis novos com antigos para sair",
];

const howItWorks = [
  {
    step: "01",
    title: "Envie o pedido",
    description: "Fotografe os móveis, indique a morada, andar e acessos disponíveis.",
  },
  {
    step: "02",
    title: "Receba orçamento",
    description: "Resposta rápida com valor claro e janela de execução disponível.",
  },
  {
    step: "03",
    title: "Retirada no local",
    description: "Equipa chega, desmonta, carrega e transporta para destino adequado.",
  },
];

const furnitureTypes = [
  "Sofás e cadeirões velhos",
  "Camas, estrados e colchões",
  "Armários e roupeiros antigos",
  "Mesas e cadeiras",
  "Estantes e secretárias",
  "Frigoríficos e máquinas",
  "Móveis de escritório",
  "Recheios completos",
];

const internalLinks = [
  { href: "/recolha-de-moveis", label: "Recolha de Móveis", desc: "Página principal" },
  { href: "/recolha-de-sofas", label: "Recolha de Sofás", desc: "Sofás e cadeirões" },
  { href: "/recolha-de-camas", label: "Recolha de Camas", desc: "Camas e colchões" },
  { href: "/recolha-de-armarios", label: "Recolha de Armários", desc: "Armários e roupeiros" },
  { href: "/recolha-de-eletrodomesticos", label: "Eletrodomésticos", desc: "Máquinas e frigoríficos" },
  { href: "/recolha-gratuita-de-moveis-usados", label: "Gratuita vs Privada", desc: "Comparação" },
];

export default function RetirarMoveisVelhosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Retirar Móveis Velhos",
        description:
          "Serviço de retirada de móveis velhos em Lisboa, Margem Sul e Setúbal com desmontagem, carregamento e transporte incluídos.",
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
        serviceType: "Retirada de Móveis Velhos",
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
          { "@type": "ListItem", position: 3, name: "Retirar Móveis Velhos", item: "https://clyon.pt/retirar-moveis-velhos" },
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
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <Recycle className="h-4 w-4" />
            Desmontagem e carregamento incluídos
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Retirar móveis velhos em Lisboa, Margem Sul e Setúbal
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-slate-600">
            Precisa de retirar móveis velhos? A CLYON faz a retirada completa: entra no imóvel,
            desmonta o necessário, carrega e transporta para destino adequado. Sem complicações
            e sem precisar de colocar nada no exterior.
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
              href="https://wa.me/351931632622?text=Ol%C3%A1!%20Preciso%20de%20retirar%20m%C3%B3veis%20velhos."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 text-[0.9375rem] font-semibold text-white transition hover:bg-emerald-600"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </section>

        {/* Quando contratar */}
        <section className="bg-slate-50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Quando contratar retirada de móveis velhos
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
            Como funciona a retirada de móveis velhos
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

        {/* O que retiramos */}
        <section className="bg-slate-50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Que móveis velhos retiramos
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {furnitureTypes.map((item) => (
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

        {/* Diferencial */}
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Vantagens da retirada profissional
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Home, title: "Retirada de dentro de casa", desc: "Não precisa de colocar nada no exterior" },
              { icon: Truck, title: "Desmontagem incluída", desc: "Equipa desmonta armários, camas e outros" },
              { icon: Recycle, title: "Destino responsável", desc: "Reaproveitamento ou reciclagem adequada" },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <item.icon className="h-6 w-6 text-cyan-600" />
                <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-slate-50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Dúvidas sobre retirar móveis velhos
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold text-slate-900">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Links internos */}
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Outros serviços de recolha
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
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="rounded-2xl bg-cyan-600 px-8 py-10 text-center text-white">
            <h2 className="text-2xl font-bold">Precisa de retirar móveis velhos?</h2>
            <p className="mt-2 text-cyan-100">
              Envie fotos e morada para orçamento rápido e sem compromisso.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="tel:+351931632622"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 font-semibold text-cyan-700 transition hover:bg-cyan-50"
              >
                <Phone className="h-4 w-4" />
                Ligar Agora
              </a>
              <a
                href="https://wa.me/351931632622?text=Ol%C3%A1!%20Preciso%20de%20retirar%20m%C3%B3veis%20velhos."
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
