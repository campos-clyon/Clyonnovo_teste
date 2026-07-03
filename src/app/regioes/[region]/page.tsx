import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MapPin, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  REGIONS,
  SERVICES,
  SITE_URL,
  getCityServiceSlug,
  getRegion,
  getRegionCities,
} from "@/lib/seo-data";

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

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Que serviços a CLYON faz em ${regionData.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Fazemos recolha de móveis, recolha de monos, recolha de entulho, mudanças, esvaziamento de casas e limpeza pós-obra em ${regionData.name}.`,
        },
      },
      {
        "@type": "Question",
        name: `A CLYON responde no próprio dia em ${regionData.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Em muitos pedidos conseguimos responder e agendar no próprio dia em ${regionData.name}, dependendo do volume, da acessibilidade e da agenda da equipa.`,
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-cyan-100 via-cyan-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.20),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.14),_transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
                <MapPin className="h-4 w-4" />
                Região estratégica
              </div>
              <h1 className="mt-5 max-w-[15ch] text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
                Recolha de entulho, móveis e monos em {regionData.name}.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                {regionData.intro} Trabalhamos com foco em orçamento rápido,
                clareza no pedido e resposta prática para clientes particulares e
                empresas.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                  className="site-btn-primary px-6 py-3.5 text-base"
                >
                  Simular orçamento
                </Link>
                <Link
                  href="/contactos"
                  className="site-btn-secondary px-6 py-3.5 text-base"
                >
                  Falar connosco
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-cyan-100 bg-white p-6 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Cobertura regional
              </p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">
                Procuras fortes em {regionData.name}
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Esta página centraliza a presença da CLYON em {regionData.name} e
                ajuda a ligar cidades, serviços e páginas locais sem gerar URLs
                repetidas.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-950">Zona foco</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {regionData.name}
                  </p>
                </div>
                <div className="rounded-[22px] border border-cyan-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">
                    Cidades mapeadas
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {cities.length} localidades prioritárias
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Localidades chave
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Cidades com procura forte para recolha de móveis em {regionData.name}
            </h2>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {cities.map((city) => (
                <Link
                  key={city.slug}
                  href={`/${getCityServiceSlug("recolha-moveis", city.slug)}`}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition-all hover:border-cyan-400 hover:shadow-md"
                  style={{ color: '#0e7490' }}
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-cyan-100 bg-slate-950 p-7 text-white shadow-[0_24px_60px_-34px_rgba(2,6,23,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Serviços estratégicos
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Páginas fortes para captar intenção local
            </h2>
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

        <div className="mt-8 rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
          <h2 className="text-2xl font-bold text-slate-950">
            Como dominamos buscas locais em {regionData.name}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              "Páginas por cidade e serviço com H1 forte e intenção comercial.",
              "Links internos a apontar as cidades para recolha de móveis quando essa procura é dominante.",
              "Dados locais e contacto direto para reforçar confiança e relevância.",
            ].map((item) => (
              <div key={item} className="rounded-[22px] bg-white p-5 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-cyan-600" />
                <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Contacto local
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-950">
            Orçamento rápido para {regionData.name}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            Se procura uma equipa para recolha de entulho, móveis, monos, limpeza
            pós-obra ou mudanças em {regionData.name}, o caminho mais rápido é usar
            o simulador e confirmar os detalhes pela página de contactos ou por
            telefone.
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
              <Phone className="mr-2 h-4 w-4" />
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
