import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Phone,
  Truck,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "Recolha de Sofá Lisboa | Carregamento e Transporte | CLYON",
  description:
    "Recolha de sofá em Lisboa com carregamento porta a porta e transporte incluído. Retiramos sofás, chaise longues e cadeirões. Orçamento grátis: 965 785 395.",
  keywords: [
    "recolha de sofá Lisboa",
    "retirar sofá Lisboa",
    "levar sofá velho Lisboa",
    "recolha de sofá usado",
    "recolha de chaise longue",
    "recolha de cadeirão",
  ],
  alternates: {
    canonical: "https://clyon.pt/recolha-de-sofa-lisboa",
  },
  openGraph: {
    title: "Recolha de Sofá Lisboa | Carregamento e Transporte | CLYON",
    description:
      "Recolha de sofá em Lisboa com carregamento porta a porta e transporte incluído. Retiramos sofás, chaise longues e cadeirões.",
    url: "https://clyon.pt/recolha-de-sofa-lisboa",
    siteName: "CLYON",
    locale: "pt_PT",
    type: "website",
  },
};

const faqs = [
  {
    question: "Quanto custa retirar um sofá em Lisboa?",
    answer:
      "O valor depende do tamanho do sofá, tipo de acesso (elevador, escadas, rua estreita) e andar. Para sofás pequenos ou médios com acesso fácil, os valores começam a partir de 35 €. Envie fotos para orçamento exacto.",
  },
  {
    question: "Recolhem sofás de qualquer tamanho?",
    answer:
      "Sim. Recolhemos sofás de 2 lugares, 3 lugares, chaise longues, sofás-cama, cadeirões e conjuntos completos. A equipa está preparada para volumes grandes.",
  },
  {
    question: "O sofá precisa de estar desmontado?",
    answer:
      "Não. A equipa trata da desmontagem se for necessário para retirar o sofá do imóvel. Basta indicar no pedido que é preciso desmontar.",
  },
  {
    question: "Recolhem o sofá de dentro de casa?",
    answer:
      "Sim. A recolha é feita porta a porta. A equipa entra no imóvel, retira o sofá do local onde está e carrega para o veículo.",
  },
  {
    question: "Qual é o destino do sofá?",
    answer:
      "Sempre que possível, sofás em bom estado são encaminhados para reaproveitamento ou doação. Sofás danificados seguem para reciclagem ou destino adequado.",
  },
];

const whenToHire = [
  "Comprou sofá novo e precisa de retirar o antigo",
  "Mudança de casa com sofá para deixar",
  "Sofá danificado, rasgado ou com manchas",
  "Esvaziamento de imóvel para venda ou arrendamento",
  "Renovação de sala com mobília para retirar",
];

const howItWorks = [
  {
    step: "01",
    title: "Envie fotos do sofá",
    description: "Fotografe o sofá, indique a morada, andar e tipo de acesso.",
  },
  {
    step: "02",
    title: "Receba orçamento",
    description: "Resposta rápida com valor claro e janela de execução.",
  },
  {
    step: "03",
    title: "Recolha no local",
    description: "Equipa chega, desmonta se necessário, carrega e transporta.",
  },
];

const sofaTypes = [
  "Sofá de 2 lugares",
  "Sofá de 3 lugares",
  "Sofá de canto",
  "Chaise longue",
  "Sofá-cama",
  "Cadeirão",
  "Poltrona",
  "Puff grande",
];

const internalLinks = [
  { href: "/recolha-de-moveis", label: "Recolha de Móveis", desc: "Página principal" },
  { href: "/recolha-de-sofas", label: "Recolha de Sofás", desc: "Todas as zonas" },
  { href: "/recolha-de-camas", label: "Recolha de Camas", desc: "Camas e colchões" },
  { href: "/recolha-de-armarios", label: "Recolha de Armários", desc: "Armários e roupeiros" },
  { href: "/recolha-de-eletrodomesticos", label: "Eletrodomésticos", desc: "Máquinas e frigoríficos" },
  { href: "/recolha-gratuita-de-moveis-usados", label: "Gratuita vs Privada", desc: "Comparação" },
];

export default function RecolhaSofaLisboaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Recolha de Sofá Lisboa",
        description:
          "Recolha de sofá em Lisboa com carregamento porta a porta, desmontagem quando necessário e transporte incluído.",
        provider: {
          "@type": "LocalBusiness",
          name: "CLYON",
          telephone: "+351965785395",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Lisboa",
            addressCountry: "PT",
          },
        },
        areaServed: {
          "@type": "City",
          name: "Lisboa",
        },
        serviceType: "Recolha de Sofá",
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
          { "@type": "ListItem", position: 2, name: "Recolha de Sofás", item: "https://clyon.pt/recolha-de-sofas" },
          { "@type": "ListItem", position: 3, name: "Sofá Lisboa", item: "https://clyon.pt/recolha-de-sofa-lisboa" },
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
        {/* Breadcrumb */}
        <div className="mx-auto max-w-7xl px-6 pt-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Início", href: "/" },
              { label: "Recolha de Sofás", href: "/recolha-de-sofas" },
              { label: "Lisboa" },
            ]}
          />
        </div>

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-700">
            <MapPin className="h-4 w-4" />
            Lisboa e bairros
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Recolha de sofá em Lisboa com carregamento e transporte
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-slate-600">
            Precisa de retirar um sofá em Lisboa? A CLYON faz a recolha porta a porta com carregamento,
            desmontagem quando necessário e transporte incluído. Retiramos sofás de qualquer tamanho,
            de qualquer andar, com ou sem elevador.
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
              href="tel:+351965785395"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 text-[0.9375rem] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Phone className="h-4 w-4" />
              965 785 395
            </a>
            <a
              href="https://wa.me/351965785395?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20sof%C3%A1%20em%20Lisboa."
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
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
              Situações comuns
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Quando contratar recolha de sofá
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
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
            Processo simples
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Como funciona a recolha de sofá
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

        {/* Tipos de sofá */}
        <section className="bg-slate-50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
              Tipos de sofá
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              O que recolhemos em Lisboa
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sofaTypes.map((item) => (
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
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
            Perguntas frequentes
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Dúvidas sobre recolha de sofá em Lisboa
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
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
              Páginas relacionadas
            </p>
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
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="rounded-2xl bg-cyan-600 px-8 py-10 text-center text-white">
            <h2 className="text-2xl font-bold">Precisa de retirar um sofá em Lisboa?</h2>
            <p className="mt-2 text-cyan-100">
              Envie fotos e morada para orçamento rápido e sem compromisso.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="tel:+351965785395"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 font-semibold text-cyan-700 transition hover:bg-cyan-50"
              >
                <Phone className="h-4 w-4" />
                Ligar Agora
              </a>
              <a
                href="https://wa.me/351965785395?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20sof%C3%A1%20em%20Lisboa."
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
