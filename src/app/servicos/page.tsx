import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Home,
  Phone,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Wrench,
  Zap,
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

const services = [
  {
    title: "Recolha de Móveis",
    description:
      "Sofás, camas, armários, recheios e eletrodomésticos com desmontagem, carregamento e encaminhamento responsável.",
    icon: Home,
    href: "/recolha-de-moveis",
    cta: "Ver serviço",
  },
  {
    title: "Recolha de Entulho",
    description:
      "Retiramos restos de obra, sacos, materiais mistos e volumes pesados com triagem simples e transporte profissional.",
    icon: Trash2,
    href: "/recolha-de-entulho",
    cta: "Ver serviço",
  },
  {
    title: "Esvaziamento de Casas",
    description:
      "Libertação completa de casas, apartamentos, lojas e imóveis com recolha de móveis, monos e resíduos acumulados.",
    icon: ShieldCheck,
    href: "/esvaziamento-casas",
    cta: "Ver serviço",
  },
  {
    title: "Recolha de Monos",
    description:
      "Objetos volumosos, sucata, recheios soltos e espaço acumulado em garagens, arrecadações, lojas e apartamentos.",
    icon: Wrench,
    href: "/recolha-de-moveis",
    cta: "Ver serviço",
  },
  {
    title: "Mudanças",
    description:
      "Mudanças residenciais e comerciais com carga, transporte, descarga e montagem de móveis. Equipa profissional.",
    icon: Truck,
    href: "/mudancas",
    cta: "Ver serviço",
  },
];

const selectionPoints = [
  {
    title: "Para obras e remodelações",
    text: "Quando o problema é pó, restos, sacos e materiais mistos, o serviço certo e recolha de entulho com triagem rápida.",
  },
  {
    title: "Para móveis, colchões e recheios",
    text: "Se precisa de retirar sofás, armários, camas ou eletrodomésticos, a recolha de móveis evita desmontagem e transporte por conta própria.",
  },
  {
    title: "Para libertar um espaço por completo",
    text: "Quando há mistura de móveis, monos, lixo e acumulação, o mais eficiente costuma ser esvaziamento com avaliação direta.",
  },
];

const serviceFaqs = [
  {
    question: "Que tipo de pedidos a CLYON aceita?",
    answer:
      "Atendemos recolha de entulho, móveis, monos, recheios, limpeza pós-obra, esvaziamento de casas e apoio em mudanças, tanto para particulares como para empresas.",
  },
  {
    question: "Como saber qual é o serviço certo?",
    answer:
      "Basta enviar fotos e indicar a morada. A nossa equipa ajuda a enquadrar o pedido e diz-lhe qual o serviço mais indicado para o volume, acesso e urgência.",
  },
  {
    question: "A CLYON recolhe no mesmo dia?",
    answer:
      "Sempre que existe disponibilidade operacional, sim. Em Lisboa, Grande Lisboa, Margem Sul e Setúbal muitos pedidos conseguem resposta no próprio dia ou no dia seguinte.",
  },
  {
    question: "Fazem desmontagem e retirada dentro do imóvel?",
    answer:
      "Sim. Quando necessário, desmontamos móveis e tratamos do carregamento a partir do interior da casa, loja, escritório ou arrecadação.",
  },
  {
    question: "Também atendem empresas e condomínios?",
    answer:
      "Sim. Trabalhamos com particulares, senhorios, empresas, gestores de património, condomínios e equipas de obra que precisam de resposta rápida e organizada.",
  },
  {
    question: "Onde posso ver preços orientativos?",
    answer:
      "Na página de preços encontra exemplos de valores de referência, fatores que influenciam o valor final e o melhor caminho para pedir orçamento com mais precisão.",
  },
];

const quickLinks = [
  {
    href: "/precos",
    title: "Preços orientativos",
    text: "Veja faixas de referência e o que pode fazer o valor subir ou descer.",
  },
  {
    href: "/regioes",
    title: "Cobertura regional",
    text: "Confirme as zonas atendidas em Lisboa, Margem Sul e Setúbal.",
  },
  {
    href: "/avaliacoes",
    title: "Avaliações de clientes",
    text: "Prova social real com serviços executados e feedback verificado.",
  },
  {
    href: "/sobre-nos",
    title: "Sobre a CLYON",
    text: "Perceba como trabalhamos, quem atendemos e o compromisso com destino responsável.",
  },
];

export const revalidate = 86400;

const serviceFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Que tipo de pedidos a CLYON aceita?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Atendemos recolha de entulho, móveis, monos, recheios, limpeza pós-obra, esvaziamento de casas e apoio em mudanças, tanto para particulares como para empresas.",
      },
    },
    {
      "@type": "Question",
      name: "Como saber qual é o serviço certo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Basta enviar fotos e indicar a morada. A nossa equipa ajuda a enquadrar o pedido e diz-lhe qual o serviço mais indicado para o volume, acesso e urgência.",
      },
    },
    {
      "@type": "Question",
      name: "A CLYON recolhe no mesmo dia?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sempre que existe disponibilidade operacional, sim. Em Lisboa, Grande Lisboa, Margem Sul e Setúbal muitos pedidos conseguem resposta no próprio dia ou no dia seguinte.",
      },
    },
    {
      "@type": "Question",
      name: "Fazem desmontagem e retirada dentro do imóvel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. Quando necessário, desmontamos móveis e tratamos do carregamento a partir do interior da casa, loja, escritório ou arrecadação.",
      },
    },
  ],
};

const serviceListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Serviços CLYON",
  itemListElement: [
    {
      "@type": "Service",
      position: 1,
      name: "Recolha de Entulho",
      description: "Retiramos restos de obra, sacos, materiais mistos e volumes pesados com triagem simples e transporte profissional.",
      provider: {
        "@type": "LocalBusiness",
        name: BUSINESS_NAME,
        telephone: BUSINESS_PHONE,
      },
      areaServed: ["Lisboa", "Setúbal", "Almada", "Seixal"],
    },
    {
      "@type": "Service",
      position: 2,
      name: "Recolha de Móveis",
      description: "Sofás, camas, armários, recheios e eletrodomésticos com desmontagem, carregamento e encaminhamento responsável.",
      provider: {
        "@type": "LocalBusiness",
        name: BUSINESS_NAME,
        telephone: BUSINESS_PHONE,
      },
      areaServed: ["Lisboa", "Setúbal", "Almada", "Seixal"],
    },
    {
      "@type": "Service",
      position: 3,
      name: "Limpeza Pós-Obra",
      description: "Limpeza final para deixar a casa, loja ou escritório pronto a usar depois da obra.",
      provider: {
        "@type": "LocalBusiness",
        name: BUSINESS_NAME,
        telephone: BUSINESS_PHONE,
      },
      areaServed: ["Lisboa", "Setúbal", "Almada", "Seixal"],
    },
    {
      "@type": "Service",
      position: 4,
      name: "Mudanças",
      description: "Ajudamos em mudanças residenciais e comerciais com transporte, carga, descarga e organização do pedido.",
      provider: {
        "@type": "LocalBusiness",
        name: BUSINESS_NAME,
        telephone: BUSINESS_PHONE,
      },
      areaServed: ["Lisboa", "Setúbal", "Almada", "Seixal"],
    },
  ],
};

export default function ServicosPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-end">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700 shadow-sm">
                Serviços CLYON
              </div>
              <h1 className="mt-5 max-w-[12ch] text-[2.65rem] font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-[4.2rem]">
                Recolha, limpeza e mudanças com resposta clara.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                A CLYON ajuda a libertar espaço, remover resíduos e organizar pedidos
                urgentes em Lisboa, Margem Sul e Setúbal. Seja um sofá velho, entulho
                de obra, recheio acumulado ou limpeza final, a equipa avalia o caso,
                apresenta um orçamento claro e executa sem complicar.
              </p>
            </div>

            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                O que ganha ao pedir com a CLYON
              </p>
              <div className="mt-4 space-y-3">
                {[
                  "Triagem rápida do pedido por fotos, volume e acessos",
                  "Orçamento simples antes da marcação",
                  "Apoio dentro do imóvel com carregamento e desmontagem",
                  "Cobertura forte em Lisboa, Grande Lisboa, Margem Sul e Setúbal",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 text-cyan-600" />
                    <p className="text-sm leading-7 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/precos" className="site-btn-primary px-6">
                  Ver preços
                </Link>
                <Link href="/contactos" className="site-btn-secondary px-6">
                  <Phone className="mr-2 h-4 w-4" />
                  Falar connosco
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.title}
                className="overflow-hidden rounded-[30px] border border-cyan-100 bg-white shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]"
              >
                <div className="flex h-36 items-center justify-center bg-cyan-50/90">
                  <service.icon className="h-12 w-12 text-cyan-600" />
                </div>
                <div className="p-7">
                  <h2 className="text-2xl font-bold text-slate-950">{service.title}</h2>
                  <p className="mt-4 text-base leading-8 text-slate-600">
                    {service.description}
                  </p>
                  <Link
                    href={service.href}
                    className="mt-5 inline-flex items-center text-base font-semibold text-cyan-700 transition hover:text-cyan-500"
                  >
                    {service.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.16)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Como escolher o serviço certo
              </p>
              <h2 className="mt-4 text-3xl font-bold text-slate-950 sm:text-4xl">
                O pedido certo acelera orçamento e recolha.
              </h2>
              <div className="mt-6 space-y-4">
                {selectionPoints.map((point) => (
                  <div key={point.title} className="rounded-[24px] bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-950">{point.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{point.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.16)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Links úteis
              </p>
              <h2 className="mt-4 text-3xl font-bold text-slate-950 sm:text-4xl">
                Aprofunde o pedido sem sair do site.
              </h2>
              <div className="mt-6 grid gap-3">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-5 transition hover:-translate-y-0.5 hover:bg-cyan-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
                      <ArrowRight className="h-4 w-4 text-cyan-700" />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Perguntas frequentes
              </p>
              <h2 className="mt-4 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                Respostas rápidas antes do pedido.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                Esta página funciona como hub dos serviços principais. Aqui responde-se
                ao essencial e, quando o caso precisa de mais detalhe, o cliente segue
                para preços, cobertura regional, avaliações ou para a página de recolha
                de móveis.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/recolha-de-moveis" className="site-btn-primary px-6">
                Abrir recolha de móveis
              </Link>
              <Link href="/precos" className="site-btn-secondary px-6">
                Ver preços
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {serviceFaqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.16)]"
              >
                <h3 className="text-lg font-bold leading-tight text-slate-950">{faq.question}</h3>
                <p className="mt-4 text-sm leading-8 text-slate-600">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 lg:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] px-8 py-10 text-white shadow-[0_26px_70px_-30px_rgba(2,6,23,0.45)] lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-cyan-200">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                    Pedido rápido
                  </span>
                </div>
                <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                  Já sabe o serviço? Então avance agora.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  Envie o pedido pelo simulador ou fale diretamente com a equipa para
                  validar volume, acessos, urgência e disponibilidade.
                </p>
              </div>
              <Link
                href="/simulador"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Abrir simulador
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceFaqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceListSchema) }}
      />
    </div>
  );
}
