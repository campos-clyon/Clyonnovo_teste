import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PRAZO_DE_RESPOSTA, AVALIACOES, AVALIACOES_TOTAL , NOTA_DE_PRECO} from "@/lib/seo-data";
import { precoDe } from "@/lib/precos-publicos";
import HeroQuoteForm from "@/components/HeroQuoteForm";
import HeroBackground from "@/components/HeroBackground";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  ClipboardList,
  Hammer,
  HardHat,
  Home,
  Leaf,
  MessageCircle,
  Package,
  Shield,
  Sofa,
  Star,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import DesfileDeAvaliacoes from "@/components/DesfileDeAvaliacoes";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Recolha de Móveis em Lisboa — Esvaziamento de Casa",
  description:
    `Recolha de móveis, monos e esvaziamento de casas em Lisboa, Margem Sul e Setúbal. Sofás, armários, colchões e eletrodomésticos, por profissionais verificados. Orçamento gratuito em 24h. ${AVALIACOES_TOTAL} avaliações 5★ no Google e na Fixando.`,
  alternates: { canonical: "https://clyon.pt" },
  openGraph: {
    title: "Recolha de Móveis em Lisboa — Esvaziamento de Casa",
    description:
      "Descreva o que tem para levar e receba propostas de profissionais verificados. Sofás, armários, colchões, monos e esvaziamentos. Orçamento gratuito em 24h. Lisboa, Margem Sul e Setúbal.",
    url: "https://clyon.pt",
  },
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  recolha_moveis: Sofa,
  recolha_monos: Package,
  recolha_entulho: HardHat,
  esvaziamento_casa: Home,
  esvaziamento_apartamento: Building2,
  mudanca: Truck,
  montagem_moveis: Wrench,
  jardinagem: Leaf,
  manutencao_casa: Hammer,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  recolha_moveis: { bg: "bg-cyan-50", text: "text-acao" },
  recolha_monos: { bg: "bg-amber-50", text: "text-amber-600" },
  recolha_entulho: { bg: "bg-orange-50", text: "text-orange-600" },
  esvaziamento_casa: { bg: "bg-emerald-50", text: "text-emerald-600" },
  esvaziamento_apartamento: { bg: "bg-blue-50", text: "text-blue-600" },
  mudanca: { bg: "bg-violet-50", text: "text-violet-600" },
  montagem_moveis: { bg: "bg-rose-50", text: "text-rose-600" },
  jardinagem: { bg: "bg-lime-50", text: "text-lime-600" },
  manutencao_casa: { bg: "bg-sky-50", text: "text-sky-600" },
};

/*
 * Os preços da grelha vivem em src/lib/precos-publicos.ts.
 *
 * Estavam aqui, escritos à mão, e este era o único sítio do site a tê-los —
 * o que fez com que as páginas de serviço, os metadados e os dados
 * estruturados fossem divergindo cada um para seu lado. A recolha de entulho
 * chegou a dizer 80 € no texto, 120 no schema e 90 no motor, na mesma manhã.
 */

const HERO_PILLS = [
  { id: "recolha_moveis", label: "Móveis", href: "/recolha-de-moveis" },
  { id: "recolha_entulho", label: "Entulho", href: "/recolha-de-entulho" },
  { id: "esvaziamento_casa", label: "Esvaziamento", href: "/esvaziamento-de-casas" },
  { id: "recolha_monos", label: "Monos", href: "/recolha-de-monos" },
  { id: "mudanca", label: "Mudança", href: "/mudancas" },
];

const PLATFORM_STATS = [
  {
    value: `${AVALIACOES.media} ★`,
    label: "Avaliação dos clientes",
    // "Baseado em opiniões reais" não diz nada que se possa abrir e conferir.
    // Dizer ONDE é que elas estão é o que transforma a frase numa prova.
    sub: "No Google e na Fixando",
    accent: "text-amber-500",
  },
  {
    // Era `value: "188"`, escrito à mão. Não vinha de constante, não vinha da
    // base, não era contado em lado nenhum — não tinha origem. Um número de
    // prova social que ninguém consegue confirmar é pior do que não ter número.
    value: String(AVALIACOES_TOTAL),
    label: "Avaliações verificadas",
    sub: `${AVALIACOES.google} no Google · ${AVALIACOES.fixando} na Fixando`,
    accent: "text-acao",
  },
  /*
   * Saiu daqui "9 — Categorias de serviço — Casa, jardim e mais".
   *
   * É catálogo de produto. Ninguém escolhe quem lhe leva o sofá por o site ter
   * nove categorias em vez de sete — é um número sobre a plataforma, não sobre
   * o problema de quem está a ler. No lugar dele entra a pergunta que a pessoa
   * faz mesmo: quanto tempo até ter resposta.
   */
  {
    value: PRAZO_DE_RESPOSTA.curto,
    label: "Para receber propostas",
    sub: "Muitos no próprio dia",
    accent: "text-emerald-600",
  },
  {
    value: "24+",
    // "Localidades cobertas" é como se descreve uma área de operação por
    // dentro. Quem lê quer saber uma coisa só: chegam aqui?
    label: "Cidades com profissionais",
    sub: "Lisboa · Margem Sul · Setúbal",
    accent: "text-blue-600",
  },
];

const HOW_IT_WORKS = [
  {
    icon: ClipboardList,
    title: "Descreva o trabalho",
    description:
      "Use o simulador em 2 minutos: tipo de serviço, morada, acesso e fotos. Quanto mais detalhe, mais preciso o orçamento.",
  },
  {
    icon: CheckCircle2,
    title: "Confirmamos preço e data",
    description:
      "Um assistente confirma o orçamento e agenda a data consigo. Nada avança sem a sua aprovação explícita.",
  },
  {
    icon: Truck,
    title: "Profissional na sua porta",
    description:
      "Um profissional verificado executa o trabalho na data acordada. O espaço fica limpo e pronto a usar.",
  },
];

const GUARANTEES = [
  {
    icon: BadgeCheck,
    title: "Sabe quem vai a sua casa",
    // Era `stat: "100%"` com "com historial verificado" ao lado. Cem por
    // cento de quê? É uma política interna escrita como se fosse uma
    // conquista, e não há forma nenhuma de a pessoa a confirmar. A nota e o
    // número de avaliações, esses, abrem-se e contam-se.
    stat: `${AVALIACOES.media} ★`,
    statLabel: `em ${AVALIACOES_TOTAL} avaliações`,
    description:
      // Dizia "Todos os profissionais passam por verificação de identidade e
      // avaliação de qualidade contínua. Nenhum profissional sem historial
      // entra na plataforma." — política de plataforma, escrita de dentro
      // para dentro. "Operacionais" é palavra que nenhum cliente usa, e a
      // frase falava sobre quem se admite, não sobre o que ele ganha com
      // isso. Passa a dizer o que lhe interessa: quem lhe bate à porta.
      "Vê o nome, a nota e os trabalhos do profissional antes de aceitar. Todos passam por verificação de identidade — e quem não tem historial não recebe pedidos.",
    gradient: "from-cyan-400 to-cyan-500",
    glow: "shadow-cyan-500/40",
    iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-600",
  },
  {
    icon: Shield,
    title: "O preço que combina é o que paga",
    stat: "€0",
    statLabel: "a mais no fim",
    description:
      "O valor fica fechado antes de o trabalho começar. Não há adicionais no fim, nem negociação à porta no dia da recolha.",
    gradient: "from-emerald-400 to-emerald-500",
    glow: "shadow-emerald-500/40",
    iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-600",
  },
  {
    icon: Clock,
    // Dizia "menos de 48 horas" e "<48h" em letra gigante, dois ecrãs abaixo
    // do hero que promete 24 — e na secção cujo título é "Construída para
    // inspirar confiança". Pior: a descrição por baixo já dizia "no próprio
    // dia", ou seja o cartão contradizia-se a si próprio. Todo o resto do
    // site diz 24 horas; este era o único sítio com outro número.
    // O título era `PRAZO_DE_RESPOSTA.frase` — "Resposta em menos de 24
    // horas" — com "<24h · tempo médio de resposta" em letra gigante mesmo ao
    // lado. O cartão dizia duas vezes a mesma coisa e não dizia o que isso
    // muda para quem lê.
    title: "Não fica à espera de resposta",
    stat: PRAZO_DE_RESPOSTA.curto,
    statLabel: "para receber propostas",
    description:
      `Descreva o que tem para levar e as propostas chegam em ${PRAZO_DE_RESPOSTA.porExtenso}. Em Lisboa e Margem Sul, a maioria recebe confirmação de data no próprio dia.`,
    gradient: "from-violet-400 to-violet-500",
    glow: "shadow-violet-500/40",
    iconBg: "bg-gradient-to-br from-violet-400 to-violet-600",
  },
];

const homeFaqs = [
  {
    question: "Quanto custa a recolha de monos ou móveis?",
    answer:
      "O valor depende do volume, acessos, tipo de material, urgência e necessidade de desmontagem. A forma mais rápida de obter um valor exato é usar o simulador — leva 2 minutos.",
  },
  {
    question: "Recolhem no mesmo dia?",
    answer:
      "Quando existe disponibilidade operacional, sim. Muitos pedidos em Lisboa, Grande Lisboa, Margem Sul e Setúbal conseguem resposta no próprio dia ou no dia seguinte.",
  },
  {
    question: "Retiram sofás, colchões e eletrodomésticos?",
    answer:
      "Sim. A CLYON retira sofás, camas, colchões, armários, eletrodomésticos e outros volumes grandes desde que identificados no orçamento.",
  },
  {
    question: "Fazem desmontagem de móveis?",
    answer:
      "Sim. Quando necessário, a equipa desmonta móveis e trata da retirada a partir do interior do imóvel.",
  },
  {
    question: "Atendem empresas e condomínios?",
    answer:
      "Sim. A operação serve particulares, senhorios, empresas, equipas de obra e condomínios com necessidade de recolha, limpeza ou esvaziamento.",
  },
  {
    question: "O destino dos resíduos é responsável?",
    answer:
      "Sempre que possível separamos materiais para reaproveitamento ou encaminhamento adequado. O restante segue para destino responsável e legal.",
  },
];

const homeFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export const revalidate = 3600;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:grid lg:min-h-[560px] lg:grid-cols-[1fr_420px] lg:items-center lg:gap-12 lg:px-8 lg:py-0 xl:grid-cols-[1fr_460px]">

          {/* ── Left: copy ───────────────────────────────────────────── */}
          <div className="mb-8 lg:mb-0">

            {/*
              A CLYON NÃO RETIRA NADA — LIGA QUEM RETIRA.

              O subtítulo dizia "Os profissionais retiram sofás, armários, colchões...". É a
              voz de quem executa, e a CLYON deixou de executar: é plataforma.
              Quem vai a casa, desmonta e carrega é o profissional, e é ele
              quem emite a factura.

              O problema não é de estilo. Estava escrito na segunda linha mais
              visível do site, e a linha de baixo — nas garantias — já dizia o
              contrário: "profissionais verificados". O site comunicava os dois
              modelos ao mesmo tempo, e o que ganhava a atenção era justamente
              o que está a ser abandonado.

              Regra, daqui para a frente: a CLYON ORGANIZA, CONFIRMA e GARANTE;
              o profissional EXECUTA. Nada de "retiramos", "levamos" ou "a
              equipa atribuída" em página que o cliente veja.
            */}
            {/* H1 */}
            <h1 className="text-[1.75rem] font-bold leading-[1.15] tracking-tight text-tinta sm:text-4xl lg:text-[3.2rem] lg:leading-[1.1]">
              Recolha de móveis{" "}
              <span className="text-acao">e esvaziamento</span>{" "}
              em Lisboa
            </h1>

            {/* Subtitle */}
            <p className="mt-4 text-sm leading-relaxed text-slate-500 sm:mt-5 sm:max-w-lg sm:text-base lg:text-lg">
              Descreva o que tem para levar e receba propostas de profissionais
              verificados. Sofás, armários, colchões, monos e esvaziamentos
              completos, em Lisboa, Margem Sul e Setúbal — com orçamento
              gratuito em {PRAZO_DE_RESPOSTA.porExtenso}.
            </p>

            {/* Category pills */}
            <div className="mt-5 flex flex-wrap gap-1.5 sm:mt-7 sm:gap-2">
              {HERO_PILLS.map((pill) => (
                <Link
                  key={pill.id}
                  href={pill.href}
                  className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm transition-all hover:border-cyan-400 hover:bg-cyan-50 hover:text-acao-hover sm:px-4 sm:py-1.5 sm:text-sm"
                >
                  {pill.label}
                </Link>
              ))}
              <Link
                href="/simulador"
                className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-acao backdrop-blur-sm transition-all hover:border-cyan-400 hover:bg-cyan-100 sm:px-4 sm:py-1.5 sm:text-sm"
              >
                Ver todos
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-8 sm:gap-4">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
                <span className="text-amber-500">★★★★★</span>
                <span>{AVALIACOES.media} · {AVALIACOES_TOTAL} avaliações</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500 sm:text-sm">
                Resposta em {PRAZO_DE_RESPOSTA.curto}
              </span>
              <span className="hidden text-slate-300 sm:inline">·</span>
              <a
                href="https://wa.me/351931632622?text=Ol%C3%A1!%20Gostava%20de%20pedir%20um%20or%C3%A7amento%20%C3%A0%20CLYON."
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 text-sm text-slate-500 transition hover:text-acao-hover sm:flex"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </div>

          {/* ── Right: form ──────────────────────────────────────────── */}
          <div className="lg:py-14">
            <HeroQuoteForm />
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────── */}
      <section className="border-b border-[#E2EEF3] bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Invisível, mas existe: sem ele estes números ficavam pendurados
              em cabeçalho nenhum, e quem navega por headings saltava-os. */}
          <h2 className="sr-only">A CLYON em números</h2>
          <div className="grid grid-cols-2 divide-x divide-[#E2EEF3] md:grid-cols-4">
            {PLATFORM_STATS.map((stat) => (
              <div key={stat.label} className="px-4 py-6 text-center sm:px-6 sm:py-8">
                <div className={`text-2xl font-bold sm:text-3xl ${stat.accent}`}>{stat.value}</div>
                <div className="mt-0.5 text-sm font-semibold text-tinta">{stat.label}</div>
                <div className="mt-0.5 text-xs text-tinta-fraca">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center sm:mb-16">
            <h2 className="text-2xl font-bold tracking-tight text-tinta sm:text-4xl lg:text-5xl">
              Simples do início ao fim
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:mt-4 sm:text-base lg:text-lg">
              Do pedido à porta fechada — sem chamadas desnecessárias, sem orçamentos que nunca chegam.
            </p>
          </div>

          <div className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {/* Dashed animated line — only between steps on desktop */}
            <div
              className="step-line pointer-events-none absolute top-[40px] hidden h-[2px] md:block lg:top-[52px]"
              style={{ left: "18%", right: "18%" }}
              aria-hidden="true"
            />

            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="step-enter relative flex flex-col items-center text-center"
                style={{ animationDelay: `${i * 180}ms` }}
              >
                {/* Icon with float animation + pulse ring */}
                <div className="relative">
                  <span
                    className="step-pulse-ring absolute inset-0 rounded-2xl bg-cyan-400 sm:rounded-3xl"
                    style={{ animationDelay: `${i * 400}ms` }}
                    aria-hidden="true"
                  />
                  <div
                    className="step-icon relative z-10 flex h-[80px] w-[80px] items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-xl shadow-cyan-500/30 transition-transform duration-300 hover:scale-110 hover:rotate-3 sm:h-[104px] sm:w-[104px] sm:rounded-3xl"
                    style={{ animationDelay: `${i * 400}ms` }}
                  >
                    <step.icon className="h-9 w-9 text-white sm:h-12 sm:w-12" strokeWidth={2.2} />
                    <span className="absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1929] text-xs font-bold text-white shadow-md ring-4 ring-[#F4F8FB] sm:h-8 sm:w-8 sm:text-sm">
                      {i + 1}
                    </span>
                  </div>
                </div>

                <h3 className="mt-5 text-lg font-bold text-tinta sm:mt-8 sm:text-2xl">{step.title}</h3>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500 sm:mt-3 sm:text-base">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/simulador"
              className="inline-flex items-center rounded-xl bg-acao px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:-translate-y-0.5 hover:bg-acao-hover"
            >
              Iniciar pedido agora
            </Link>
          </div>
        </div>
      </section>

      {/* ── SERVICES ──────────────────────────────────────────────── */}
      <section className="bg-white py-8 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/*
            A GRELHA DE SERVIÇOS NÃO TINHA TÍTULO.

            Entrava direta nos cartões, e os nomes dos serviços são <h3> sem
            um <h2> antes — salto de nível, que é falha do critério 1.3.1 das
            WCAG. Para quem navega por cabeçalhos, a página tinha um buraco
            entre "Simples do início ao fim" e "Construída para inspirar
            confiança", exactamente onde deviam estar os serviços.

            E porque a secção anterior TAMBÉM está em #F4F8FB, os nove cartões
            de preço liam-se como se fossem um quarto passo do processo. Esta
            secção passa a branco: é a mesma correcção vista de dois lados.

            É também SEO. A lista completa de serviços com preços é o conteúdo
            mais valioso da homepage e não tinha um cabeçalho que o Google
            pudesse associar a uma intenção de pesquisa.
          */}
          <div className="mb-8 text-center sm:mb-12">
            <h2 className="text-2xl font-bold text-tinta sm:text-3xl lg:text-4xl">
              O que podemos levar
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-tinta-fraca sm:text-base">
              Nove serviços, preços à vista. Sem ter de pedir para saber quanto custa.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {SERVICE_CATEGORIES.filter((c) => c.id !== "outro").map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id] ?? Star;
              const colors = CATEGORY_COLORS[cat.id] ?? { bg: "bg-cyan-50", text: "text-acao" };
              const price = precoDe(cat.id);
              return (
                <Link
                  key={cat.id}
                  href={cat.href}
                  className="group flex flex-col rounded-xl border border-[#E2EEF3] bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md sm:p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}>
                      <Icon className={`h-[18px] w-[18px] ${colors.text}`} strokeWidth={2} />
                    </div>
                    <h3 className="text-xs font-bold leading-snug text-tinta sm:text-sm">{cat.label}</h3>
                  </div>
                  <p className="mt-2 flex-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                    {cat.description}
                  </p>
                  {price && (
                    <div className={`mt-2.5 text-xs font-bold sm:text-sm ${colors.text}`}>
                      {price}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/*
            A nota do IVA, e porque é que ela não diz se o IVA está incluído.

            Numa plataforma, quem faz o trabalho é quem emite a factura — e
            cada profissional tem o seu regime: uns na isenção do artigo 53.º
            do CIVA, outros a liquidar 23%. "Com IVA" e "sem IVA" são as duas
            afirmações que o site não pode garantir, e o site chegou a dizer as
            duas em sítios diferentes.

            O que se garante é o que interessa a quem está a decidir: o valor é
            fechado antes de começar e não acresce nada depois.
          */}
          <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] leading-relaxed text-tinta-fraca">
            {NOTA_DE_PRECO.completa}
          </p>
        </div>
      </section>

      {/* ── GUARANTEES ────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-8 sm:py-14 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center sm:mb-14">
            {/*
              ISTO FALAVA DA PLATAFORMA, NÃO DE QUEM ESTÁ A LER.

              Dizia "Construída para inspirar confiança" e "Cada detalhe foi
              pensado para eliminar incerteza". As duas frases são a empresa a
              falar do seu próprio processo: "construída" e "pensado" são
              palavras de quem faz o produto, não de quem precisa de esvaziar
              a casa da mãe.

              A secção passa a responder às três perguntas que as pessoas
              fazem mesmo, por esta ordem: quem me entra em casa, quanto vou
              pagar no fim, e quando é que sei alguma coisa.
            */}
            <h2 className="text-2xl font-bold text-tinta sm:text-4xl lg:text-5xl">
              Antes de deixar entrar alguém em casa
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:text-base lg:text-lg">
              Três perguntas que toda a gente faz. As respostas estão aqui, antes de
              pedir seja o que for.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {GUARANTEES.map((g, i) => (
              <div
                key={g.title}
                className="guarantee-card group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.11)] sm:rounded-3xl sm:p-8"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {/* gradient top border */}
                <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${g.gradient}`} />

                {/* icon */}
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${g.iconBg} shadow-lg ${g.glow} transition-transform duration-300 group-hover:scale-110 sm:h-14 sm:w-14 sm:rounded-2xl`}>
                  <g.icon className="h-5 w-5 text-white sm:h-7 sm:w-7" />
                </div>

                {/* stat */}
                <div className="mt-4 sm:mt-6">
                  <span className={`bg-gradient-to-r ${g.gradient} bg-clip-text text-3xl font-black text-transparent sm:text-5xl`}>
                    {g.stat}
                  </span>
                  <span className="ml-2 text-xs font-medium text-tinta-fraca sm:text-sm">{g.statLabel}</span>
                </div>

                <h3 className="mt-2 text-base font-bold text-tinta sm:mt-3 sm:text-xl">{g.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:mt-3 sm:text-base">{g.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ───────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-8 sm:py-16">
        <div className="mb-8 text-center px-4 sm:mb-12">
          <h2 className="text-2xl font-bold text-tinta sm:text-3xl lg:text-4xl">
            O que dizem os nossos clientes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:text-base lg:text-lg">
            Histórias reais de quem já usou a CLYON em Lisboa, Margem Sul e Setúbal.
          </p>
        </div>

        <DesfileDeAvaliacoes />

        <div className="mt-10 text-center">
          <Link
            href="/avaliacoes"
            className="inline-flex items-center text-sm font-semibold text-acao hover:text-acao-hover"
          >
            Ver mais testemunhos
          </Link>
        </div>
      </section>

      {/* ── COVERAGE ──────────────────────────────────────────────── */}
      <section className="bg-white py-8 sm:py-12 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <h2 className="text-2xl font-bold text-tinta sm:text-3xl lg:text-4xl">Onde estamos</h2>
              <p className="mt-3 max-w-md text-sm text-slate-500 sm:mt-4 sm:text-base lg:text-lg">
                Já cobrimos mais de 24 localidades em Lisboa, Margem Sul e Setúbal —
                e continuamos a crescer.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {[
                  "Lisboa", "Amadora", "Loures", "Odivelas", "Sintra", "Cascais",
                  "Oeiras", "Almada", "Seixal", "Barreiro", "Moita", "Montijo",
                  "Setúbal", "Palmela", "Sesimbra", "Azeitão",
                ].map((city) => (
                  <span
                    key={city}
                    className="rounded-xl border border-[#E2EEF3] bg-white px-3.5 py-1.5 text-sm font-medium text-tinta shadow-sm"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl ring-1 ring-[#B8DDEE]">
              <Image
                src="/mapa-cobertura.webp"
                alt="Mapa de cobertura CLYON — Lisboa, Margem Sul e Setúbal"
                width={1123}
                height={644}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR PROFESSIONALS ─────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-cyan-50 via-white to-blue-50 py-8 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold text-tinta sm:text-3xl lg:text-4xl">
                Tem uma empresa de remoções ou transportes?
              </h2>
              <p className="mt-3 text-sm text-slate-500 sm:mt-4 sm:text-base lg:text-lg">
                Receba pedidos verificados na sua zona. Sem investimento em publicidade, sem
                leads frios — só trabalho real com clientes confirmados.
              </p>
              <div className="mt-7 flex flex-wrap gap-6">
                {[
                  { icon: Users, label: "Clientes verificados" },
                  { icon: Shield, label: "Sem leads falhados" },
                  { icon: BadgeCheck, label: "Pagamento garantido" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <item.icon className="h-4 w-4 text-acao" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0">
              <a
                href={`https://wa.me/351931632622?text=${encodeURIComponent(
                  "Olá! Sou uma empresa de remoções/transportes e quero saber mais sobre ser parceiro CLYON.",
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-acao px-8 text-base font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5 hover:bg-acao-hover"
              >
                Tornar-me parceiro
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="bg-white py-8 sm:py-12 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center sm:mb-12">
            <h2 className="text-2xl font-bold text-tinta sm:text-3xl lg:text-4xl">
              Perguntas frequentes
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:text-base">
              Respostas às dúvidas mais comuns sobre recolha de móveis, entulho e esvaziamento em Lisboa.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E2EEF3] bg-[#F4F8FB] px-4 sm:px-6 lg:px-8">
            <Accordion type="single" collapsible>
              {homeFaqs.map((faq) => (
                <AccordionItem
                  key={faq.question}
                  value={faq.question}
                  className="border-[#E2EEF3]"
                >
                  <AccordionTrigger className="text-left text-sm font-semibold text-tinta hover:no-underline sm:text-base">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────── */}
      <section className="bg-white py-8 sm:py-10 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-50 via-white to-blue-50 px-5 py-10 text-center ring-1 ring-[#E2EEF3] sm:rounded-3xl sm:px-12 sm:py-16">
            <h2 className="text-xl font-bold text-tinta sm:text-3xl lg:text-4xl">
              Pronto para libertar espaço?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:mt-4 sm:text-base lg:text-lg">
              Orçamento online, sem telefonemas. Confirme os detalhes e receba uma resposta clara.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:justify-center">
              <Link
                href="/simulador"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-acao px-6 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:-translate-y-0.5 hover:bg-acao-hover sm:h-12 sm:w-auto sm:px-8 sm:text-base"
              >
                Pedir Orçamento Grátis
              </Link>
              <a
                href="https://wa.me/351931632622?text=Ol%C3%A1!%20Gostava%20de%20pedir%20um%20or%C3%A7amento%20%C3%A0%20CLYON."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 text-sm font-semibold text-whatsapp-tinta transition-all hover:-translate-y-0.5 hover:bg-[#1ebe5d] sm:h-12 sm:w-auto sm:px-8 sm:text-base"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqSchema) }}
      />
    </div>
  );
}
