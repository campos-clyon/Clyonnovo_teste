import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, Phone } from "lucide-react";

import CTABlock from "@/components/CTABlock";
import { getAllCities } from "@/lib/city-content";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CITIES,
  PRAZO_DE_RESPOSTA,
  SITE_URL,
  getRegionCities,
} from "@/lib/seo-data";

/*
 * "MAIS DE 24 LOCALIDADES", COM DEZANOVE NA PÁGINA — 30-09-2026.
 *
 * O número era escrito à mão e a lista vinha de city-content.ts, que tem
 * dezanove. As localidades com página são as de `CITIES` (seo-data.ts): é essa
 * a lista que os blocos das regiões passam a mostrar, e o número é o tamanho
 * dela. A tabela de ligações lá em baixo continua a ler city-content — são
 * ligações, não uma contagem — e o JSON-LD fica como está, que é da equipa do
 * SEO técnico.
 *
 * E saíram as "limpezas" (a limpeza pós-obra não é serviço), os "tempos de
 * resposta imbatíveis" e o "mais procurado", que ninguém mediu.
 */
export const metadata: Metadata = {
  title: "Áreas de Atuação | Lisboa, Margem Sul e Setúbal",
  description:
    `A CLYON liga-o a profissionais verificados em ${CITIES.length} localidades: Lisboa, Amadora, Sintra, Cascais, Oeiras, Almada, Seixal, Barreiro, Setúbal e mais. Recolha de móveis, entulho, esvaziamentos e mudanças.`,
  alternates: { canonical: `${SITE_URL}/areas-de-atuacao` },
  openGraph: {
    title: "Áreas de Atuação da CLYON | Cobertura Completa",
    description:
      "Profissionais verificados em Lisboa, Margem Sul e Setúbal. Recolha de móveis, entulho, esvaziamentos e mudanças.",
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
    description: "Lisboa e os concelhos à volta",
    highlight: null,
  },
  {
    name: "Margem Sul",
    slug: "margem-sul",
    description: "De Almada ao Montijo — é aqui que fica a sede da CLYON",
    highlight: "Sede da CLYON",
  },
  {
    name: "Setúbal",
    slug: "setubal",
    description: "Setúbal, Palmela e Sesimbra",
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
  const lisboaCities = getRegionCities("lisboa");
  const margemSulCities = getRegionCities("margem-sul");
  const setubalCities = getRegionCities("setubal");

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
          <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div className="max-w-3xl">
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                Áreas de Atuação da CLYON
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                A CLYON liga-o a profissionais verificados em{" "}
                <strong>{CITIES.length} localidades</strong> de Lisboa, Margem Sul e
                Setúbal — recolha de móveis, entulho e monos, esvaziamentos e mudanças.
                Fora destas zonas, depende de haver profissional disponível.
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

          </div>
        </div>
      </section>

      {/* Regiões */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <h2 className="mb-10 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          3 Regiões, {CITIES.length} Localidades
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
                    <MapPin className="h-7 w-7 text-acao" />
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
                  className="inline-flex items-center gap-2 text-acao transition-colors hover:text-acao-hover"
                >
                  Ver região
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {region.cities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/recolha-moveis-${city.slug}`}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-cyan-100 hover:text-acao-hover"
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
            Serviços em Todas Estas Zonas
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
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-acao-hover">
                  {service.name}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Lisboa, Margem Sul e Setúbal
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-acao">
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
                      <span className="ml-2 text-xs text-tinta-fraca">
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
                          className="inline-flex items-center justify-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-acao transition-colors hover:bg-cyan-100"
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
            className="inline-flex items-center gap-2 text-acao transition-colors hover:text-acao-hover"
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
            description={`Peça um orçamento grátis e receba propostas de profissionais da sua zona em até ${PRAZO_DE_RESPOSTA.porExtenso}.`}
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
