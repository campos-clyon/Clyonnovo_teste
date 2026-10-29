import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  MessageCircle,
  Phone,
  Star,
} from "lucide-react";

import {
  AVALIACOES,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  COMO_SE_PAGA,
  FACTURA_EM_PALAVRAS,
  NOTA_DE_PRECO,
  PRAZO_DE_RESPOSTA,
  SITE_URL,
  NOTAS_EM_LINHA,
  CONTAGENS_EM_LINHA,
} from "@/lib/seo-data";
import { MENOR_PRECO_PUBLICADO, PRECOS, SEM_IVA_NA_FRASE, precoDe, maisIva } from "@/lib/precos-publicos";
import { comIvaEscrito, referenciaDoEntulho, semIvaEscrito } from "@/lib/quanto-custa";

/**
 * O «desde» de 2 m³ de entulho, pela grelha publicada, com o valor com IVA ao
 * lado (25-10-2026): dizia «desde 288 €, sem IVA», e o sem IVA nunca vai
 * sozinho. Os dois números saem da grelha; nenhum se escreve à mão.
 */
const REFERENCIA_DE_2_M3 = (() => {
  const r = referenciaDoEntulho(2, "m3");
  return r && r.valor.tipo === "desde"
    ? `${semIvaEscrito(r.valor)} + IVA (${comIvaEscrito(r.valor)} com IVA)`
    : "a da grelha publicada";
})();
import { reviews as avaliacoes } from "@/lib/reviews-data";
import { PRESTADOR } from "@/lib/dados-estruturados";
import { TELEFONE_DA_CLYON_NACIONAL, WHATSAPP_DA_CLYON } from "@/lib/telefone-da-clyon";
import { NO_MESMO_DIA } from "@/lib/promessas-publicas";

/**
 * A etiqueta oficial de um serviço.
 *
 * Quem não publica número — as mudanças — já vem de lá com
 * "orçamento personalizado", por isso o fallback diz o mesmo: nunca se
 * inventa um valor só para preencher o badge.
 */
// Com «+ IVA» ao lado do número (14-10-2026): a nota está debaixo da grelha, longe do primeiro cartão.
const etiquetaDe = (servico: string) => {
  const preco = precoDe(servico);
  return preco ? maisIva(preco) : "orçamento personalizado";
};

export const metadata: Metadata = {
  // Os serviços que existem: recolhas, esvaziamentos, mudanças e, desde que
  // voltou a 25-10-2026, a manutenção da casa.
  title: "Recolhas, Esvaziamentos, Mudanças e Manutenção",
  // Sem a limpeza pós-obra, que deixou de ser serviço activo (29-09-2026).
  description:
    `Recolha de entulho, móveis e monos, esvaziamentos, mudanças e manutenção da casa em Lisboa e Setúbal. Desde ${MENOR_PRECO_PUBLICADO} € + IVA, propostas em menos de 6 horas.`,
  alternates: { canonical: `${SITE_URL}/servicos` },
  openGraph: og({
    title: "Recolhas, Esvaziamentos, Mudanças e Manutenção",
    description:
      `Recolha de entulho, móveis e monos, esvaziamentos, mudanças e manutenção da casa em Lisboa e Setúbal. Preços desde ${MENOR_PRECO_PUBLICADO} € + IVA.`,
    url: `${SITE_URL}/servicos`,
  }),
};

const WA_HREF = `${WHATSAPP_DA_CLYON}?text=${encodeURIComponent(
  "Olá CLYON, quero pedir orçamento para um serviço.",
)}`;

/*
 * AS CONVERSAS DE EXEMPLO FALAVAM PELA EMPRESA DE ANTES — 30-09-2026.
 *
 * "Fica marcado para amanhã — 75 € tudo incluído", "hoje entre as 17h e 19h",
 * "passamos amanhã para avaliar", "mando preço em 15 minutos". Eram a CLYON a
 * marcar, a pôr preço e a ir a casa. Hoje a CLYON responde o que faz: diz o
 * valor de referência, pede as fotografias e o pedido segue para os
 * profissionais, que respondem no prazo de PRAZO_DE_RESPOSTA. E a legenda
 * deixou de dizer "exemplos reais": são exemplos.
 *
 * O cartão da limpeza pós-obra saiu com elas: não é um serviço da plataforma
 * (não está em SERVICE_CATEGORIES), e levava a /limpeza-de-quintais com um
 * preço escrito à mão que /precos contradizia.
 */
type Message = { from: "cliente" | "clyon"; text: string; time: string };

type Service = {
  title: string;
  tagline: string;
  price: string;
  href: string;
  accent: string;        // gradient
  emoji: string;         // service marker
  messages: Message[];   // stylized conversation
};

const services: Service[] = [
  {
    title: "Recolha de Móveis",
    tagline: "Sofás, camas, armários, eletrodomésticos",
    price: etiquetaDe("recolha_moveis"),
    href: "/recolha-de-moveis",
    accent: "from-cyan-400 to-blue-500",
    emoji: "🛋️",
    messages: [
      { from: "cliente", text: "Tenho um sofá e um armário para levar em Lisboa. Quanto fica?", time: "09:12" },
      { from: "clyon",   text: `Bom dia! Como referência, uma recolha de móveis fica em ${PRECOS.recolha_moveis.etiqueta}, ${SEM_IVA_NA_FRASE}. Mande duas fotos e a morada: recebe propostas de parceiros da zona em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`, time: "09:14" },
    ],
  },
  {
    title: "Recolha de Entulho",
    // Encurtada a 25-10-2026: a 375 px, a frase de 40 letras empurrava o «Ver mais» para duas linhas.
    tagline: "Restos de obra, em sacos",
    price: etiquetaDe("recolha_entulho"),
    href: "/recolha-de-entulho",
    accent: "from-amber-400 to-orange-500",
    emoji: "🧱",
    messages: [
      { from: "cliente", text: "Fiz obras na cozinha, tenho ~2 m³ de entulho. É possível hoje?", time: "14:03" },
      /*
       * O valor sai da grelha publicada (`referenciaDoEntulho`, 17-10-2026):
       * 2 m³ a 144 €/m³. Dizia 130 €, depois 220 € à mão — e cada mudança de
       * preço deixava a conversa de exemplo a prometer outro número.
       */
      { from: "clyon",   text: `Com 2 m³, a referência é ${REFERENCIA_DE_2_M3}. Se é para hoje, diga-o no pedido — depende de haver parceiro disponível.`, time: "14:05" },
    ],
  },
  {
    title: "Esvaziamento de Casas",
    tagline: "Libertação completa do imóvel",
    price: etiquetaDe("esvaziamento_casa"),
    href: "/esvaziamento-de-casas",
    accent: "from-emerald-400 to-teal-500",
    emoji: "🏠",
    messages: [
      { from: "cliente", text: "Herdei um T2 cheio e preciso de esvaziar para vender. Ajudam?", time: "10:40" },
      { from: "clyon",   text: "Sim. Mande fotos de cada divisão e a morada: parceiros da sua zona respondem com propostas, e o acesso combina-se com quem escolher.", time: "10:42" },
    ],
  },
  {
    title: "Recolha de Monos",
    tagline: "Volumes grandes e acumulados",
    price: etiquetaDe("recolha_monos"),
    href: "/recolha-de-monos",
    accent: "from-fuchsia-400 to-pink-500",
    emoji: "📦",
    messages: [
      { from: "cliente", text: "Tenho garagem cheia de tralha antiga, quero libertar espaço.", time: "16:20" },
      { from: "clyon",   text: `Envie 2 ou 3 fotos por WhatsApp: recebe propostas de parceiros da zona em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`, time: "16:21" },
    ],
  },
  {
    title: "Mudanças",
    tagline: "Casa, escritório, com desmontagem",
    price: etiquetaDe("mudanca"),
    href: "/mudancas",
    accent: "from-indigo-400 to-purple-500",
    emoji: "🚚",
    messages: [
      { from: "cliente", text: "Mudança de T2 no dia 15, com desmontagem de roupeiro.", time: "11:08" },
      { from: "clyon",   text: `Mande as duas moradas e fotos das divisões: as propostas chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, já com a taxa da plataforma.`, time: "11:10" },
    ],
  },
  /*
   * A MANUTENÇÃO DA CASA — 25-10-2026. Voltou ao plano com reparações e
   * remodelações, e o hub ficava com cinco cartões e um vazio na grelha de
   * três. O preço é o da fonte; a conversa não diz número nenhum, porque uma
   * remodelação não se avalia pela referência de um arranjo.
   */
  {
    title: "Manutenção da Casa",
    tagline: "Reparações e remodelações",
    price: etiquetaDe("manutencao_casa"),
    href: "/servicos/manutencao-casa",
    accent: "from-rose-400 to-red-500",
    emoji: "🛠️",
    messages: [
      { from: "cliente", text: "Quero pintar a sala e mudar a torneira da cozinha, no Seixal. Também tratam disso?", time: "17:32" },
      { from: "clyon",   text: `Sim. Mande fotografias e a morada: parceiros verificados da sua zona respondem com propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, com o preço fechado antes de começar.`, time: "17:34" },
    ],
  },
];

const steps = [
  { n: "1", title: "Envie fotos", text: "Por WhatsApp ou pelo formulário. Basta a morada e algumas fotos." },
  {
    n: "2",
    title: "Receba propostas",
    text: `Parceiros verificados da sua zona respondem em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, com o preço já com a taxa da plataforma.`,
  },
  { n: "3", title: "Escolha e combine", text: "Aceita a proposta que quiser e combina o dia com o parceiro." },
];

/*
 * OS TESTEMUNHOS SÃO OS DE reviews-data, PALAVRA POR PALAVRA — 30-09-2026.
 *
 * Estavam aqui três escritos à mão — "Rita M.", "Carlos S.", "Patrícia C." —
 * que não existem na lista das avaliações reais, e uma nota de "4,9 / 5" que
 * não era a de lado nenhum. Um testemunho que não se encontra em lado nenhum
 * é pior do que nenhum. Ficam os três primeiros da fonte única, com a data, e
 * a nota da constante.
 */
const reviews = avaliacoes.slice(0, 3);

const faqs = [
  {
    q: "Que tipo de pedidos a CLYON aceita?",
    a: "Recolha de entulho, móveis, monos e recheios, esvaziamento de casas, mudanças e manutenção da casa, com reparações e remodelações — de particulares e empresas. Quem faz o trabalho é o parceiro que escolher.",
  },
  {
    q: "Recolhem no mesmo dia?",
    a: NO_MESMO_DIA,
  },
  {
    q: "Fazem desmontagem dentro de casa?",
    a: "Sim. Os parceiros desmontam os móveis e tratam do carregamento a partir do interior do imóvel, loja, escritório ou arrecadação.",
  },
  {
    q: "Como pagar?",
    // Dizia "MB WAY, transferência ou numerário. Emitimos fatura sempre." —
    // nem as formas eram estas, nem é a CLYON que factura (30-09-2026).
    a: `${COMO_SE_PAGA} ${FACTURA_EM_PALAVRAS}`,
  },
  {
    q: "Trabalham com empresas e condomínios?",
    a: "Sim — particulares, senhorios, empresas, gestores de património, condomínios e equipas de obra.",
  },
];

export const revalidate = 86400;

const serviceListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Serviços CLYON",
  itemListElement: services.map((s, i) => ({
    "@type": "Service",
    position: i + 1,
    name: s.title,
    description: s.tagline,
    // O prestador é o LocalBusiness do layout, por @id — e não uma cópia
    // sem morada (ou com uma morada inventada) em cada página (29-09-2026).
    provider: PRESTADOR,
    areaServed: ["Lisboa", "Setúbal", "Almada", "Seixal"],
  })),
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

// ─── Chat card ─────────────────────────────────────────────────────────────
function ChatCard({ service }: { service: Service }) {
  return (
    <Link
      href={service.href}
      className="group relative flex flex-col overflow-hidden rounded-[26px] border border-[#E2EEF3] bg-white shadow-[0_10px_40px_-24px_rgba(14,116,144,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-24px_rgba(14,116,144,0.35)]"
    >
      {/* Header com gradiente e emoji */}
      {/*
        O título quebra a linha em vez de ser cortado (25-10-2026): a 375 px,
        ao lado do selo do preço, o `truncate` deixava «Recolha de Entu…»,
        «Esvaziamento de C…» e «Manutenção da…». O emoji e o selo não
        encolhem, e o selo fica numa linha só.
      */}
      <div className={`relative flex items-center gap-3 bg-gradient-to-r ${service.accent} px-5 pb-5 pt-4 text-white`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-xl backdrop-blur-sm">
          {service.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white/85">CLYON · Lisboa</p>
          <h3 className="break-words text-[15px] font-bold leading-tight">{service.title}</h3>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-900">
          {service.price}
        </span>
      </div>

      {/* Bolhas de conversa */}
      <div className="flex flex-col gap-2.5 bg-[#F5F9FC] px-4 py-4">
        {service.messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "cliente" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug shadow-sm ${
                m.from === "cliente"
                  ? "rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200/70"
                  : "rounded-br-md bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
              }`}
            >
              <p>{m.text}</p>
              <div
                className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                  m.from === "cliente" ? "text-tinta-fraca" : "text-white/75"
                }`}
              >
                <span>{m.time}</span>
                {m.from === "clyon" && <Check className="h-3 w-3" strokeWidth={3} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-3.5">
        <p className="text-sm text-slate-600">{service.tagline}</p>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-acao transition group-hover:text-cyan-500">
          Ver mais
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export default function ServicosPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="sob-o-menu relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 md:pb-12 md:pt-16 lg:px-8">
          <h1 className="max-w-[16ch] text-[2rem] font-bold leading-[1.08] tracking-tight text-tinta sm:text-5xl md:text-6xl">
            Recolhas, esvaziamentos, mudanças e manutenção <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">sem complicar.</span>
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Envie fotos e a morada: o pedido chega a parceiros verificados da sua zona, e
            recebe propostas em menos de {PRAZO_DE_RESPOSTA.porExtenso}. Lisboa, Margem Sul e Setúbal.
          </p>

          {/* CTAs primárias */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={WA_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:text-base"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp — pedir orçamento
            </a>
            <Link
              href="/simulador"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 sm:text-base"
            >
              Pedir propostas
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:text-base"
            >
              <Phone className="h-4 w-4" />
              {TELEFONE_DA_CLYON_NACIONAL}
            </a>
          </div>

          {/* Reassurance strip */}
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 sm:grid-cols-4 sm:text-sm">
            {/* "Fatura sempre" saiu: a factura é da parceira, e só quando o
                cliente a pede (30-09-2026). */}
            {[
              "Orçamento grátis",
              "Sem visita prévia",
              "Parceiros verificados",
              "Destino responsável",
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-acao" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-10 md:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-3 md:mb-8">
            <div>
              <h2 className="text-2xl font-bold leading-tight text-tinta sm:text-3xl md:text-4xl">
                O que pode pedir
              </h2>
              <p className="mt-1 text-sm text-slate-500 sm:text-base">Exemplos do que nos perguntam, e do que respondemos.</p>
            </div>
            <Link
              href="/precos"
              className="hidden text-sm font-semibold text-acao hover:text-cyan-500 sm:inline-flex sm:items-center sm:gap-1"
            >
              Ver preços <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ChatCard key={s.title} service={s} />
            ))}
          </div>

          {/*
            Os valores dos badges são orientativos e SEM IVA, e isso tem de
            estar dito debaixo da grelha que os mostra — não numa página de
            condições que ninguém abre.
          */}
          <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] leading-relaxed text-tinta-fraca">
            {NOTA_DE_PRECO.curta}
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="bg-white py-10 md:py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold leading-tight text-tinta sm:text-3xl md:text-4xl">
            Como pedir — 3 passos
          </h2>
          <p className="mt-2 max-w-lg text-sm text-slate-600 sm:text-base">
            Sem visita prévia, sem burocracia. Fotos + morada = propostas.
          </p>

          <ol className="mt-6 grid gap-3 md:grid-cols-3 md:gap-5">
            {steps.map((step) => (
              <li key={step.n} className="relative rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5">
                <span className="absolute -top-3 left-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-md">
                  {step.n}
                </span>
                <h3 className="mt-2 text-base font-bold text-tinta sm:text-lg">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── REVIEWS ──────────────────────────────────────────────────── */}
      <section className="bg-[#F4F8FB] py-10 md:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between gap-3 md:mb-8">
            <div>
              <div className="flex items-center gap-1.5 text-amber-400">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
                <span className="ml-1 text-sm font-semibold text-slate-900">{NOTAS_EM_LINHA}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{CONTAGENS_EM_LINHA}</p>
            </div>
            <Link
              href="/avaliacoes"
              className="hidden text-sm font-semibold text-acao hover:text-cyan-500 sm:inline-flex sm:items-center sm:gap-1"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {reviews.map((r) => (
              <figure key={r.name} className="rounded-2xl border border-[#E2EEF3] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-1 text-amber-400">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-2 text-sm leading-6 text-slate-700">&ldquo;{r.text}&rdquo;</blockquote>
                <figcaption className="mt-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white">
                    {r.name.charAt(0)}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                  <span className="text-xs text-slate-500">{r.date}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-10 md:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold leading-tight text-tinta sm:text-3xl md:text-4xl">
            Perguntas frequentes
          </h2>
          <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {faqs.map((f) => (
              <details key={f.q} className="group px-4 py-3.5 open:bg-slate-50 sm:px-5">
                <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-semibold text-slate-900 sm:text-base [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition group-open:rotate-45 group-open:border-cyan-500 group-open:text-acao">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="bg-white pb-10 md:pb-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-8 text-white shadow-xl md:px-10 md:py-12">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">
                  Já sabe o serviço? Peça agora.
                </h2>
                <p className="mt-2 max-w-lg text-sm text-cyan-50 sm:text-base">
                  Envie o pedido pelo WhatsApp ou pelo formulário — propostas em menos de{" "}
                  {PRAZO_DE_RESPOSTA.porExtenso}.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <a
                  href={WA_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-acao transition hover:bg-cyan-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <Link
                  href="/simulador"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950/25 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-slate-950/40"
                >
                  Pedir propostas
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
        A barra fixa desta página foi retirada.

        Estava em `z-40` e `bottom-0`, e a MobileBottomNav do site inteiro está
        em `z-50` e `bottom-0` — ou seja, esta ficava TAPADA por ela e ninguém
        a via. O `pb-24` que lhe reservava espaço no topo do ficheiro
        reservava-o a uma barra invisível.

        Duas barras fixas no fundo do mesmo ecrã é sempre um bug: ou se
        empilham e comem 130 px de altura, ou uma cobre a outra. Aqui era a
        segunda. Ficou a do site, que tem o botão Simular no meio.

        O que se perdeu de facto: nada — não se via. O que continua em falta,
        e é anterior a isto: abaixo de 1024 px não há atalho de WhatsApp no
        cabeçalho (Header.tsx:208 é `hidden lg:flex`).
      */}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(serviceListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
      />
    </div>
  );
}
