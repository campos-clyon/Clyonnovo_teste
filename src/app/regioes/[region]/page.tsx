import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, MessageSquare, Phone, ShieldCheck, Truck } from "lucide-react";
import { notFound } from "next/navigation";

import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  REGIONS,
  SERVICES,
  SITE_URL,
  AVALIACOES,
  AVALIACOES_TOTAL,
  NOTA_DE_PRECO,
  PRAZO_DE_RESPOSTA,
  getCityServiceSlug,
  getRegion,
  getRegionCities,
} from "@/lib/seo-data";
import { PRECOS } from "@/lib/precos-publicos";
import { IDENTIFICACAO } from "@/lib/identificacao-legal";

/**
 * A página de uma região.
 *
 * O QUE ESTAVA AQUI ESCRITO, E PARA QUEM
 *
 * Esta página falava com um consultor de SEO, não com um cliente. Tinha, em
 * texto visível e publicado:
 *
 *   · "Região estratégica" no distintivo do topo;
 *   · "Esta página centraliza a presença da CLYON em Lisboa e ajuda a ligar
 *     cidades, serviços e páginas locais sem gerar URLs repetidas";
 *   · "Cidades mapeadas · 14 localidades prioritárias";
 *   · "Páginas fortes para captar intenção local";
 *   · e um bloco inteiro chamado "Como dominamos buscas locais em Lisboa",
 *     com três pontos a explicar a estratégia: "páginas por cidade e serviço
 *     com H1 forte e intenção comercial", "links internos a apontar as
 *     cidades para recolha de móveis quando essa procura é dominante", "dados
 *     locais e contacto direto para reforçar confiança e relevância".
 *
 * Era documentação interna de SEO servida a quem procura quem lhe leve o sofá.
 * Além de não ajudar ninguém a decidir, diz ao leitor que a página existe para
 * apanhar o Google e não para o servir — que é o oposto do efeito pretendido.
 * ("Buscas", ainda por cima, é português do Brasil.)
 *
 * O QUE MUDA, E O QUE FICA
 *
 * As ligações internas ficam todas: cidade × serviço, e serviço × região. Não
 * eram o problema — têm valor real para quem procura a sua zona, e são a razão
 * pela qual esta página deve existir. O que muda é o texto à volta delas, que
 * passa a responder ao que a pessoa quer saber: quem vai, quanto custa, quando
 * é que sabe alguma coisa, e se vêm à zona dela.
 */

type Props = {
  params: Promise<{ region: string }>;
};

export function generateStaticParams() {
  return REGIONS.map((region) => ({ region: region.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const regionData = getRegion(region);

  if (!regionData) {
    return { title: "Região não encontrada | CLYON" };
  }

  return {
    title: regionData.metaTitle,
    description: regionData.metaDescription,
    alternates: {
      canonical: `${SITE_URL}/regioes/${regionData.slug}`,
    },
    keywords: regionData.keywords,
    openGraph: {
      title: regionData.metaTitle,
      description: regionData.metaDescription,
      url: `${SITE_URL}/regioes/${regionData.slug}`,
    },
  };
}

export const revalidate = 86400;
export const dynamicParams = false;

export default async function RegionPage({ params }: Props) {
  const { region } = await params;
  const regionData = getRegion(region);

  if (!regionData) {
    notFound();
  }

  const cities = getRegionCities(regionData.slug);

  /*
   * As perguntas são as que as pessoas fazem, e as respostas estão na voz da
   * plataforma.
   *
   * Diziam "Fazemos recolha de móveis..." e "dependendo da agenda da equipa" —
   * a CLYON não tem equipa que vá a casa de ninguém. Quem vai é o
   * profissional, e é ele quem emite a factura.
   */
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Que serviços posso pedir em ${regionData.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Recolha de móveis, recolha de monos, recolha de entulho, mudanças, esvaziamento de casas e limpeza pós-obra em ${regionData.name}. Descreve o que tem e recebe propostas de profissionais verificados.`,
        },
      },
      {
        "@type": "Question",
        name: `Quanto tempo demora a receber resposta em ${regionData.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${PRAZO_DE_RESPOSTA.frase}. Em ${regionData.name}, muitos pedidos recebem confirmação de data no próprio dia — depende do volume, do acesso e da disponibilidade dos profissionais da zona.`,
        },
      },
      {
        "@type": "Question",
        name: `Quanto custa uma recolha de móveis em ${regionData.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${PRECOS.recolha_moveis.etiqueta}, sem IVA, conforme o volume e o acesso. O preço fica fechado antes de o trabalho começar e não acresce nada no fim.`,
        },
      },
    ],
  };

  const COMO_FUNCIONA = [
    {
      icon: MessageSquare,
      titulo: "Descreve o que tem",
      texto:
        "Fotografias e uma frase chegam. Não precisa de medir nada nem de saber o nome das peças.",
    },
    {
      icon: Truck,
      titulo: "Recebe propostas",
      texto: `Profissionais da sua zona respondem em ${PRAZO_DE_RESPOSTA.porExtenso}. Vê o nome, a nota e os trabalhos de cada um.`,
    },
    {
      icon: ShieldCheck,
      titulo: "Escolhe, ou não",
      texto:
        "Aceita a proposta que quiser — ou nenhuma. O valor fica fechado antes de começar e não acresce nada no fim.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-cyan-100 via-cyan-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.20),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.14),_transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div className="max-w-3xl">
              {/* Era "Região estratégica". Fica o nome da terra, que é o que a
                  pessoa reconhece e o que ela veio procurar. */}
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold text-acao shadow-sm">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {regionData.name}
              </div>
              <h1 className="mt-5 max-w-[15ch] text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
                Recolha de entulho, móveis e monos em {regionData.name}.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                {regionData.intro} Descreva o que tem para levar e receba propostas de
                profissionais verificados, com preço fechado antes de o trabalho
                começar.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                  className="site-btn-primary px-6 py-3.5 text-base"
                >
                  Ver quanto custa o meu caso
                </Link>
                <Link
                  href="/contactos"
                  className="site-btn-secondary px-6 py-3.5 text-base"
                >
                  Falar connosco
                </Link>
              </div>
            </div>

            {/*
              Este cartão explicava a arquitectura de URLs do site. Passa a
              dizer as três coisas que decidem se a pessoa continua a ler:
              quanto custa, quando tem resposta, e se isto é de confiança.
            */}
            <div className="overflow-hidden rounded-[32px] border border-cyan-100 bg-white p-6 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acao">
                Em {regionData.name}
              </p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">
                O essencial, antes de pedir
              </h2>
              <dl className="mt-6 space-y-3">
                <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/80 p-4">
                  <dt className="text-sm font-semibold text-slate-950">
                    Recolha de móveis
                  </dt>
                  <dd className="mt-1 text-sm leading-7 text-slate-600">
                    {PRECOS.recolha_moveis.etiqueta}, conforme o volume e o acesso
                  </dd>
                </div>
                <div className="rounded-[22px] border border-cyan-100 bg-white p-4">
                  <dt className="text-sm font-semibold text-slate-950">
                    Tempo até ter propostas
                  </dt>
                  <dd className="mt-1 text-sm leading-7 text-slate-600">
                    {PRAZO_DE_RESPOSTA.porExtenso} — muitos no próprio dia
                  </dd>
                </div>
                <div className="rounded-[22px] border border-cyan-100 bg-white p-4">
                  <dt className="text-sm font-semibold text-slate-950">
                    O que dizem os clientes
                  </dt>
                  <dd className="mt-1 text-sm leading-7 text-slate-600">
                    {AVALIACOES.media} ★ em {AVALIACOES_TOTAL} avaliações, no Google e
                    na Fixando
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
                {NOTA_DE_PRECO.curta}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        {/*
          Este bloco chamava-se "Como dominamos buscas locais em {região}" e
          explicava a estratégia de SEO em três pontos. Passa a explicar como
          se pede, que é a dúvida real de quem chega aqui pela primeira vez.
        */}
        <div className="rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
          <h2 className="text-2xl font-bold text-slate-950">
            Como funciona em {regionData.name}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {COMO_FUNCIONA.map(({ icon: Icone, titulo, texto }) => (
              <div key={titulo} className="rounded-[22px] bg-white p-5 shadow-sm">
                <Icone className="h-5 w-5 text-acao" aria-hidden="true" />
                <h3 className="mt-3 text-base font-bold text-slate-950">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-7 text-slate-700">{texto}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            {/* Era "Localidades chave" e "Cidades com procura forte para
                recolha de móveis". A pessoa não procura uma "localidade
                chave" — procura a terra onde mora. */}
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acao">
              Onde há profissionais
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Escolha a sua zona em {regionData.name}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {cities.length} zonas com profissionais disponíveis. Se a sua não estiver
              na lista, peça na mesma — a cobertura muda todas as semanas.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {cities.map((city) => (
                <Link
                  key={city.slug}
                  href={`/${getCityServiceSlug("recolha-moveis", city.slug)}`}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-acao shadow-sm transition-all hover:border-cyan-400 hover:shadow-md"
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-cyan-100 bg-slate-950 p-7 text-white shadow-[0_24px_60px_-34px_rgba(2,6,23,0.45)]">
            {/* Era "Serviços estratégicos" e "Páginas fortes para captar
                intenção local". */}
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
              O que pode pedir
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Serviços em {regionData.name}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              De uma peça só a uma casa inteira. Não há mínimo de volume.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SERVICES.map((service) => (
                <Link
                  key={service.slug}
                  href={`/${service.slug}-${cities[0]?.slug ?? "lisboa"}`}
                  className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-slate-100 transition hover:border-cyan-300/40 hover:bg-white/10"
                >
                  {service.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/*
          O registo de operador de resíduos existe desde sempre e não estava
          nesta página. É o argumento mais forte que a CLYON tem e é público —
          feito para ser mostrado. Onde acaba o entulho de uma obra é uma
          pergunta que os clientes de empresa fazem sempre, e a resposta aqui
          vale mais do que qualquer adjectivo.
        */}
        <div className="mt-8 flex flex-col gap-4 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)] sm:flex-row sm:items-center">
          <ShieldCheck className="h-8 w-8 shrink-0 text-acao" aria-hidden="true" />
          <p className="text-sm leading-7 text-slate-700">
            <strong className="font-semibold text-slate-950">
              Operador de resíduos registado na Agência Portuguesa do Ambiente
            </strong>{" "}
            — {IDENTIFICACAO.codigoAPA}. O que sai de sua casa vai para destino
            licenciado, e há registo disso.
          </p>
        </div>

        <div className="mt-8 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acao">
            Falar com alguém
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-950">
            Prefere explicar por telefone?
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            O caminho mais rápido é descrever o caso no simulador — leva dois minutos
            e não obriga a nada. Mas se for mais fácil contar, atende-se e o pedido
            fica registado do mesmo modo.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/simulador"
              className="site-btn-primary px-6 py-3.5 text-base"
            >
              Pedir orçamento
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
              {
                "@type": "ListItem",
                position: 1,
                name: BUSINESS_NAME,
                item: SITE_URL,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Regiões",
                item: `${SITE_URL}/regioes`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: regionData.name,
                item: `${SITE_URL}/regioes/${regionData.slug}`,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
