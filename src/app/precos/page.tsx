import type { Metadata } from "next";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import {
  CheckCircle2,
  MessageCircle,
  Phone,
  Wallet,
} from "lucide-react";

import { BUSINESS_PHONE, NOTA_DE_PRECO, PRAZO_DE_RESPOSTA, SITE_URL } from "@/lib/seo-data";
import { precoDe } from "@/lib/precos-publicos";

/**
 * A etiqueta oficial de um serviço.
 *
 * Quem não publica número — as mudanças — já vem de lá com
 * "orçamento personalizado", por isso o fallback diz o mesmo.
 */
const etiquetaDe = (servico: string) => precoDe(servico) ?? "orçamento personalizado";

export const metadata: Metadata = {
  title: "Preços de Recolha de Monos, Entulho e Móveis",
  // Sem a limpeza pós-obra, que deixou de ser serviço activo (29-09-2026).
  description:
    "Veja preços orientativos para recolha de monos, entulho, móveis, esvaziamentos e mudanças em Lisboa, Margem Sul e Setúbal.",
  alternates: {
    canonical: `${SITE_URL}/precos`,
  },
  openGraph: og({
    title: "Preços de Recolha de Monos, Entulho e Móveis",
    description:
      "Intervalos de preço de referência, fatores que influenciam o valor e a melhor forma de pedir orçamento com precisão.",
    url: `${SITE_URL}/precos`,
  }),
};

/*
 * Estes cartões diziam "sob avaliação" cinco vezes em seis.
 *
 * Quem clicava em "Ver preços" a partir de /servicos saía com MENOS informação
 * do que a que tinha na homepage, onde a grelha já mostrava valores. Uma
 * página de preços que não mostra preços é uma página que gasta a paciência
 * de quem estava a decidir.
 *
 * QUATRO CARTÕES MOSTRAM A MESMA FAIXA, E ISSO NÃO É UM BUG.
 *
 * Um sofá, uma cama, um roupeiro e "vários móveis" são todos o mesmo serviço
 * oficial — recolha de móveis — e é para isso que a faixa serve: 40 € para
 * uma peça pequena e acessível, 120 € para o caso pesado num quarto andar sem
 * elevador. Inventar quatro faixas diferentes para o mesmo serviço era
 * exatamente o problema que se acabou de corrigir no resto do site.
 *
 * O que fica por decidir é o conjunto de cartões, não os números: cinco
 * exemplos onde quatro são o mesmo serviço dá menos informação do que a
 * grelha da homepage, que mostra os nove serviços com preço próprio. Isso é
 * escolha do dono, não deste alinhamento.
 */
const priceExamples = [
  {
    title: "Recolha de sofá",
    price: etiquetaDe("recolha_moveis"),
    includes: "Retirada, carregamento e transporte conforme acessos e volume.",
  },
  {
    title: "Cama, estrado e colchão",
    price: etiquetaDe("recolha_moveis"),
    includes: "Ideal para trocas de quarto, mudanças ou libertação de espaço.",
  },
  {
    title: "Armário ou roupeiro grande",
    price: etiquetaDe("recolha_moveis"),
    includes: "Pode incluir desmontagem e retirada em prédios sem elevador.",
  },
  {
    title: "Recolha de vários móveis",
    price: etiquetaDe("recolha_moveis"),
    includes: "Pedidos com recheios, divisões completas ou volumes acumulados.",
  },
  {
    title: "Recolha de entulho",
    price: etiquetaDe("recolha_entulho"),
    includes: "O valor depende do tipo de resíduo, peso, quantidade e facilidade de carga.",
  },
  /*
   * O cartão da limpeza pós-obra saiu a 30-09-2026. Era o único preço desta
   * página escrito à mão, e não havia de onde o importar porque o serviço não
   * existe: não está em SERVICE_CATEGORIES, e nenhum profissional o recebe.
   * Mostrar um preço de um serviço que não se pode pedir é pior do que as
   * duas divergências que ele tinha (160 € aqui, 150 € em /servicos).
   */
];

const pricingFactors = [
  "Quantidade total e peso do material",
  "Andar, elevador, escadas e distância de carga",
  "Necessidade de desmontagem ou proteção adicional",
  "Mistura entre móveis, monos, entulho e eletrodomésticos",
  "Urgência do pedido e janela horária pretendida",
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

/*
 * Na voz da plataforma desde 30-09-2026: o valor a sério é a proposta de
 * cada profissional, e quem responde "sobre custo e disponibilidade" são
 * eles, não "a equipa".
 */
const faqs = [
  {
    question: "Os preços desta página são fixos?",
    answer:
      "Não. São valores orientativos para ajudar a enquadrar o pedido. O preço a sério é a proposta que recebe — já com a taxa da plataforma — e depende do volume, dos acessos, da urgência e da localização.",
  },
  {
    question: "Como receber um orçamento mais preciso?",
    answer:
      "Envie fotos, morada, piso, informação sobre elevador e descreva o que precisa de retirar. Quanto mais claro for o pedido, mais certas serão as propostas.",
  },
  {
    question: "A desmontagem está incluída?",
    answer:
      "Depende da proposta. Diga no pedido o que é preciso desmontar: o tempo que leva entra no valor.",
  },
  {
    question: "Pedidos no mesmo dia custam mais?",
    answer:
      "Podem custar. A urgência entra na proposta de cada profissional — reorganizar a agenda ou juntar mais uma pessoa tem custo.",
  },
  {
    question: "Posso pedir preço por WhatsApp?",
    answer: `Sim. Pode fazer o pedido no simulador ou por WhatsApp, e as propostas dos profissionais chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
  },
  {
    question: "Fazem serviços para empresas e condomínios?",
    answer:
      "Sim. A CLYON recebe pedidos de particulares, empresas, senhorios, equipas de obra e condomínios, pontuais ou recorrentes.",
  },
];

export const revalidate = 86400;

export default function PrecosPage() {
  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Olá! Gostava de pedir um orçamento à CLYON.",
  )}`;

  return (
    <div className="min-h-screen bg-white">
      <section className="sob-o-menu relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-acao shadow-sm">
                Preços orientativos
              </div>
              <h1 className="mt-5 max-w-[13ch] text-[2.65rem] font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-[4.2rem]">
                Quanto pode custar o seu pedido.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                Esta página ajuda a perceber intervalos de valores para recolha de móveis,
                monos, entulho e esvaziamentos. Não substitui as propostas dos
                profissionais, mas dá contexto rápido sobre o que influencia o preço.
              </p>
            </div>

            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <div className="flex items-start gap-3">
                <Wallet className="mt-1 h-5 w-5 text-acao" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acao">
                    Como acelerar o preço certo
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Envie fotos, morada, piso, informação sobre elevador e diga se há
                    desmontagem. Esse conjunto reduz a margem de erro das propostas.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/simulador" className="site-btn-primary px-6">
                  Pedir orçamento
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
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acao">
                  {item.title}
                </p>
                <h2 className="mt-4 text-3xl font-bold text-slate-950">{item.price}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.includes}</p>
              </article>
            ))}
          </div>

          {/*
            A versão completa da nota, e não a curta, porque esta é A página de
            preços: é aqui que quem está a comparar valores vem parar, e é aqui
            que a pergunta "isto leva IVA?" tem de ter resposta sem sair do
            ecrã. Dizia que quem factura é o profissional; desde 22-09-2026 é
            a parceira, sempre a 23 % — e a nota diz isso (30-09-2026).
          */}
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-7 text-slate-500">
            {NOTA_DE_PRECO.completa}
          </p>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-acao">
                O que altera o valor
              </p>
              <h2 className="mt-4 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                O preço não depende só do volume.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                Dois pedidos com o mesmo número de peças podem ter valores diferentes.
                Acessos, peso, urgência, desmontagem e mistura de materiais mudam o
                tempo de carga, a equipa e a logística necessária.
              </p>
            </div>

            <div className="grid gap-3">
              {pricingFactors.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 text-acao" />
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
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acao">
                  Cenários típicos
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
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-acao">
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
                  Envie fotos, diga a morada e indique acessos. A partir daí os
                  profissionais da sua zona conseguem propor um valor mais certo.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/simulador" className="site-btn-primary px-7 py-4 text-base">
                  Pedir orçamento
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
