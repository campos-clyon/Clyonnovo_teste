import type { Metadata } from "next";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, MessageSquareQuote, Sparkles } from "lucide-react";
import { getShowcaseProjects, phaseLabel } from "@/lib/work-gallery";
import { listTrabalhos } from "@/lib/db";
import { SITE_URL, AVALIACOES, AVALIACOES_TOTAL, PRAZO_DE_RESPOSTA } from "@/lib/seo-data";
import { reviews } from "@/lib/reviews-data";
import TrabalhosGallery from "./TrabalhosGallery";
import ProfissionaisComPagina from "@/components/ProfissionaisComPagina";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Trabalhos Realizados — Recolha e Esvaziamento",
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description:
    `Recolhas de móveis e entulho, esvaziamentos e mudanças feitos em Lisboa, Margem Sul e Setúbal, em fotos reais, e ${AVALIACOES_TOTAL} avaliações de 5 estrelas.`,
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
  openGraph: og({
    title: "Trabalhos Realizados — Recolha e Esvaziamento",
    description:
      `Portfólio de recolhas, esvaziamentos e mudanças em Lisboa. Fotos reais, ${AVALIACOES_TOTAL} avaliações 5★.`,
    url: `${SITE_URL}/trabalhos`,
  }),
};

/*
 * OS TESTEMUNHOS DESTA PÁGINA ERAM OUTROS — e agora são os mesmos — 30-09-2026.
 *
 * Havia aqui uma lista escrita à mão com quatro clientes. Três existem em
 * reviews-data.ts, mas com outro texto e outra data (a Inês A. dizia uma coisa
 * aqui e outra em /avaliacoes); o quarto, "Adalberto F.", não existe em lado
 * nenhum; e o "Christian M." aparecia a elogiar uma limpeza pós-obra, que não
 * é um serviço. Por baixo de cada um, "Avaliação verificada".
 *
 * Passam a ser as da fonte única, palavra por palavra, com a data que lá
 * está, e a fonte dita por cima: Google e Fixando, com as ligações para
 * confirmar. Não se atribui serviço nenhum a nenhuma — a fonte não o diz.
 */
const testimonials = reviews.slice(0, 4);

const stats = [
  // Era "163", escrito à mão — o total antigo que o prova-social.test.ts
  // procura, e que aqui escapava por estar em dois campos separados.
  { value: String(AVALIACOES_TOTAL), label: "avaliações no Google e na Fixando" },
  { value: PRAZO_DE_RESPOSTA.curto, label: "para receber propostas" },
  // "Mesmo dia em muitos pedidos" era uma estatística que ninguém tira.
  { value: `${AVALIACOES.media} ★`, label: "média das avaliações" },
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acao">
                Portefólio CLYON
              </p>
              <h1 className="mt-4 max-w-[17ch] text-[2.4rem] font-bold leading-[1.04] tracking-tight text-tinta sm:text-[4rem]">
                Recolhas, esvaziamentos e mudanças — casos reais em Lisboa.
              </h1>
              {/* "Cliente identificado e avaliação verificada" saiu: as
                  fotografias não levam cliente nem avaliação, e ninguém
                  verifica nada que se possa prometer aqui (30-09-2026). */}
              <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-slate-600">
                Fotos reais de trabalhos concluídos: recolha de móveis, esvaziamento
                de casa e apartamento, recolha de entulho e mudanças em Lisboa,
                Margem Sul e Setúbal — muitos com o antes e o depois.
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
                  <div className="text-2xl font-bold text-tinta">{stat.value}</div>
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
              {/* Dizia "Casos reais geridos no painel" e, ao lado, uma nota
                  para quem administra o site ("Esta galeria passa a ser
                  alimentada pelo painel interno…") — visível a todos os
                  clientes. Passa a falar com quem lê (30-09-2026). */}
              <h2 className="mt-3 text-4xl font-bold text-slate-950">
                Antes e depois, trabalho a trabalho.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              As fotografias de cada trabalho ficam juntas, marcadas como antes,
              durante ou depois.
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
                O que dizem os clientes.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-slate-600">
              Avaliações deixadas no{" "}
              <a
                href={AVALIACOES.googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-300 underline-offset-2 hover:text-acao"
              >
                Google
              </a>{" "}
              e na{" "}
              <a
                href={AVALIACOES.fixandoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-300 underline-offset-2 hover:text-acao"
              >
                Fixando
              </a>{" "}
              — as mesmas da{" "}
              <Link href="/avaliacoes" className="font-semibold text-acao hover:underline">
                página de avaliações
              </Link>
              .
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {testimonials.map((item) => (
              <article
                key={`${item.name}-${item.date}`}
                className="rounded-[28px] border border-cyan-100 bg-white p-5 shadow-[0_22px_55px_-34px_rgba(14,116,144,0.18)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-semibold text-acao">5★</p>
                  <div className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-acao">
                    {item.date}
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-3">
                  <MessageSquareQuote className="mt-1 h-5 w-5 flex-shrink-0 text-acao" />
                  <p className="text-[0.94rem] leading-7 text-slate-600">
                    {item.text}
                  </p>
                </div>

                <div className="mt-5 border-t border-cyan-100 pt-4">
                  <p className="text-sm font-semibold text-slate-950">{item.name}</p>
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
                {/* Na voz da plataforma desde 30-09-2026: quem executa é o
                    profissional; o que a CLYON faz é conferir e registar. */}
                {[
                  "Pedido conferido por uma pessoa da CLYON",
                  "Preço combinado por escrito antes de começar",
                  "Trabalho feito por profissionais verificados",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-5"
                  >
                    <div className="mb-3 text-sm font-semibold text-acao">
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

      {/*
        QUEM FEZ ISTO. Um portefólio sem as pessoas por trás é um álbum; com
        elas, é uma prova — e cada nome é um link para uma página que se
        escreve sozinha à medida que ele trabalha.
      */}
      <ProfissionaisComPagina
        titulo="Quem fez estes trabalhos"
        descricao="Profissionais independentes que recebem os pedidos pela CLYON. Cada um tem a sua página, com a nota que os clientes lhe deram e as zonas onde trabalha."
        fundo="bg-[#F4F8FB]"
      />

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
                  Descreva o pedido e receba propostas de profissionais verificados da sua
                  zona em até {PRAZO_DE_RESPOSTA.porExtenso} — para recolhas, esvaziamentos
                  ou mudanças.
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
