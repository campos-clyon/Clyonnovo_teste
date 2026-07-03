import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import Breadcrumb from "@/components/Breadcrumb";
import CTABlock from "@/components/CTABlock";
import { REGIONS, SERVICES, SITE_URL, getRegionCities } from "@/lib/seo-data";

const simulatorCategoryMap: Record<string, string> = {
  "recolha-moveis": "moveis",
  "recolha-monos": "monos",
  "recolha-entulho": "entulho",
  mudancas: "mudancas",
  "esvaziamento-casas": "moveis",
  "limpeza-pos-obra": "limpeza",
};

export const metadata: Metadata = {
  title: "Regiões de Atuação em Lisboa, Margem Sul e Setúbal",
  description:
    "Conheça as regiões de atuação da CLYON e encontre páginas locais fortes para recolha de entulho, móveis, monos, mudanças e limpeza pós-obra.",
  alternates: {
    canonical: `${SITE_URL}/regioes`,
  },
};

export const revalidate = 86400;

export default function RegioesPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-cyan-100 via-cyan-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.20),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.12),_transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
          <Breadcrumb items={[{ label: "Áreas de Atuação", href: "/areas-de-atuacao" }, { label: "Regiões" }]} className="mb-6" />
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
              <MapPin className="h-4 w-4" />
              Cobertura regional
            </div>
            <h1 className="mt-5 max-w-[14ch] text-4xl font-bold leading-[1.14] tracking-tight text-slate-950 md:text-6xl md:leading-[1.08]">
              Regiões e cidades onde a CLYON já atua.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              Esta página organiza a presença da CLYON em Lisboa, Margem Sul e Setúbal, com hubs por região e páginas
              locais preparadas para captar pesquisas por serviço e cidade.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {REGIONS.map((region) => {
            const cities = getRegionCities(region.slug);

            return (
              <article
                key={region.slug}
                className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  {region.shortLabel}
                </p>
                <h2 className="mt-3 text-3xl font-bold text-slate-950">{region.name}</h2>
                <p className="mt-4 text-base leading-8 text-slate-600">{region.intro}</p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/80 p-4">
                    <p className="text-sm font-semibold text-slate-950">Localidades mapeadas</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {cities.length} zonas prioritárias nesta região.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-cyan-100 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-950">Exemplos de cidades</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {cities.slice(0, 4).map((city) => city.name).join(", ")}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/regioes/${region.slug}`}
                  className="site-btn-primary mt-6"
                >
                  Ver região
                </Link>
              </article>
            );
          })}
        </div>

                {/* Hubs de serviço */}
        <div className="mt-8 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Páginas hub</p>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Hubs de Serviço</h2>
          <p className="mt-3 text-slate-600">Páginas principais de cada serviço com links para todas as cidades.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Recolha de Móveis", href: "/recolha-de-moveis", color: "cyan" },
              { name: "Recolha de Entulho", href: "/recolha-de-entulho", color: "amber" },
              { name: "Limpeza Pós-Obra", href: "/limpeza-pos-obra", color: "emerald" },
              { name: "Esvaziamento de Casas", href: "/esvaziamento-casas", color: "violet" },
            ].map((hub) => (
              <Link
                key={hub.href}
                href={hub.href}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <h3 className="font-bold text-slate-900 group-hover:text-cyan-600">{hub.name}</h3>
                <div className="mt-3 flex items-center gap-1 text-sm font-medium text-cyan-600">
                  Ver hub
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[30px] border border-cyan-100 bg-slate-950 p-7 text-white shadow-[0_24px_60px_-34px_rgba(2,6,23,0.45)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Serviços estratégicos</p>
          <h2 className="mt-3 text-3xl font-bold">Base local preparada para captar intenção comercial</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service) => (
              <Link
                key={service.slug}
                href={`/simulador?categoria=${simulatorCategoryMap[service.slug] ?? "moveis"}`}
                className="rounded-[22px] border border-cyan-400/30 bg-cyan-400/10 px-4 py-4 text-sm font-medium text-white transition hover:border-cyan-300 hover:bg-cyan-400/20"
              >
                {service.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Precisa de serviço na sua zona?"
            description="Peça um orçamento grátis. Respondemos em 24 horas."
          />
        </div>
      </section>
    </div>
  );
}

