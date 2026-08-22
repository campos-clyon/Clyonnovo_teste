import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Phone } from "lucide-react";

import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { PRECOS } from "@/lib/precos-publicos";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  SITE_URL,
  NOTA_DE_PRECO,
  PRAZO_DE_RESPOSTA,
} from "@/lib/seo-data";

/**
 * As páginas dos serviços que não tinham página nenhuma.
 *
 * PORQUE É QUE ISTO PRECISOU DE EXISTIR
 *
 * Nove cartões de serviço na homepage, e quatro deles levavam a `/simulador`.
 * Um cartão que MOSTRA UM PREÇO faz uma promessa de página informativa: quem
 * carrega quer saber mais. Cair num formulário em vez disso é um salto de
 * contexto — a pessoa queria ler e é-lhe pedido que preencha.
 *
 * A regra que fica: um cartão de serviço leva sempre a uma página de serviço.
 *
 * O "outro serviço" continua a apontar ao simulador, e é a excepção certa: é
 * literalmente o cartão de "não encontrei o que preciso", e uma página sobre
 * um serviço indefinido não teria o que dizer.
 *
 * Todo o conteúdo sai do array partilhado — label, descrição, preço. O que
 * vive aqui são só as perguntas, que têm de ser específicas de cada serviço
 * para valerem alguma coisa a quem as lê e ao Google.
 */

/** Só os que não têm landing própria. O resto já tem página dedicada. */
const GERADAS = ["esvaziamento-apartamento", "montagem-moveis", "manutencao-casa"] as const;

type Pergunta = { q: string; a: string };

const PERGUNTAS: Record<string, Pergunta[]> = {
  "esvaziamento-apartamento": [
    {
      q: "O que é que entra num esvaziamento de apartamento?",
      a: "Tudo o que estiver lá dentro e o cliente quiser tirar: móveis, eletrodomésticos, roupa, livros, loiça, decoração e tralha acumulada. O profissional desmonta o que for preciso, carrega e deixa o espaço vazio.",
    },
    {
      q: "Quanto tempo demora?",
      a: "Um T1 ou T2 costuma fazer-se num dia. Um T3 ou T4 com arrecadação pode levar dois. O prazo fica combinado na proposta, antes de começar.",
    },
    {
      q: "É preciso estar presente?",
      a: "Não obrigatoriamente. Muitos esvaziamentos são feitos para heranças ou fim de arrendamento, com alguém a abrir a porta e a fechar no fim. Combina-se caso a caso.",
    },
    {
      q: "Para onde vai o que sai de casa?",
      a: "O que ainda serve vai para reutilização ou doação. O resto vai para centros de tratamento licenciados — a CLYON é operador de resíduos registado na Agência Portuguesa do Ambiente.",
    },
  ],
  "montagem-moveis": [
    {
      q: "Montam móveis comprados noutro sítio?",
      a: "Sim. IKEA, Conforama, JYSK, Leroy Merlin ou compra em segunda mão — desde que venham com as instruções e as ferragens.",
    },
    {
      q: "E desmontar para uma mudança?",
      a: "Sim, e é dos pedidos mais frequentes. Roupeiros, camas e estantes desmontam-se, embalam-se as ferragens, e volta a montar-se no destino.",
    },
    {
      q: "Trazem ferramentas?",
      a: "Sim. O profissional leva o que precisa, incluindo aparafusadora e nível. Se o móvel exigir fixação à parede, diga-o no pedido para o preço já contar com isso.",
    },
    {
      q: "Quanto custa montar um roupeiro?",
      a: `Depende do número de portas e de haver ou não fixação à parede. A montagem começa ${PRECOS.montagem_moveis.etiqueta.toLowerCase()}, sem IVA, e o valor exacto vem na proposta.`,
    },
  ],
  "manutencao-casa": [
    {
      q: "Que tipo de reparações entram aqui?",
      a: "Pequenos arranjos do dia a dia: fixar prateleiras, trocar puxadores e dobradiças, colocar cortinados e estores, vedar silicones, substituir tomadas e interruptores, apertar torneiras.",
    },
    {
      q: "Fazem obras?",
      a: "Não. Isto é manutenção, não remodelação. Para obra com alvenaria, canalização ou electricidade a sério, descreva o caso no pedido e é encaminhado para quem faça esse trabalho.",
    },
    {
      q: "Posso juntar vários arranjos no mesmo pedido?",
      a: "Sim, e sai mais barato do que pedir um a um — o profissional já está no local. Faça a lista no pedido para o preço contar com tudo.",
    },
    {
      q: "Quem responde por um trabalho mal feito?",
      a: "O profissional que o executou, e a CLYON só liberta o pagamento depois de o cliente confirmar. Cada profissional tem nota e historial avaliados por quem já o contratou.",
    },
  ],
};

type Props = { params: Promise<{ slug: string }> };

function categoriaDe(slug: string) {
  if (!(GERADAS as readonly string[]).includes(slug)) return null;
  return SERVICE_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

export function generateStaticParams() {
  return GERADAS.map((slug) => ({ slug }));
}

export const dynamicParams = false;
export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoriaDe(slug);
  if (!cat) return { title: "Serviço não encontrado | CLYON" };

  const preco = PRECOS[cat.id];
  const titulo = `${cat.label} em Lisboa, Margem Sul e Setúbal`;
  const descricao = `${cat.description} ${
    preco ? `${preco.etiqueta}, sem IVA.` : ""
  } ${PRAZO_DE_RESPOSTA.frase}, com profissionais verificados.`.replace(/\s+/g, " ").trim();

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `${SITE_URL}/servicos/${slug}` },
    openGraph: { title: titulo, description: descricao, url: `${SITE_URL}/servicos/${slug}` },
  };
}

export default async function ServicoGerado({ params }: Props) {
  const { slug } = await params;
  const cat = categoriaDe(slug);
  if (!cat) notFound();

  const preco = PRECOS[cat.id];
  const perguntas = PERGUNTAS[slug] ?? [];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: perguntas.map((p) => ({
      "@type": "Question",
      name: p.q,
      acceptedAnswer: { "@type": "Answer", text: p.a },
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="secao bg-[#F4F8FB]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="Caminho" className="text-sm text-tinta-fraca">
            <Link href="/servicos" className="hover:text-acao">
              Serviços
            </Link>
            <span className="mx-2" aria-hidden="true">
              ›
            </span>
            <span>{cat.label}</span>
          </nav>

          <h1 className="mt-4 text-3xl font-bold leading-tight text-tinta sm:text-4xl lg:text-5xl">
            {cat.label}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-fraca sm:text-lg">
            {cat.description} Descreva o que precisa e receba propostas de profissionais
            verificados em Lisboa, Margem Sul e Setúbal.
          </p>

          {preco && (
            <div className="mt-7 inline-flex flex-col gap-1 rounded-2xl border border-[#E2EEF3] bg-white px-6 py-4">
              <span className="text-2xl font-bold text-acao">{preco.etiqueta}</span>
              <span className="text-[13px] text-tinta-fraca">{NOTA_DE_PRECO.curta}</span>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/simulador" className="site-btn-primary px-6 py-3.5 text-base">
              Ver quanto custa o meu caso
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="site-btn-secondary px-6 py-3.5 text-base"
            >
              <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
              {BUSINESS_PHONE}
            </a>
          </div>
        </div>
      </section>

      <section className="secao bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-tinta sm:text-3xl">Como funciona</h2>
          <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-3">
            {[
              "Descreve o que precisa, com fotografias se ajudarem.",
              `Recebe propostas de profissionais da sua zona em ${PRAZO_DE_RESPOSTA.porExtenso}.`,
              "Escolhe a que quiser — ou nenhuma. Só paga depois de confirmar.",
            ].map((passo) => (
              <li
                key={passo}
                className="rounded-2xl border border-[#E2EEF3] bg-white p-5 text-sm leading-relaxed text-tinta-fraca"
              >
                <CheckCircle2 className="mb-3 h-5 w-5 text-acao" aria-hidden="true" />
                {passo}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {perguntas.length > 0 && (
        <section className="secao bg-[#F4F8FB]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-tinta sm:text-3xl">Perguntas frequentes</h2>
            <dl className="mt-6 space-y-4">
              {perguntas.map((p) => (
                <div key={p.q} className="rounded-2xl border border-[#E2EEF3] bg-white p-5">
                  <dt className="text-base font-semibold text-tinta">{p.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-tinta-fraca">{p.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: BUSINESS_NAME, item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Serviços", item: `${SITE_URL}/servicos` },
              {
                "@type": "ListItem",
                position: 3,
                name: cat.label,
                item: `${SITE_URL}/servicos/${slug}`,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
