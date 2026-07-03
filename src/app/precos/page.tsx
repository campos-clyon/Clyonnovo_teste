import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  MessageCircle,
  Phone,
  Wallet,
} from "lucide-react";

import { BUSINESS_PHONE, SITE_URL } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Preços de Recolha de Monos, Entulho e Móveis",
  description:
    "Veja preços orientativos para recolha de monos, entulho, móveis, esvaziamentos e limpeza pós-obra em Lisboa, Margem Sul e Setúbal.",
  alternates: {
    canonical: `${SITE_URL}/precos`,
  },
  openGraph: {
    title: "Preços de Recolha de Monos, Entulho e Móveis",
    description:
      "Faixas de preço de referência, fatores que influenciam o valor e a melhor forma de pedir orçamento com precisão.",
    url: `${SITE_URL}/precos`,
  },
};

const priceExamples = [
  {
    title: "Recolha de sofá",
    price: "sob avaliação",
    includes: "Retirada, carregamento e transporte conforme acessos e volume.",
  },
  {
    title: "Cama, estrado e colchão",
    price: "sob avaliação",
    includes: "Ideal para trocas de quarto, mudanças ou libertação de espaço.",
  },
  {
    title: "Armário ou roupeiro grande",
    price: "sob avaliação",
    includes: "Pode incluir desmontagem e retirada em prédios sem elevador.",
  },
  {
    title: "Recolha de vários móveis",
    price: "orçamento personalizado",
    includes: "Pedidos com recheios, divisões completas ou volumes acumulados.",
  },
  {
    title: "Recolha de entulho",
    price: "orçamento personalizado",
    includes: "Valor depende do tipo de residuo, peso, quantidade e facilidade de carga.",
  },
  {
    title: "Limpeza pós-obra",
    price: "desde 160 €",
    includes: "Preco varia com área, nível de sujidade, vidros, cozinha e casas de banho.",
  },
];

const pricingFactors = [
  "Quantidade total e peso do material",
  "Andar, elevador, escadas e distancia de carga",
  "Necessidade de desmontagem ou proteção adicional",
  "Mistura entre móveis, monos, entulho e eletrodomésticos",
  "Urgencia do pedido e janela horaria pretendida",
  "Localização do serviço em Lisboa, Margem Sul ou Setúbal",
];

const scenarios = [
  {
    title: "Pedido simples",
    text: "Um sofá, uma cama ou alguns móveis pequenos costumam ser os pedidos mais rápidos de orçamentar e executar.",
  },
  {
    title: "Pedido médio",
    text: "Vários móveis, acesso por escadas ou recolha de eletrodomésticos pedem mais tempo de carga e deslocação.",
  },
  {
    title: "Pedido completo",
    text: "Esvaziamento de casa, mistura de resíduos ou fim de obra exigem avaliação mais detalhada e equipa ajustada.",
  },
];

const faqs = [
  {
    question: "Os preços desta página são fixos?",
    answer:
      "Não. São valores orientativos para ajudar a enquadrar o pedido. O valor final depende sempre do volume, acessos, urgência e localização.",
  },
  {
    question: "Como receber um orçamento mais preciso?",
    answer:
      "Envie fotos, morada, piso, informação sobre elevador e descreva o que precisa de retirar. Quanto mais claro for o pedido, mais preciso será o orçamento.",
  },
  {
    question: "A desmontagem está incluída?",
    answer:
      "Depende do caso. Em muitos pedidos a desmontagem faz parte do serviço, mas o tempo necessário influencia o valor final.",
  },
  {
    question: "Pedidos no mesmo dia custam mais?",
    answer:
      "Em alguns casos sim, especialmente quando exigem reorganização de agenda, equipa extra ou janela horaria mais curta.",
  },
  {
    question: "Posso pedir preço por WhatsApp?",
    answer:
      "Sim. Pode usar o simulador, falar por WhatsApp ou ligar diretamente para validar disponibilidade e valor aproximado.",
  },
  {
    question: "Fazem serviços para empresas e condomínios?",
    answer:
      "Sim. A CLYON atende particulares, empresas, senhorios, equipas de obra e condomínios com pedidos pontuais ou recorrentes.",
  },
];

export const revalidate = 86400;

export default function PrecosPage() {
  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Olá! Gostava de pedir um orçamento a CLYON.",
  )}`;

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700 shadow-sm">
                Preços orientativos
              </div>
              <h1 className="mt-5 max-w-[13ch] text-[2.65rem] font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-[4.2rem]">
                Quanto pode custar o seu pedido.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                Esta página ajuda a perceber faixas de valor para recolha de móveis,
                monos, entulho, limpeza pós-obra e esvaziamentos. Não substitui um
                orçamento final, mas dá contexto rápido sobre o que influencia o preço
                e como reduzir atrásos na marcação.
              </p>
            </div>

            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <div className="flex items-start gap-3">
                <Wallet className="mt-1 h-5 w-5 text-cyan-600" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    Como acelerar o preço certo
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Envie fotos, morada, piso, informação sobre elevador e diga se há
                    desmontagem. Esse conjunto reduz margem de erro e permite responder
                    mais rápido.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/simulador" className="site-btn-primary px-6">
                  Simular orçamento
                </Link>
                <a href={whatsappUrl} className="site-btn-secondary px-6">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Pedir por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {priceExamples.map((item) => (
              <article
                key={item.title}
                className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  {item.title}
                </p>
                <h2 className="mt-4 text-3xl font-bold text-slate-950">{item.price}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.includes}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
                O que altera o valor
              </p>
              <h2 className="mt-4 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                O preço não depende só do volume.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                Dois pedidos com o mesmo numero de pecas podem ter valores diferentes.
                Acessos, peso, urgência, desmontagem e mistura de materiais mudam o
                tempo de carga, a equipa e a logistica necessaria.
              </p>
            </div>

            <div className="grid gap-3">
              {pricingFactors.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 text-cyan-600" />
                    <p className="text-sm leading-7 text-slate-700">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.16)] lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  Cenarios tipicos
                </p>
                <h2 className="mt-4 text-3xl font-bold text-slate-950 sm:text-4xl">
                  Nem todos os pedidos precisam da mesma equipa.
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {scenarios.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-5"
                  >
                    <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Perguntas frequentes
              </p>
              <h2 className="mt-4 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                O essencial antes de pedir valor final.
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/servicos" className="site-btn-secondary px-6">
                Ver serviços
              </Link>
              <Link href="/recolha-de-moveis" className="site-btn-secondary px-6">
                Ver recolha de móveis
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-[28px] border border-cyan-100 bg-slate-50 p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.12)]"
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
                <h2 className="text-3xl font-bold sm:text-4xl">
                  Quer fechar o valor com mais precisão?
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  Envie fotos, diga a morada e indique acessos. A partir daí a equipa
                  consegue responder com mais segurança sobre custo e disponibilidade.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/simulador" className="site-btn-primary px-7 py-4 text-base">
                  Simular orçamento
                </Link>
                <a
                  href={`tel:${BUSINESS_PHONE}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Ligar agora
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
