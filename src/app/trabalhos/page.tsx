import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MessageSquareQuote, Sparkles } from "lucide-react";
import { getShowcaseProjects, phaseLabel } from "@/lib/work-gallery";
import { listTrabalhos } from "@/lib/db";
import { SITE_URL } from "@/lib/seo-data";
import TrabalhosGallery from "./TrabalhosGallery";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Trabalhos Realizados — Recolha de Móveis e Esvaziamento em Lisboa",
  description:
    "Portfólio de recolhas de móveis, esvaziamentos de casa, recolhas de entulho e mudanças executadas pela CLYON em Lisboa, Margem Sul e Setúbal. Fotos reais, 163 avaliações 5★, tempo médio de resposta 11 minutos.",
  keywords: [
    "trabalhos CLYON",
    "portefólio recolha de móveis",
    "recolha de móveis antes e depois",
    "esvaziamento de casa fotos",
    "trabalhos realizados Lisboa",
    "avaliações CLYON",
    "casos reais recolha",
  ],
  alternates: { canonical: `${SITE_URL}/trabalhos` },
  openGraph: {
    title: "Trabalhos Realizados — Recolha de Móveis e Esvaziamento em Lisboa",
    description:
      "Portfólio de recolhas, esvaziamentos e mudanças em Lisboa. Fotos reais, 163 avaliações 5★.",
    url: `${SITE_URL}/trabalhos`,
  },
};

const testimonials = [
  {
    service: "Recolha de Entulho",
    name: "Inês A.",
    date: "20 Nov 2025",
    rating: "5★",
    text: "Excelente serviço, rápido e com uma ótima relação qualidade-preço. Trabalho impecável e equipa muito simpática.",
  },
  {
    service: "Recolha de Móveis",
    name: "Adalberto F.",
    date: "6 Nov 2025",
    rating: "5★",
    text: "Retiraram os móveis antigos com cuidado e sem complicações. Processo simples, rápido e bem organizado.",
  },
  {
    service: "Mudanças Completas",
    name: "Maria T.",
    date: "27 Nov 2025",
    rating: "5★",
    text: "Muito eficientes, com boa relação qualidade-preço. Fiquei extremamente satisfeita com o serviço prestado.",
  },
  {
    service: "Limpeza Pós-Obra",
    name: "Christian M.",
    date: "12 Dez 2025",
    rating: "5★",
    text: "A casa ficou pronta a usar no mesmo dia. Boa comunicação, bom ritmo de trabalho e acabamento muito cuidado.",
  },
];

const stats = [
  { value: "163", label: "avaliações 5★" },
  { value: "11 min", label: "tempo médio de resposta" },
  { value: "Mesmo dia", label: "em muitos pedidos" },
];

export default async function TrabalhosPage() {
  const [showcaseProjects, trabalhos] = await Promise.all([
    getShowcaseProjects(),
    listTrabalhos({ publicadoOnly: true }),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),linear-gradient(160deg,rgba(236,254,255,0.9)_0%,rgba(255,255,255,1)_55%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
                Portefólio CLYON
              </p>
              <h1 className="mt-4 max-w-[17ch] text-[2.4rem] font-bold leading-[1.04] tracking-tight text-[#0B1929] sm:text-[4rem]">
                Recolhas, esvaziamentos e mudanças — casos reais em Lisboa.
              </h1>
              <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-slate-600">
                Fotos reais de trabalhos concluídos: recolha de móveis, esvaziamento
                de casa e apartamento, recolha de entulho e mudanças em Lisboa,
                Margem Sul e Setúbal. Cada intervenção com antes e depois, cliente
                identificado e avaliação verificada.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/simulador"
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3.5 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
                >
                  Pedir orçamento
                </Link>
                <Link
                  href="/contactos"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Falar connosco
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[26px] border border-[#E2EEF3] bg-[#F4F8FB] p-5"
                >
                  <div className="text-2xl font-bold text-[#0B1929]">{stat.value}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Galeria dinâmica (admin → /admin/trabalhos) ── */}
      {trabalhos.length > 0 && (
        <section className="bg-slate-50 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="mt-3 text-4xl font-bold text-slate-950 text-balance">
                  Trabalhos realizados.
                </h2>
              </div>
              <p className="max-w-md text-base leading-7 text-slate-600">
                {trabalhos.length} {trabalhos.length === 1 ? "trabalho publicado" : "trabalhos publicados"} &mdash;
                filtra por tipo de serviço.
              </p>
            </div>
            <TrabalhosGallery trabalhos={trabalhos} />
          </div>
        </section>
      )}

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="mt-3 text-4xl font-bold text-slate-950">
                Casos reais geridos no painel.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              Esta galeria passa a ser alimentada pelo painel interno. Pode agrupar
              imagens por trabalho e marcar cada uma como antes, durante ou depois.
            </p>
          </div>

          <div className="mt-10 grid gap-6 xl:grid-cols-2">
            {showcaseProjects.map((project) => (
              <article
                key={project.id}
                className="overflow-hidden rounded-[30px] border border-cyan-100 bg-white shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]"
              >
                <div className="border-b border-cyan-100 bg-cyan-50/70 px-6 py-5">
                  <h3 className="text-2xl font-bold text-slate-950">{project.title}</h3>
                  {project.subtitle && (
                    <p className="mt-2 text-sm text-slate-600">
                      {project.subtitle}
                    </p>
                  )}
                  {project.description && (
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className={`grid gap-4 p-5 ${project.items.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {project.items.map((item) => (
                    <figure
                      key={item.id}
                      className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <Image
                          src={item.imageUrl}
                          alt={item.alt}
                          fill
                          sizes="(min-width: 1280px) 420px, (min-width: 640px) 50vw, 100vw"
                          quality={72}
                          className="object-cover"
                        />
                        {item.phase && (
                          <span className="absolute left-4 top-4 rounded-full bg-slate-950/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                            {phaseLabel(item.phase)}
                          </span>
                        )}
                      </div>
                      <figcaption className="space-y-2 px-5 py-4">
                        <p className="text-base font-semibold text-slate-950">{item.title}</p>
                        {item.description && (
                          <p className="text-sm leading-7 text-slate-600">{item.description}</p>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="mt-3 text-4xl font-bold text-slate-950">
                Casos reais com resultado visível.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-slate-600">
              Mensagens reais de clientes, com nota, data e contexto do serviço
              prestado pela CLYON.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {testimonials.map((item) => (
              <article
                key={`${item.name}-${item.date}`}
                className="rounded-[28px] border border-cyan-100 bg-white p-5 shadow-[0_22px_55px_-34px_rgba(14,116,144,0.18)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-cyan-700">
                      {item.rating}
                    </p>
                    <h3 className="mt-3 text-[1.45rem] font-bold leading-tight text-slate-950">
                      {item.service}
                    </h3>
                  </div>
                  <div className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    {item.date}
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-3">
                  <MessageSquareQuote className="mt-1 h-5 w-5 flex-shrink-0 text-cyan-600" />
                  <p className="text-[0.94rem] leading-7 text-slate-600">
                    {item.text}
                  </p>
                </div>

                <div className="mt-5 border-t border-cyan-100 pt-4">
                  <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-500">Avaliação verificada</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] border border-cyan-100 bg-white p-8 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)] lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
                  Trabalho real, comunicação simples e resposta profissional.
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  "Pedido claro com triagem rápida",
                  "Confirmação do serviço sem surpresas",
                  "Execução no local com foco em limpeza",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-5"
                  >
                    <div className="mb-3 text-sm font-semibold text-cyan-700">
                      0{index + 1}
                    </div>
                    <p className="text-sm leading-7 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 lg:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] px-8 py-10 text-white shadow-[0_26px_70px_-30px_rgba(2,6,23,0.45)] lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-cyan-200">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                    Próximo trabalho
                  </span>
                </div>
                <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                  Quer ver o seu pedido resolvido assim também?
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  Fale connosco e receba uma proposta rápida para recolha, limpeza ou
                  mudança com execução profissional.
                </p>
              </div>
              <Link
                href="/simulador"
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Pedir orçamento
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
