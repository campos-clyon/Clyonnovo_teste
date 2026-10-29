import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CTABlock from "@/components/CTABlock";
import TerrasComServicos from "@/components/TerrasComServicos";
import { CIDADES_COM_PAGINA, REGIONS, SERVICES, SITE_URL, getRegionCities } from "@/lib/seo-data";
import { caminhoDoServicoNaCidade } from "@/lib/caminho-da-cidade";
import { LOCALIDADES_SERVIDAS, PRESTADOR, caminhoDaPagina } from "@/lib/dados-estruturados";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";

/*
 * /regioes FICOU COM O QUE ERA DE /areas-de-atuacao — 15-10-2026.
 *
 * Eram duas páginas para a mesma pesquisa, e as duas finas: o Google
 * escolhia uma e a outra dividia-lhe os sinais. O dono escolheu juntar aqui.
 * Vieram de lá o número de localidades, a sede na Margem Sul, o «fora destas
 * zonas», o Service com as localidades e as terras com todos os serviços; a
 * outra faz 301 para esta (`paginas-consolidadas.ts`).
 */

const simulatorCategoryMap: Record<string, string> = {
  "recolha-moveis": "moveis",
  "recolha-monos": "monos",
  "recolha-entulho": "entulho",
  mudancas: "mudancas",
  "esvaziamento-casas": "moveis",
};

const TITULO = "Regiões de Atuação em Lisboa, Margem Sul e Setúbal";
// Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
// Google mostra uns 155 e corta o resto a meio (29-09-2026).
const DESCRICAO = `${CIDADES_COM_PAGINA.length} localidades em Lisboa, Margem Sul e Setúbal: recolha de móveis, monos e entulho, mudanças e esvaziamentos. Propostas em menos de 6 horas.`;

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: {
    canonical: `${SITE_URL}/regioes`,
  },
  // Sem isto herdava o do layout, com o endereço da página inicial.
  openGraph: og({ title: `${TITULO} | CLYON`, description: DESCRICAO, url: `${SITE_URL}/regioes` }),
};

export const revalidate = 86400;

/** A sede é em Amora, no Seixal (a morada do LocalBusiness do layout). */
const SEDE = "margem-sul";

const servicoSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Recolha de móveis, monos e entulho, esvaziamentos e mudanças",
  provider: PRESTADOR,
  areaServed: LOCALIDADES_SERVIDAS.map((name) => ({ "@type": "City", name })),
};

const breadcrumbSchema = caminhoDaPagina([["Regiões", "/regioes"]]);

export default function RegioesPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="sob-o-menu relative overflow-hidden bg-gradient-to-br from-cyan-100 via-cyan-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.20),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.12),_transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
          <div className="max-w-4xl">
            <h1 className="mt-5 max-w-[14ch] text-4xl font-bold leading-[1.14] tracking-tight text-slate-950 md:text-6xl md:leading-[1.08]">
              Regiões e cidades onde a CLYON tem parceiros.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              {/* 30-09-2026: dizia «páginas locais preparadas para captar pesquisas
                  por serviço e cidade» — uma nota de SEO publicada. */}
              A CLYON liga-o a parceiros independentes e verificados em{" "}
              <strong>{CIDADES_COM_PAGINA.length} localidades</strong> de Lisboa, da Margem Sul e de Setúbal
              — recolha de móveis, monos e entulho, esvaziamentos e mudanças. Fora destas zonas,
              depende de haver parceiro disponível.
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
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-bold text-slate-950">{region.name}</h2>
                  {region.slug === SEDE && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      Sede da CLYON
                    </span>
                  )}
                </div>
                <p className="mt-4 text-base leading-8 text-slate-600">{region.intro}</p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/80 p-4">
                    <p className="text-sm font-semibold text-slate-950">Zonas com parceiros</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {cities.length} nesta região. A cobertura muda todas as semanas.
                    </p>
                  </div>
                  {/* Eram quatro nomes, sem ligação (15-10-2026, pente fino):
                      ficam todas as terras, cada uma para a sua página. */}
                  <div className="rounded-[22px] border border-cyan-100 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-950">As terras</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {cities.map((city, i) => (
                        <span key={city.slug}>
                          {i > 0 && ", "}
                          <Link
                            href={caminhoDoServicoNaCidade("recolha-moveis", city.slug)}
                            className="text-acao underline-offset-2 hover:underline"
                          >
                            {city.name}
                          </Link>
                        </span>
                      ))}
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

        {/* ── Terra a terra, por região — 15-10-2026 ──────────────────────
            Era a tabela «Links diretos por serviço e cidade» de
            /areas-de-atuacao, que só tinha doze terras e dizia «Ver» em todas
            as ligações. Ficam todas, com o nome do serviço. */}
        <div id="terras" className="mt-8 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
          <h2 className="text-3xl font-bold text-slate-950">Terra a terra, o que pode pedir</h2>
          {REGIONS.map((region) => (
            <div key={region.slug} className="mt-8">
              <h3 className="text-lg font-semibold text-slate-950">{region.name}</h3>
              <div className="mt-4">
                <TerrasComServicos cidades={getRegionCities(region.slug)} />
              </div>
            </div>
          ))}
        </div>

        {/* Hubs de serviço */}
        <div className="mt-8 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
          <h2 className="mt-3 text-2xl font-bold text-slate-950">Serviços mais pedidos</h2>
          <p className="mt-3 text-slate-600">Cada serviço tem a sua página, com as zonas onde há parceiros.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { name: "Recolha de Móveis", href: "/recolha-de-moveis", color: "cyan" },
              // Os monos e as mudanças tinham hub e não estavam aqui (15-10-2026).
              { name: "Recolha de Monos", href: "/recolha-de-monos", color: "cyan" },
              { name: "Recolha de Entulho", href: "/recolha-de-entulho", color: "amber" },
              // Era /esvaziamento-casas, que faz 308 para cá (29-09-2026).
              { name: "Esvaziamento de Casas", href: "/esvaziamento-de-casas", color: "violet" },
              { name: "Mudanças", href: "/mudancas", color: "emerald" },
            ].map((hub) => (
              <Link
                key={hub.href}
                href={hub.href}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <h3 className="font-bold text-slate-900 group-hover:text-acao-hover">{hub.name}</h3>
                <div className="mt-3 flex items-center gap-1 text-sm font-medium text-acao">
                  Ver serviço
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[30px] border border-slate-200 bg-[#F4F8FB] p-7">
          {/*
            Dizia "Base local preparada para captar intenção comercial". É a
            frase de um plano de marketing, publicada a quem procura quem lhe
            leve o entulho — e diz ao leitor que a página existe para apanhar o
            Google, não para o servir.
          */}
          <h2 className="text-3xl font-bold text-tinta">O que pode pedir, em qualquer das regiões</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service) => (
              <Link
                key={service.slug}
                href={`/simulador?categoria=${simulatorCategoryMap[service.slug] ?? "moveis"}`}
                className="rounded-[22px] border border-[#E2EEF3] bg-white px-4 py-4 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50"
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
            description="Descreva o pedido e receba propostas de parceiros da sua zona em menos de 6 horas."
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(servicoSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }} />
    </div>
  );
}
