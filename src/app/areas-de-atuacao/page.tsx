import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, Phone } from "lucide-react";

import Breadcrumb from "@/components/Breadcrumb";
import CTABlock from "@/components/CTABlock";
import TrustBadges from "@/components/TrustBadges";
import { getCitiesByRegion, getAllCities } from "@/lib/city-content";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  SITE_URL,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Áreas de Atuação | Lisboa, Margem Sul e Setúbal",
  description:
    "A CLYON atua em mais de 24 localidades: Lisboa, Amadora, Sintra, Cascais, Oeiras, Almada, Seixal, Barreiro, Setúbal e mais. Recolha de móveis, entulho e limpezas.",
  alternates: { canonical: `${SITE_URL}/areas-de-atuacao` },
  openGraph: {
    title: "Áreas de Atuação da CLYON | Cobertura Completa",
    description:
      "Cobertura em Lisboa, Margem Sul e Setúbal. Recolha de móveis, entulho, esvaziamentos e limpezas.",
    url: `${SITE_URL}/areas-de-atuacao`,
  },
};

const services = [
  { name: "Recolha de Móveis", slug: "recolha-moveis", color: "cyan" },
  { name: "Recolha de Entulho", slug: "recolha-entulho", color: "amber" },
  { name: "Esvaziamento de Casas", slug: "esvaziamento-casas", color: "violet" },
];

const regions = [
  {
    name: "Grande Lisboa",
    slug: "lisboa",
    description: "Lisboa e concelhos limítrofes com resposta rápida",
    highlight: "Mais procurado",
  },
  {
    name: "Margem Sul",
    slug: "margem-sul",
    description: "Base da CLYON - tempos de resposta imbatíveis",
    highlight: "Base CLYON",
  },
  {
    name: "Setúbal",
    slug: "setubal",
    description: "Cobertura completa na região de Setúbal",
    highlight: null,
  },
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: BUSINESS_NAME,
  telephone: BUSINESS_PHONE,
  url: SITE_URL,
  areaServed: getAllCities().map((city) => ({
    "@type": "City",
    name: city.name,
  })),
};

export const revalidate = 86400;

export default function AreasDeAtuacaoPage() {
  const lisboaCities = getCitiesByRegion("lisboa");
  const margemSulCities = getCitiesByRegion("margem-sul");
  const setubalCities = getCitiesByRegion("setubal");

  const allRegions = [
    { ...regions[0], cities: lisboaCities },
    { ...regions[1], cities: margemSulCities },
    { ...regions[2], cities: setubalCities },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cyan-50 via-cyan-50/50 to-white pb-12 pt-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.12),_transparent_32%)]" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <Breadcrumb items={[{ label: "Áreas de Atuação" }]} className="mb-6" />

          <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
                <MapPin className="h-4 w-4" />
                Cobertura geográfica
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                Áreas de Atuação da CLYON
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Atuamos em mais de <strong>24 localidades</strong> na região de Lisboa,
                Margem Sul e Setúbal. Recolha de móveis, entulho, esvaziamentos e
                limpezas com resposta rápida e preços competitivos.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/contactos"
                  className="site-btn-primary min-w-[220px] px-6 py-3.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Pedir Orçamento Grátis
                </Link>
                <a
                  href={`tel:${BUSINESS_PHONE}`}
                  className="site-btn-secondary min-w-[220px] border-slate-300 text-slate-900 hover:bg-slate-50"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Ligar {BUSINESS_PHONE}
                </a>
              </div>
            </div>

            <div className="hidden lg:block">
              <TrustBadges variant="grid" />
            </div>
          </div>
        </div>
      </section>

      {/* Regiões */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <h2 className="mb-10 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          3 Regiões, Mais de 24 Localidades
        </h2>

        <div className="space-y-8">
          {allRegions.map((region) => (
            <div
              key={region.slug}
              className="rounded-[30px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(14,116,144,0.12)] sm:p-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50">
                    <MapPin className="h-7 w-7 text-cyan-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-bold text-slate-900">
                        {region.name}
                      </h3>
                      {region.highlight && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          {region.highlight}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-slate-600">{region.description}</p>
                  </div>
                </div>
                <Link
                  href={`/regioes/${region.slug}`}
                  className="inline-flex items-center gap-2 text-cyan-600 transition-colors hover:text-cyan-700"
                >
                  Ver região
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {region.cities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/recolha-moveis-${city.slug}`}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-cyan-100 hover:text-cyan-700"
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Serviços por Zona */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Serviços Disponíveis em Todas as Zonas
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-slate-600">
            Clique num serviço para ver as páginas específicas por cidade.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <Link
                key={service.slug}
                href={`/${service.slug === "recolha-moveis" ? "recolha-de-moveis" : service.slug === "recolha-entulho" ? "recolha-de-entulho" : service.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-cyan-600">
                  {service.name}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Disponível em todas as zonas
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-cyan-600">
                  Ver página hub
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Matriz Serviço x Cidade */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <h2 className="mb-4 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          Links Diretos por Serviço e Cidade
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-slate-600">
          Aceda diretamente à página do serviço na sua cidade.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                  Cidade
                </th>
                {services.map((service) => (
                  <th
                    key={service.slug}
                    className="px-4 py-4 text-center text-sm font-semibold text-slate-900"
                  >
                    {service.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {getAllCities()
                .slice(0, 12)
                .map((city) => (
                  <tr key={city.slug} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <span className="font-medium text-slate-900">
                        {city.name}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        {city.region === "lisboa"
                          ? "Lisboa"
                          : city.region === "margem-sul"
                            ? "Margem Sul"
                            : "Setúbal"}
                      </span>
                    </td>
                    {services.map((service) => (
                      <td key={service.slug} className="px-4 py-3 text-center">
                        <Link
                          href={`/${service.slug}-${city.slug}`}
                          className="inline-flex items-center justify-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700 transition-colors hover:bg-cyan-100"
                        >
                          Ver
                        </Link>
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/regioes"
            className="inline-flex items-center gap-2 text-cyan-600 transition-colors hover:text-cyan-700"
          >
            Ver todas as regiões e cidades
          </Link>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Precisa de ajuda na sua zona?"
            description="Peça um orçamento grátis. Respondemos em 24 horas para qualquer localidade."
          />
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
    </div>
  );
}
