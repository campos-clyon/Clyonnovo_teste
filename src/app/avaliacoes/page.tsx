import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import { Star, Quote, MessageCircle } from "lucide-react";

import HeroBackground from "@/components/HeroBackground";
import ProfissionaisComPagina from "@/components/ProfissionaisComPagina";
import { reviews } from "@/lib/reviews-data";
import {
  BUSINESS_PHONE,
  SITE_URL,
  AVALIACOES,
  AVALIACOES_TOTAL,
  CITIES,
  PRAZO_DE_RESPOSTA,
} from "@/lib/seo-data";

/*
 * Os números da descrição estavam escritos à mão ("37", "118", "155") e
 * "verificadas" prometia uma verificação que ninguém faz — passam a vir de
 * AVALIACOES, com o sítio onde se confirmam (30-09-2026).
 */
export const metadata: Metadata = {
  title: "Avaliações de Clientes — Lisboa e Setúbal",
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description:
    `${AVALIACOES.google} avaliações no Google e ${AVALIACOES.fixando} na Fixando, todas a 5 estrelas: o que dizem os clientes da CLYON em Lisboa, Margem Sul e Setúbal.`,
  alternates: {
    canonical: "https://clyon.pt/avaliacoes",
  },
  openGraph: og({
    title: "Avaliações Reais de Clientes — CLYON",
    description:
      `${AVALIACOES.media} ★ em ${AVALIACOES_TOTAL} avaliações no Google e na Fixando. Rapidez, profissionalismo e preço justo — o que os clientes dizem sobre a CLYON em Lisboa e Setúbal.`,
    url: "https://clyon.pt/avaliacoes",
  }),
};

export const revalidate = 86400;

/*
 * SEM NOTA AGREGADA NEM `review` NOS DADOS ESTRUTURADOS — 29-09-2026.
 *
 * Estava aqui um `aggregateRating` com as avaliações desta página, e um
 * `review` por cada uma. O texto visível fica todo, porque é verdade e ajuda
 * quem lê; o que sai é a declaração ao Google, e por três razões, cada uma
 * suficiente sozinha:
 *
 *   · as avaliações foram deixadas no Google e na Fixando, e copiadas para
 *     aqui. A Google não aceita em dados estruturados avaliações recolhidas
 *     noutros sites — o sítio delas é a ficha de onde vieram;
 *   · é o negócio a avaliar-se a si próprio na sua página
 *     («self-serving reviews»): desde 2019 a Google deixou de mostrar estrelas
 *     para `LocalBusiness`/`Organization` declaradas pelo próprio, e o que
 *     insiste nelas arrisca uma acção manual que tira as estrelas ao domínio
 *     inteiro — incluindo às páginas dos profissionais, que são as que as
 *     merecem;
 *   · as datas iam como estão escritas em reviews-data («10 de jun. de
 *     2026»), e não em ISO 8601 — o `datePublished` de cada `review` era
 *     inválido.
 *
 * As estrelas que ficam são as das páginas dos profissionais: avaliações
 * feitas NA plataforma, por clientes, sobre o profissional — que é o caso
 * que as regras permitem.
 */

const STATS = [
  { value: AVALIACOES.media, label: "Classificação média", sub: "Google e Fixando" },
  {
    value: String(AVALIACOES_TOTAL),
    label: "Avaliações no Google e na Fixando",
    sub: `${AVALIACOES.google} no Google · ${AVALIACOES.fixando} na Fixando`,
  },
  // O cartão "188+ trabalhos realizados" saiu: o número não tinha origem, e o
  // "+" é uma afirmação de "pelo menos" sem nada por trás. O que se mostra
  // aqui passa a ser só o que se pode abrir e contar.
  { value: String(AVALIACOES.contratacoes), label: "Contratações", sub: "registadas na Fixando" },
  // "100% — Recomendariam, com base nas respostas" saiu a 30-09-2026 pela
  // mesma razão: não há resposta nenhuma a um inquérito de recomendação.
];

export default function AvaliacoesPage() {
  // O BUSINESS_PHONE já traz o +351: com outro 351 à frente, o link abria o
  // WhatsApp num número que não existe (wa.me/351351…).
  const whatsappUrl = `https://wa.me/${BUSINESS_PHONE.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostava de pedir um orçamento à CLYON.")}`;

  return (
    <div className="min-h-screen bg-white">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="sob-o-menu relative overflow-hidden">
        <HeroBackground />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:grid lg:min-h-[560px] lg:grid-cols-[1fr_420px] lg:items-center lg:gap-12 lg:px-8 lg:py-0 xl:grid-cols-[1fr_460px]">

            {/* ── Left: copy ───────────────────────────────────────────── */}
            <div className="mb-8 lg:mb-0">

              {/* H1 */}
              <h1 className="text-[1.75rem] font-bold leading-[1.15] tracking-tight text-tinta sm:text-4xl lg:text-[3.2rem] lg:leading-[1.1]">
                O que dizem os clientes{" "}
                <span className="text-acao">sobre a CLYON</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-4 text-sm leading-relaxed text-slate-500 sm:mt-5 sm:max-w-lg sm:text-base lg:text-lg">
                Rapidez, profissionalismo e preço justo — estes são os três temas
                que dominam as avaliações de quem já usou a CLYON em Lisboa,
                Margem Sul e Setúbal.
              </p>

              {/* CTAs */}
              <div className="mt-5 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
                <Link
                  href="/simulador"
                  className="inline-flex h-11 items-center rounded-xl bg-acao px-5 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:bg-acao-hover"
                >
                  Pedir orçamento grátis
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-semibold text-whatsapp-tinta transition hover:-translate-y-0.5 hover:bg-[#1ebe5d]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>

              {/* Trust signals */}
              <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-8 sm:gap-4">
                <span className="flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
                  <span className="text-amber-500">★★★★★</span>
                  <span>{AVALIACOES.media} · {AVALIACOES_TOTAL} avaliações</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500 sm:text-sm">no Google e na Fixando</span>
                <span className="hidden text-slate-300 sm:inline">·</span>
                <span className="hidden text-xs text-slate-500 sm:inline sm:text-sm">Lisboa · Margem Sul · Setúbal</span>
              </div>
            </div>

            {/* ── Right: rating card ───────────────────────────────────── */}
            <div className="lg:py-14">
              <div className="rounded-3xl border border-cyan-100 bg-white/95 p-6 shadow-[0_24px_60px_-20px_rgba(14,116,144,0.18)] backdrop-blur-sm sm:p-7">
                <div className="flex items-end gap-4">
                  <div className="text-6xl font-black leading-none text-tinta sm:text-7xl">{AVALIACOES.media}</div>
                  <div className="pb-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400 sm:h-6 sm:w-6" />
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                      {AVALIACOES_TOTAL} avaliações: {AVALIACOES.google} no Google e{" "}
                      {AVALIACOES.fixando} na Fixando
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  Clientes destacam rapidez, simpatia, limpeza final e clareza no
                  orçamento — serviço após serviço.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
                  {/* Com três cartões, o último ocupa a linha inteira em vez
                      de deixar um buraco na grelha de dois. */}
                  {STATS.map((s, i) => (
                    <div
                      key={s.label}
                      className={`rounded-2xl bg-[#F4F8FB] p-3 sm:p-4 ${
                        STATS.length % 2 === 1 && i === STATS.length - 1 ? "col-span-2" : ""
                      }`}
                    >
                      <div className="text-xl font-black text-acao sm:text-2xl">{s.value}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-tinta sm:text-xs">{s.label}</div>
                      <div className="text-[10px] text-tinta-fraca sm:text-xs">{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        </div>
      </section>

      {/* ── REVIEWS GRID ─────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-tinta sm:text-3xl">
              Todos os testemunhos
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-500">
              Avaliações reais de clientes em Lisboa, Almada, Setúbal, Seixal, Amadora e toda a Margem Sul.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {reviews.map((review, i) => (
              <article
                key={`${review.name}-${i}`}
                className="flex flex-col rounded-2xl border border-[#E2EEF3] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold text-acao">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-tinta">{review.name}</div>
                      <div className="text-xs text-tinta-fraca">{review.date}</div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl bg-cyan-50 p-2 text-cyan-500">
                    <Quote className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{review.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO COPY ─────────────────────────────────────────────────── */}
      <section className="bg-white py-14 lg:py-18">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-tinta sm:text-3xl">
            Porque é que os clientes recomendam a CLYON?
          </h2>
          <div className="mt-6 space-y-5 text-base leading-8 text-slate-600">
            {/*
              "A CLYON presta serviços de…", "confirma o preço final", "sem
              adicionais no dia", "acompanhamento em tempo real", "mais de 24
              localidades". Reescrito a 30-09-2026 na voz da plataforma e com
              a regra do valor que está na página inicial; o número de
              localidades é o da lista com página.
            */}
            <p>
              A CLYON é uma plataforma que liga quem precisa de <strong>recolha de móveis</strong>,{" "}
              <strong>recolha de entulho</strong>, <strong>esvaziamento de casas</strong> e{" "}
              <strong>mudanças</strong> em Lisboa, Margem Sul e Setúbal a profissionais independentes e
              verificados da zona. As avaliações são consistentes: rapidez de resposta, pontualidade,
              simpatia e preço combinado antes de o serviço começar.
            </p>
            <p>
              O preço de cada proposta já inclui a taxa da plataforma e fica combinado por escrito antes
              de o trabalho começar. Se no local houver mais do que foi descrito, o novo valor combina-se
              antes de começar — depois do trabalho feito, não acresce nada.
            </p>
            <p>
              São {CITIES.length} localidades com página própria — incluindo Lisboa, Almada, Setúbal,
              Seixal, Barreiro, Amadora, Sintra e Cascais. Fora destas zonas, depende de haver
              profissional disponível.
            </p>
          </div>
        </div>
      </section>

      {/*
        QUEM FEZ ESTES TRABALHOS — e é daqui que se chega à página de cada um.

        As páginas dos profissionais estavam órfãs: nenhuma página do site lhes
        ligava, só o sitemap as declarava, e o Google respondia «Detectada, mas
        não indexada». Esta é a página do site onde o link faz mais sentido —
        as avaliações em cima são dos trabalhos que eles fizeram.
      */}
      <ProfissionaisComPagina
        titulo="Os profissionais que fazem estes trabalhos"
        descricao="A CLYON liga o cliente a profissionais independentes — são eles que carregam, transportam e deixam o espaço limpo. Abra a página de cada um para ver a nota, os serviços que faz e as zonas onde trabalha."
        fundo="bg-white"
      />

      {/* ── CTA FINAL ────────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] pb-16 pt-2 lg:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1929] to-[#0d2235] px-8 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Quer a mesma experiência no seu pedido?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-tinta-fraca">
              Descreva o que precisa e receba propostas de profissionais da sua zona em menos de{" "}
              {PRAZO_DE_RESPOSTA.porExtenso} — ou fale connosco pelo WhatsApp.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/simulador"
                className="inline-flex h-12 items-center rounded-xl bg-acao px-8 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:bg-acao-hover"
              >
                Pedir Orçamento
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#25D366] px-8 text-base font-semibold text-whatsapp-tinta transition hover:-translate-y-0.5 hover:bg-[#1ebe5d]"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
