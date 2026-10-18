import type { Metadata } from "next";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Ban,
  Building2,
  CheckCircle2,
  FileText,
  HardHat,
  Home,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Quote,
  Recycle,
  Sofa,
  Star,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";

import FAQSection from "@/components/service/FAQSection";
import {
  AVALIACOES,
  BUSINESS_EMAIL,
  BUSINESS_PHONE,
  NOTAS_EM_LINHA,
  PRAZO_DE_RESPOSTA,
  REGIONS,
  SITE_URL,
} from "@/lib/seo-data";
import { IDENTIFICACAO, QUEM_FACTURA_EM_PALAVRAS } from "@/lib/identificacao-legal";
import { PRECOS, maisIva } from "@/lib/precos-publicos";
import { PRECO_FECHADO } from "@/lib/promessas-publicas";
import { getCitiesByRegion } from "@/lib/city-content";
import { reviews } from "@/lib/reviews-data";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { jsonLd } from "@/lib/json-ld";
import { PRESTADOR, caminhoDaPagina } from "@/lib/dados-estruturados";

/*
 * A PÁGINA QUE DIZ O QUE A CLYON É.
 *
 * 30-09-2026: reescrita para dizer que a CLYON é uma plataforma — falava de
 * «a equipa vai ao local» e de limpeza pós-obra, que não é um serviço. Quem
 * faz o trabalho é o profissional que o cliente escolher.
 *
 * 18-10-2026: *«Faça o melhor que puder, com muito conteúdo criativo e
 * palavras-chave nos textos; esta está sem vida, muito fraca. Bonita e bem
 * estruturada, com um copy leve.»* — o dono. Ganhou a história, os números,
 * os serviços com preço, as regiões com as terras, as avaliações, as
 * perguntas e os dados estruturados.
 *
 * A REGRA DE 30-09 CONTINUA: nada de história nem números que não existam.
 * A história conta o que se pode mostrar — as recolhas, a Fixando, as
 * avaliações, o registo na APA, a plataforma; os números vêm de `seo-data`,
 * os preços de `precos-publicos`, a identidade de `identificacao-legal`, os
 * testemunhos de `reviews-data`, palavra por palavra. As palavras-chave estão
 * no texto que se lê — texto escondido é o que o Google castiga.
 */

const DESCRICAO = descricaoQueCabe([
  "Conheça a CLYON: recolha de móveis, monos e entulho, esvaziamento de casas e mudanças em Lisboa, Margem Sul e Setúbal.",
  "Profissionais verificados, preços publicados.",
  `Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
]);

export const metadata: Metadata = {
  title: "Sobre a CLYON — Recolhas, Esvaziamentos e Mudanças",
  description: DESCRICAO,
  keywords: [
    "CLYON",
    "sobre a CLYON",
    "recolha de móveis Lisboa",
    "recolha de monos",
    "recolha de entulho",
    "esvaziamento de casas",
    "mudanças Lisboa",
    "recolha de móveis Margem Sul",
    "recolha de móveis Setúbal",
    "remoção de móveis velhos",
    "profissionais verificados",
  ],
  alternates: {
    canonical: `${SITE_URL}/sobre-nos`,
  },
  openGraph: og({
    title: "Sobre a CLYON — Recolhas, Esvaziamentos e Mudanças",
    description: DESCRICAO,
    url: `${SITE_URL}/sobre-nos`,
  }),
};

const NUMEROS = [
  { valor: `${AVALIACOES.notaGoogle} ★`, rotulo: `em ${AVALIACOES.google} avaliações no Google` },
  { valor: `${AVALIACOES.notaFixando} ★`, rotulo: `em ${AVALIACOES.fixando} avaliações na Fixando` },
  { valor: String(AVALIACOES.contratacoes), rotulo: "trabalhos contratados pela Fixando" },
  { valor: `< ${PRAZO_DE_RESPOSTA.porExtenso.replace(" horas", " h")}`, rotulo: "para receber as propostas" },
];

const CAPITULOS = [
  {
    quando: "No início",
    titulo: "As primeiras recolhas",
    texto:
      "A CLYON começou a fazer recolhas em Lisboa e na Margem Sul: móveis velhos, monos, eletrodomésticos, " +
      "entulho de obras e casas inteiras para esvaziar. Trabalho de escadas, de carrinhas e de horários " +
      "combinados ao telefone.",
  },
  {
    quando: "Depois",
    titulo: "Os primeiros clientes, e as primeiras estrelas",
    texto:
      `Chegaram pela Fixando, e foram ficando: ${AVALIACOES.contratacoes} trabalhos contratados e ` +
      `${AVALIACOES.notaFixando} em ${AVALIACOES.fixando} avaliações. As avaliações mais antigas que guardamos ` +
      "são de novembro de 2025, e repetem as mesmas palavras: rápidos, pontuais, simpáticos.",
  },
  {
    quando: "Em cada casa",
    titulo: "As mesmas três perguntas",
    texto:
      "Quanto vai custar? Quem me vem bater à porta? E para onde vai o que sai daqui? Quem precisa de tirar um " +
      "sofá de um terceiro andar ou o entulho de uma remodelação faz sempre estas perguntas — e merece respostas " +
      "antes de alguém pegar no primeiro móvel.",
  },
  {
    quando: "Hoje",
    titulo: "Uma plataforma que responde às três",
    texto:
      "A CLYON liga quem precisa de uma recolha, de um esvaziamento ou de uma mudança a profissionais " +
      `verificados da zona. Os preços estão publicados, as propostas chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, ` +
      "cada pedido é lido por uma pessoa, e o trabalho só se dá por feito quando o cliente confirma.",
  },
];

const SERVICOS = [
  {
    icone: Sofa,
    titulo: "Recolha de móveis",
    href: "/recolha-de-moveis",
    preco: maisIva(PRECOS.recolha_moveis.etiqueta),
    texto: "Sofás, camas, armários, mesas e cadeiras: o móvel velho sai de casa, desmontado se for preciso.",
  },
  {
    icone: Truck,
    titulo: "Recolha de monos",
    href: "/recolha-de-monos",
    preco: maisIva(PRECOS.recolha_monos.etiqueta),
    texto: "Monos, eletrodomésticos e o que se acumulou na arrecadação, na garagem ou na varanda.",
  },
  {
    icone: HardHat,
    titulo: "Recolha de entulho",
    href: "/recolha-de-entulho",
    preco: maisIva(PRECOS.recolha_entulho.etiqueta),
    texto: "Entulho de obras e remodelações, em sacos ou a granel, com destino licenciado e sem contentor na rua.",
  },
  {
    icone: Home,
    titulo: "Esvaziamento de casas",
    href: "/esvaziamento-de-casas",
    preco: maisIva(PRECOS.esvaziamento_casa.etiqueta),
    texto: "Casas, apartamentos, heranças e arrecadações: o recheio inteiro, de uma vez, com o que serve separado.",
  },
  {
    icone: Building2,
    titulo: "Mudanças",
    href: "/mudancas",
    preco: maisIva(PRECOS.mudanca.etiqueta),
    texto: "Mudanças de casa e de escritório, transporte de móveis e pequenas mudanças, pagas à hora.",
  },
];

const TAMBEM = [
  { href: "/recolha-de-sofas", titulo: "recolha de sofás" },
  { href: "/recolha-de-eletrodomesticos", titulo: "recolha de eletrodomésticos" },
  { href: "/recolha-de-camas", titulo: "recolha de camas e colchões" },
  { href: "/recolha-de-armarios", titulo: "recolha de armários" },
  { href: "/retirar-moveis-velhos", titulo: "retirar móveis velhos" },
  { href: "/transporte-de-moveis", titulo: "transporte de móveis" },
  { href: "/pequenas-mudancas", titulo: "pequenas mudanças" },
  { href: "/mudancas-de-escritorio", titulo: "mudanças de escritório" },
  { href: "/recolha-gratuita-de-moveis-usados", titulo: "doar móveis usados" },
];

const PRINCIPIOS = [
  {
    icone: BadgeCheck,
    titulo: "Preço à vista",
    texto: "Os preços de referência estão publicados, sem IVA e com o IVA ao lado. A proposta chega fechada antes de começar — sem contas no fim.",
  },
  {
    icone: UserCheck,
    titulo: "Uma pessoa lê cada pedido",
    texto: "Antes de seguir para os profissionais, cada pedido passa pelos olhos de alguém da CLYON. Se faltar uma fotografia ou um andar, pergunta-se.",
  },
  {
    icone: Users,
    titulo: "Profissionais verificados",
    texto: "Cada candidatura é lida antes de a conta ser aberta. Antes de escolher, vê o nome, a nota e os trabalhos de quem vai a sua casa.",
  },
  {
    icone: Banknote,
    titulo: "Paga como preferir",
    texto: "Pela plataforma, por MB WAY ou Multibanco, ou em dinheiro ao profissional. Pela plataforma, o valor só é entregue depois de confirmar que ficou tudo bem.",
  },
  {
    icone: FileText,
    titulo: "Factura, sempre",
    texto: `${QUEM_FACTURA_EM_PALAVRAS} Particular ou empresa, recebe-a em todas as vendas.`,
  },
  {
    icone: Ban,
    titulo: "Só se promete o que se faz",
    texto: "Não há contentores nem big bags, nem prazos que ninguém cumpre. O que está escrito no site é o que acontece.",
  },
];

const CLIENTES = [
  { icone: Home, titulo: "Particulares", texto: "Quem quer libertar espaço em casa, arrumar a garagem ou despedir-se do sofá antigo." },
  { icone: KeyRound, titulo: "Senhorios e gestores", texto: "A casa entre inquilinos, esvaziada e pronta para a próxima visita." },
  { icone: Building2, titulo: "Empresas e escritórios", texto: "Recolhas, esvaziamentos e mudanças de escritório, com factura." },
  { icone: HardHat, titulo: "Obras e condomínios", texto: "Entulho de remodelações, monos nas partes comuns, pedidos pontuais." },
];

const PASSOS = [
  "Descreve o que precisa: fotografias, morada, quantidade, andar e elevador.",
  `Recebe em menos de ${PRAZO_DE_RESPOSTA.porExtenso} as propostas de profissionais verificados da sua zona, já com IVA e com a taxa da plataforma.`,
  "Escolhe a proposta. O profissional vai ao local no dia combinado, retira e trata do destino.",
  "Confirma na plataforma que ficou feito — e é à CLYON que recorre se alguma coisa correr mal.",
];

/* Quatro testemunhos, tal e qual estão em `reviews-data.ts`. */
const TESTEMUNHOS = ["Patrícia S.", "Inês A.", "Paula O.", "Christian M."]
  .map((nome) => reviews.find((r) => r.name === nome))
  .filter((r): r is (typeof reviews)[number] => Boolean(r));

const REGIOES = REGIONS.map((r) => ({
  ...r,
  terras: getCitiesByRegion(r.slug as "lisboa" | "margem-sul" | "setubal").map((c) => c.name),
}));

const faqs = [
  {
    question: "O que é a CLYON?",
    answer:
      "A CLYON é uma plataforma de recolha de móveis, monos e entulho, esvaziamento de casas e mudanças em Lisboa, na Margem Sul e em Setúbal. " +
      `Liga quem precisa a profissionais verificados da zona: descreve o pedido, recebe propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso} e escolhe.`,
  },
  {
    question: "A CLYON faz os trabalhos ou é uma plataforma?",
    answer:
      "É uma plataforma. Quem vai a sua casa é o profissional independente que escolher; a CLYON lê cada pedido, verifica os profissionais, " +
      "guarda o que se combina e atende se alguma coisa correr mal.",
  },
  {
    question: "Em que zonas trabalha a CLYON?",
    answer: `${REGIOES.map((r) => `${r.name}: ${r.terras.join(", ")}`).join(". ")}. Fora destas terras, depende de haver um profissional disponível.`,
  },
  {
    question: "Como são escolhidos os profissionais?",
    answer:
      "Cada candidatura é lida por uma pessoa da CLYON antes de a conta ser aberta. Depois, cada trabalho feito fica com a avaliação do cliente — " +
      "e é essa nota que vê antes de escolher.",
  },
  {
    question: "Os preços já têm IVA?",
    answer: `Os preços de referência do site são sem IVA, e o valor com IVA aparece ao lado. ${PRECO_FECHADO}`,
  },
  {
    question: "Quem passa a factura?",
    answer: `${QUEM_FACTURA_EM_PALAVRAS} Há factura em todas as vendas, para particulares e para empresas.`,
  },
  {
    question: "Onde fica a CLYON?",
    answer: `A CLYON tem morada em ${IDENTIFICACAO.morada}. Atende por telefone e WhatsApp (${BUSINESS_PHONE}) e por email (${BUSINESS_EMAIL}), de segunda a sábado, das 08:00 às 20:00.`,
  },
  {
    question: "Sou profissional. Como posso trabalhar com a CLYON?",
    answer: "Faça a candidatura na página «Quero ser parceiro». Uma pessoa da CLYON lê-a e, se fizer sentido, abre-lhe a conta para começar a receber pedidos da sua zona.",
  },
];

const breadcrumbSchema = caminhoDaPagina([["Sobre nós", "/sobre-nos"]]);

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "Sobre a CLYON",
  url: `${SITE_URL}/sobre-nos`,
  description: DESCRICAO,
  inLanguage: "pt-PT",
  // O negócio é o LocalBusiness do layout, por @id — não se repete aqui.
  about: PRESTADOR,
  mainEntity: PRESTADOR,
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export const revalidate = 86400;

export default function SobreNosPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Herói ─────────────────────────────────────────────────────── */}
      <section className="sob-o-menu relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(0,122,140,0.08),transparent_36%),linear-gradient(180deg,rgba(236,254,255,0.9)_0%,rgba(255,255,255,1)_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-8 lg:pb-20 lg:pt-14">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <h1 className="text-[2.5rem] font-bold leading-[1.04] tracking-tight text-tinta sm:text-6xl lg:text-[4rem]">
                Libertar espaço devia ser simples.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                A CLYON é a plataforma que liga quem precisa de recolher móveis velhos, monos ou entulho, esvaziar uma
                casa ou fazer uma mudança a profissionais verificados em Lisboa, na Margem Sul e em Setúbal. Diz o que
                precisa, recebe propostas em menos de {PRAZO_DE_RESPOSTA.porExtenso}, escolhe — e só confirma quando
                estiver feito.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/simulador" className="site-btn-primary min-w-[220px] px-6 py-3.5">
                  Pedir propostas grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/precos" className="site-btn-secondary min-w-[220px]">
                  Ver os preços
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {NUMEROS.map((n, i) => (
                <div
                  key={n.rotulo}
                  className={`rounded-[26px] p-5 sm:p-6 ${
                    i === 0
                      ? "bg-tinta text-white shadow-[0_26px_60px_-30px_rgba(11,25,41,0.6)]"
                      : "border border-cyan-100 bg-white shadow-[0_20px_50px_-34px_rgba(14,116,144,0.25)]"
                  }`}
                >
                  <p className={`text-3xl font-bold tabular-nums sm:text-4xl ${i === 0 ? "text-cyan-300" : "text-tinta"}`}>
                    {n.valor}
                  </p>
                  <p className={`mt-2 text-sm leading-6 ${i === 0 ? "text-slate-300" : "text-slate-600"}`}>{n.rotulo}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── A história ─────────────────────────────────────────────────── */}
      {/*
        A abertura ao comprido e os capítulos lado a lado — 18-10-2026. Em
        duas colunas, a da esquerda acabava a meio e deixava um vazio do
        tamanho da linha do tempo («aproveitar os espaços livres», o dono).
      */}
      <section className="bg-fundo-alt py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-acao">A nossa história</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">
                Tudo começa com um sofá a descer as escadas.
              </h2>
            </div>
            <div>
              <p className="text-base leading-8 text-slate-600">
                Toda a gente conhece o momento: o sofá que já não serve, a obra que deixou entulho na varanda, a casa da
                família que é preciso esvaziar, a mudança marcada para sábado. A CLYON existe para esse momento — e para
                que ele dure pouco.
              </p>
              <Link href="/trabalhos" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-acao hover:underline">
                Ver trabalhos feitos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <ol className="relative mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {/* A linha que liga os quatro, só quando estão lado a lado. */}
            <span aria-hidden="true" className="absolute left-2 right-2 top-[7px] hidden h-0.5 bg-cyan-200 lg:block" />
            {CAPITULOS.map((c, i) => (
              <li key={c.titulo} className="relative flex flex-col">
                <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-acao ring-4 ring-fundo-alt" />
                <div className="mt-5 flex flex-1 flex-col rounded-[26px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-36px_rgba(14,116,144,0.25)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-acao">
                    {String(i + 1).padStart(2, "0")} · {c.quando}
                  </p>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-tinta">{c.titulo}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{c.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── O que se faz ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-acao">O que se pede à CLYON</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">
            Recolhas, esvaziamentos e mudanças — com o preço à vista
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Do móvel solto à casa inteira. Os valores são de referência, sem IVA; a proposta que recebe já vem com ele.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICOS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex flex-col rounded-[26px] border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_24px_60px_-34px_rgba(14,116,144,0.3)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-acao">
                <s.icone className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold text-tinta">{s.titulo}</h3>
              <p className="mt-2 flex-1 text-sm leading-7 text-slate-600">{s.texto}</p>
              <p className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="text-sm font-bold text-acao">{s.preco}</span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-acao" />
              </p>
            </Link>
          ))}
          <div className="flex flex-col justify-center rounded-[26px] bg-tinta p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-300">E também</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {TAMBEM.map((t, i) => (
                <span key={t.href}>
                  <Link href={t.href} className="font-medium text-white underline-offset-4 hover:underline">
                    {t.titulo}
                  </Link>
                  {i < TAMBEM.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* ── Princípios ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-white via-cyan-50/50 to-white py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-acao">O que nos guia</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">Seis regras que não se negociam</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PRINCIPIOS.map((p) => (
              <div key={p.titulo} className="rounded-[26px] border border-cyan-100 bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acao text-white">
                  <p.icone className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-tinta">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-acao">Como funciona</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">
              Do pedido ao espaço livre, em quatro passos.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
              Quanto mais claro for o pedido — fotografias, andar, elevador, quantidade —, mais certas são as propostas
              que recebe.
            </p>
            <Link href="/como-funciona" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-acao hover:underline">
              Como funciona, em detalhe
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ol className="space-y-4">
            {PASSOS.map((passo, i) => (
              <li key={passo} className="flex items-start gap-4 rounded-[24px] border border-slate-200 bg-white p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tinta text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="pt-1.5 text-sm leading-7 text-slate-700">{passo}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Quem nos procura ───────────────────────────────────────────── */}
      <section className="bg-fundo-alt py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-acao">Quem atendemos</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">Da sala de estar ao estaleiro</h2>
            </div>
            <Link href="/empresas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-acao hover:underline">
              Para empresas, condomínios e senhorios
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CLIENTES.map((c) => (
              <div key={c.titulo} className="rounded-[24px] border border-cyan-100 bg-white p-6">
                <c.icone className="h-6 w-6 text-acao" />
                <h3 className="mt-4 text-lg font-bold text-tinta">{c.titulo}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{c.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Onde ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-acao">Onde estamos</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">
            Lisboa, Margem Sul e Setúbal — terra a terra
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Com morada em Amora, no concelho do Seixal, e profissionais verificados dos dois lados do Tejo. Fora destas
            terras, depende de haver um profissional disponível — pergunte na mesma.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {REGIOES.map((r) => (
            <Link
              key={r.slug}
              href={`/regioes/${r.slug}`}
              className="group rounded-[26px] border border-slate-200 bg-white p-6 transition hover:border-cyan-200 hover:shadow-[0_24px_60px_-34px_rgba(14,116,144,0.3)]"
            >
              <h3 className="flex items-center gap-2 text-xl font-bold text-tinta">
                <MapPin className="h-5 w-5 text-acao" />
                {r.name}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{r.terras.join(" · ")}</p>
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-acao">
                Recolhas e mudanças {r.slug === "margem-sul" ? "na Margem Sul" : r.slug === "setubal" ? "em Setúbal" : "em Lisboa"}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Destino ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid gap-8 rounded-[32px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] p-8 text-white sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-cyan-300">
            <Recycle className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">O que sai da sua casa tem destino</h2>
            <p className="mt-3 max-w-4xl text-base leading-8 text-slate-300">
              Nem tudo o que sai de um imóvel deve seguir o mesmo caminho. O que ainda serve pode ir para
              reaproveitamento ou doação; o resto vai para um operador licenciado. Quem transporta é o profissional, e as
              regras da plataforma obrigam-no a ter as autorizações que a lei exige. A CLYON está registada como operador
              de resíduos na Agência Portuguesa do Ambiente, com o número {IDENTIFICACAO.codigoAPA}.
            </p>
            <Link
              href="/recolha-gratuita-de-moveis-usados"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              Tem móveis em bom estado? Veja quem os recolhe para doar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Avaliações ─────────────────────────────────────────────────── */}
      {TESTEMUNHOS.length > 0 && (
        <section className="bg-fundo-alt py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-acao">Avaliações</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">O que dizem de nós</h2>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <Star className="h-4 w-4 fill-current text-amber-500" aria-hidden="true" />
                  {NOTAS_EM_LINHA}
                </p>
              </div>
              <Link href="/avaliacoes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-acao hover:underline">
                Ler todas as avaliações
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {TESTEMUNHOS.map((t) => (
                <figure key={t.name} className="flex flex-col rounded-[24px] border border-slate-200 bg-white p-6">
                  <Quote className="h-6 w-6 text-cyan-400" aria-hidden="true" />
                  <blockquote className="mt-3 flex-1 text-sm leading-7 text-slate-700">{t.text}</blockquote>
                  <figcaption className="mt-5 text-sm">
                    <span className="font-semibold text-tinta">{t.name}</span>
                    <span className="text-slate-500"> · {t.date}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Profissionais ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 rounded-[28px] border border-cyan-100 bg-white p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-acao">
            <UserCheck className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-tinta">É profissional de recolhas, esvaziamentos ou mudanças?</h2>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              Receba pedidos da sua zona, com fotografias e morada, e responda com o seu preço. A candidatura é lida por
              uma pessoa da CLYON.
            </p>
          </div>
          <Link href="/quero-ser-parceiro" className="site-btn-secondary shrink-0">
            Quero ser parceiro
          </Link>
        </div>
      </section>

      {/* ── Quem somos, por escrito ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-7">
            <h2 className="text-2xl font-bold text-tinta">Quem somos, por escrito</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {IDENTIFICACAO.nomeComercial} é o nome comercial de {IDENTIFICACAO.nomeLegal},{" "}
              {IDENTIFICACAO.formaJuridica.toLowerCase()}, NIF {IDENTIFICACAO.nif}.
              {/* Quem passa a factura, dito onde se explica quem é quem (14-10-2026). */}
              {" "}{QUEM_FACTURA_EM_PALAVRAS} Há factura em todas as vendas.
            </p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-fundo-alt px-4 py-3">
                <dt className="font-semibold text-tinta">Actividade principal</dt>
                <dd className="mt-0.5 text-slate-600">CAE {IDENTIFICACAO.caePrincipal}</dd>
              </div>
              <div className="rounded-2xl bg-fundo-alt px-4 py-3">
                <dt className="font-semibold text-tinta">Operador de resíduos (APA)</dt>
                <dd className="mt-0.5 text-slate-600">{IDENTIFICACAO.codigoAPA}</dd>
              </div>
            </dl>
            <p className="mt-5 text-sm text-slate-600">
              <Link href="/termos" className="font-semibold text-acao hover:underline">Termos e condições</Link>
              {" · "}
              <Link href="/privacidade" className="font-semibold text-acao hover:underline">Privacidade</Link>
            </p>
          </div>
          <div className="space-y-3 rounded-[28px] border border-cyan-100 bg-cyan-50/60 p-7">
            <a href={`tel:${BUSINESS_PHONE}`} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <Phone className="mt-0.5 h-4 w-4 text-acao" />
              <span>
                <span className="block text-sm font-semibold text-tinta">Telefone e WhatsApp</span>
                <span className="block text-sm text-slate-600">{BUSINESS_PHONE}</span>
              </span>
            </a>
            <a href={`mailto:${BUSINESS_EMAIL}`} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <Mail className="mt-0.5 h-4 w-4 text-acao" />
              <span>
                <span className="block text-sm font-semibold text-tinta">Email</span>
                <span className="block text-sm text-slate-600">{BUSINESS_EMAIL}</span>
              </span>
            </a>
            <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <MapPin className="mt-0.5 h-4 w-4 text-acao" />
              <span>
                <span className="block text-sm font-semibold text-tinta">Morada</span>
                <span className="block text-sm text-slate-600">{IDENTIFICACAO.morada}</span>
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <MessageCircle className="mt-0.5 h-4 w-4 text-acao" />
              <span>
                <span className="block text-sm font-semibold text-tinta">Horário</span>
                <span className="block text-sm text-slate-600">De segunda a sábado, das 08:00 às 20:00</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Perguntas ──────────────────────────────────────────────────── */}
      <section className="bg-slate-50">
        <FAQSection title="Perguntas sobre a CLYON" faqs={faqs} includeSchema={false} />
      </section>

      {/* ── Fim ────────────────────────────────────────────────────────── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#062737_0%,#083344_100%)] px-8 py-10 text-white shadow-[0_26px_70px_-30px_rgba(2,6,23,0.45)] lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-cyan-200">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">Próximo passo</span>
                </div>
                <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Tem alguma coisa para tirar de casa?</h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  Descreva o pedido em dois minutos e receba propostas em menos de {PRAZO_DE_RESPOSTA.porExtenso}. Sem
                  compromisso: só avança se gostar de uma.
                </p>
              </div>
              <Link
                href="/simulador"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-acao px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-acao-hover"
              >
                Pedir propostas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(aboutSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }} />
    </div>
  );
}
