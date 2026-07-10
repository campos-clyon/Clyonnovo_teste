import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import FAQClient from "./FAQClient";

export const metadata: Metadata = {
  title: "Perguntas Frequentes",
  description:
    "Respostas rápidas sobre recolha de entulho, móveis, monos, limpeza pós-obra, mudanças, orçamentos e funcionamento dos serviços da CLYON.",
  alternates: { canonical: "https://clyon.pt/faq" },
  openGraph: {
    title: "Perguntas Frequentes",
    description:
      "Esclareça dúvidas sobre recolha, limpeza, mudanças e orçamentos da CLYON.",
    url: "https://clyon.pt/faq",
  },
};

const faqCategories = [
  {
    category: "Serviços gerais",
    questions: [
      {
        q: "Qual é o tempo de resposta da CLYON?",
        a: "Respondemos em cerca de 11 minutos em muitos pedidos, especialmente quando o serviço é simples de validar.",
      },
      {
        q: "Que zonas abrangem?",
        a: "Atuamos em Lisboa, Margem Sul e Setúbal com equipas preparadas para recolha, limpeza e mudanças.",
      },
      {
        q: "Como posso contratar um serviço?",
        a: "Pode usar o simulador, falar connosco ou contactar-nos diretamente para uma triagem rápida.",
      },
    ],
  },
  {
    category: "Orçamentos",
    questions: [
      {
        q: "O valor do simulador é final?",
        a: "O simulador dá uma estimativa inicial. O valor pode ajustar-se conforme o volume, a acessibilidade e a complexidade real no local.",
      },
      {
        q: "Posso confirmar detalhes antes de avançar?",
        a: "Sim. Fazemos o alinhamento por mensagem ou chamada para garantir que o orçamento corresponde ao pedido.",
      },
    ],
  },
  {
    category: "Recolha e limpeza",
    questions: [
      {
        q: "Recolhem móveis velhos ou danificados?",
        a: "Sim. Recolhemos móveis, monos, entulho e outros volumes grandes com encaminhamento responsável.",
      },
      {
        q: "Fazem limpeza pós-obra?",
        a: "Sim. Fazemos limpezas pós-obra e finais para deixar o espaço pronto a usar, com um bom acabamento.",
      },
    ],
  },
  {
    category: "Mudanças",
    questions: [
      {
        q: "Oferecem apoio a mudanças completas?",
        a: "Sim. Podemos apoiar no transporte, na carga e descarga e na organização do processo no local.",
      },
      {
        q: "Como calculam o preço de uma mudança?",
        a: "Consideramos o tempo, o volume, a distância, a acessibilidade e os recursos necessários para executar o serviço com segurança.",
      },
    ],
  },
];

export const revalidate = 86400;

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-end">
            <div>
              <h1 className="mt-5 max-w-[13ch] text-[2.55rem] font-bold leading-[1.02] tracking-tight text-slate-950 sm:text-[4.1rem]">
                Respostas rápidas para decidir com clareza.
              </h1>
            </div>
            <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.2)]">
              <p className="text-base leading-8 text-slate-600">
                Reunimos aqui as dúvidas mais comuns sobre recolha, limpeza,
                mudanças, preços e prazos para que o seu pedido avance sem ruído.
              </p>
            </div>
          </div>
        </div>
      </section>

      <FAQClient categories={faqCategories} />

      <section className="bg-white pb-16 lg:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] px-8 py-10 text-white shadow-[0_26px_70px_-30px_rgba(2,6,23,0.45)] lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  Ainda com dúvidas?
                </p>
                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Fale connosco e afinamos o pedido em poucos minutos.
                </h2>
              </div>
              <Link
                href="/contactos"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Contactar agora
              </Link>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqCategories.flatMap((cat) =>
              cat.questions.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              })),
            ),
          }),
        }}
      />
    </div>
  );
}
