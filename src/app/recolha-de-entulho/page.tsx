import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import GuiasDoServico from "@/components/GuiasDoServico";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Landmark,
  Package,
  Phone,
  Quote,
  Recycle,
  Shovel,
  Star,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";

import CTABlock from "@/components/CTABlock";
import FAQSection from "@/components/service/FAQSection";
import PricingTable from "@/components/service/PricingTable";
import CalculadoraDeEntulho from "./CalculadoraDeEntulho";
import { getCitiesByRegion } from "@/lib/city-content";
import {
  BUSINESS_PHONE,
  CITIES,
  CONTAGENS_EM_LINHA,
  NOTAS_EM_FRASE,
  NOTAS_EM_LINHA,
  NOTA_DE_PRECO,
  PRAZO_DE_RESPOSTA,
  SITE_URL,
  getCityServiceSlug,
} from "@/lib/seo-data";
import { ENTULHO_ATE_10_SACOS, PRECOS, comMaiuscula, desdeDoVolume, maisIva } from "@/lib/precos-publicos";
import { comIvaEscrito, linhasDoEntulho, semIvaEscrito, type Valor } from "@/lib/quanto-custa";
import { PRESTADOR, caminhoDaPagina } from "@/lib/dados-estruturados";
import { ENTULHO_10_SACOS_NA_FRASE, descricaoQueCabe } from "@/lib/descricoes-seo";
import { ENTULHO_DESDE_COM_IVA } from "@/lib/titulos-seo";
import { reviews } from "@/lib/reviews-data";
import {
  A_GRANEL,
  COMO_SE_RECOLHE_ENTULHO,
  NAO_HA_CONTENTORES,
  PESO_DO_SACO,
  RESPOSTA_SOBRE_CONTENTORES,
  SACOS_POR_BIG_BAG,
  SACOS_POR_METRO_CUBICO,
} from "@/lib/sacos-de-entulho";
import {
  ACRESCIMO_POR_URGENCIA,
  PRECO_FECHADO,
  O_DIA_DO_TRABALHO_NO_INICIO,
  PROPOSTAS_EM_ATE,
  PROMESSA_DO_PRAZO,
} from "@/lib/promessas-publicas";

/*
 * A PÁGINA DO ENTULHO, REFEITA — 17-10-2026.
 *
 * *«Melhore essa página, achei-a muito fraca. Coloque mais conteúdo, com mais
 * coerência; crie uma história sobre nós; uma página completa, bonita e
 * forte, e um bom SEO.»* — o dono, que no mesmo dia corrigiu a página: *«Nós
 * fazemos recolha a granel!»*. Ela dizia que não.
 *
 * Tudo o que aqui tem número vem das constantes: preços de
 * `precos-publicos.ts`, sacos e big bags de `sacos-de-entulho.ts`, notas de
 * `seo-data.ts`, testemunhos de `reviews-data.ts` (palavra por palavra). A
 * história conta o que se sabe — as recolhas, a Fixando, a plataforma — e
 * fala como plataforma: quem vai à obra é o profissional.
 *
 * Os preços são sem IVA e nunca vão sozinhos: «+ IVA» ao lado, e o valor com
 * IVA por baixo.
 */
const PRECO_ENTULHO = PRECOS.recolha_entulho;
const LINHAS = linhasDoEntulho();

/*
 * O pedido do simulador já em «Recolha de entulho». Escrito aqui e não
 * importado da calculadora: aquele ficheiro é "use client", e uma constante
 * importada dele para um Server Component chega como referência, não como texto.
 */
const PEDIR_ENTULHO = "/simulador?servico=recolha_entulho";

/*
 * 27-10-2026 (d9): abria com «desde 120 €/m³», que assusta quem tem cinco ou
 * dez sacos. Abre agora com o preço de entrada real (os 10 sacos), sem e com
 * IVA, e o «a granel» que as empresas de contentor não fazem.
 */
const DESCRICAO = descricaoQueCabe([
  `Recolha de entulho em sacos ou a granel: ${ENTULHO_10_SACOS_NA_FRASE}.`,
  `Profissionais verificados respondem em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
  "Propostas grátis.",
]);
const TITULO = `Recolha de Entulho — 10 Sacos ${ENTULHO_DESDE_COM_IVA}`;

export const metadata: Metadata = {
  /*
   * SEM «EM LISBOA» — 29-09-2026. O hub é o das três regiões; quem responde
   * a «recolha de entulho em Lisboa» é /recolha-entulho-lisboa, e dois
   * títulos a disputar a mesma pesquisa dividem os sinais entre as duas.
   */
  title: TITULO,
  description: DESCRICAO,
  keywords: [
    "recolha de entulho",
    "recolha de entulho Lisboa",
    "recolha de entulho de obras",
    "recolha de entulho a granel",
    "recolha de entulho em sacos",
    "preço recolha de entulho",
    "remoção de entulho",
    "recolha de escombros",
    "sacos de entulho",
    "recolha de entulho Setúbal",
    "recolha de entulho Almada",
    "recolha de resíduos de construção",
  ],
  alternates: { canonical: `${SITE_URL}/recolha-de-entulho` },
  openGraph: og({
    title: TITULO,
    description: DESCRICAO,
    url: `${SITE_URL}/recolha-de-entulho`,
  }),
};

const keyCities = ["lisboa", "almada", "seixal", "setubal", "sintra", "cascais", "oeiras", "amadora"]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

/*
 * DESDE 17-10-2026 a grelha é a do dono, em `ENTULHO_POR_VOLUME`: 120 € até
 * 1 m³, 432 € até 3 m³, 720 € até 5 m³ — já não é o preço por m³ vezes o
 * volume. A composição da faixa (travessão e o símbolo uma só vez) é do
 * PricingTable: aqui passam-se os números.
 */
function desdeOsMetros(m3: number): string {
  return `${desdeDoVolume(m3)} €`;
}

const pricingRows = [
  { service: "Sacos de entulho (até 10 sacos)", priceFrom: `${ENTULHO_ATE_10_SACOS.minimo} €`, priceTo: `${ENTULHO_ATE_10_SACOS.maximo} €`, description: ENTULHO_ATE_10_SACOS.descricao },
  { service: "Recolha pequena (até 1 m³)", priceFrom: desdeOsMetros(1), description: "Remodelações de WC ou cozinha" },
  { service: "Recolha média (até 3 m³)", priceFrom: desdeOsMetros(3), description: "Obras de apartamento T1/T2" },
  { service: "Recolha grande (até 5 m³)", priceFrom: desdeOsMetros(5), description: "Demolições e renovações completas" },
  { service: "Recolha extra (acima de 5 m³)", priceFrom: "Orçamento personalizado", description: "Volumes maiores — envie fotografias" },
];

/** «desde 120 € + IVA», «40 – 50 € + IVA» — o número nunca vai sozinho. */
const semIvaComAviso = (v: Valor) => `${semIvaEscrito(v)} + IVA`;

const [ATE_10_SACOS, ATE_1_M3, ATE_3_M3, ATE_5_M3] = LINHAS;

const MEDIDAS = [
  { quanto: `${SACOS_POR_METRO_CUBICO} sacos`, oQue: "fazem cerca de 1 m³ de entulho" },
  { quanto: PESO_DO_SACO, oQue: "em cada saco de obra — desce à mão por qualquer escada" },
  { quanto: `${SACOS_POR_BIG_BAG} sacos`, oQue: "cabem num big bag, quase 1 m³ — serve de medida" },
  { quanto: "1 m³", oQue: "chega, normalmente, para uma casa de banho ou uma cozinha" },
];

const PASSOS = [
  {
    titulo: "Descreve o entulho",
    texto: "Quantos sacos ou metros cúbicos, se está ensacado ou solto, o andar, o elevador e o estacionamento. Fotografias ajudam.",
  },
  {
    titulo: `Recebe propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`,
    texto: "De profissionais verificados da sua zona, com o preço fechado e o IVA lá dentro. Vê o nome e a nota de cada um, e escolhe.",
  },
  {
    titulo: "O profissional carrega e leva",
    texto: `Em sacos ou a granel, até à carrinha, e daí para operador licenciado. ${O_DIA_DO_TRABALHO_NO_INICIO}.`,
  },
  {
    titulo: "Confirma quando estiver feito",
    texto: "Na plataforma. E é à CLYON que recorre se alguma coisa correr mal.",
  },
];

const ACEITES = [
  "Restos de obra: tijolos, cimento, azulejos",
  "Telhas, pedras e materiais de construção",
  "Gesso cartonado e isolamentos",
  "Madeiras de obra e carpintarias",
  "Sanitários e louças partidas",
  "Ferragens e materiais metálicos",
];

const FORA = [
  "Amianto — fibrocimento, telhas e placas antigas",
  "Tintas, vernizes, solventes e outros resíduos perigosos",
  "Lixo doméstico misturado com o entulho",
];

const REGRAS = [
  {
    icone: BadgeCheck,
    titulo: "O preço vem antes do saco",
    texto: `A tabela está publicada — ${maisIva(PRECO_ENTULHO.etiqueta)} — e a proposta chega fechada, já com IVA, antes de alguém pegar no primeiro saco.`,
  },
  {
    icone: Ban,
    titulo: "Só se promete o que se faz",
    texto: "Não há contentores nem big bags, e diz-se logo: quem precisa de um contentor descobre-o aqui em dez segundos, e não na véspera da obra.",
  },
  {
    icone: Recycle,
    titulo: "O entulho tem destino",
    texto: "Vai para operador licenciado, e não para o terreno ao lado. Se precisar de guia de resíduos, peça-a no pedido.",
  },
  {
    icone: UserCheck,
    titulo: "Há sempre uma pessoa",
    texto: "Cada pedido é lido por uma pessoa da CLYON antes de seguir para os profissionais, e cada profissional foi verificado antes de ter conta.",
  },
];

/* Três testemunhos, tal e qual estão em `reviews-data.ts`. */
const TESTEMUNHOS = ["Ricardo C.", "Fátima C.", "Stefanie R."]
  .map((nome) => reviews.find((r) => r.name === nome))
  .filter((r): r is (typeof reviews)[number] => Boolean(r));

const faqs = [
  {
    question: "Quanto custa a recolha de entulho?",
    answer:
      `Até 10 sacos, ${semIvaComAviso(ATE_10_SACOS.valor)}; até 1 m³, ${semIvaComAviso(ATE_1_M3.valor)}; ` +
      `até 3 m³, ${semIvaComAviso(ATE_3_M3.valor)}; até 5 m³, ${semIvaComAviso(ATE_5_M3.valor)}. ` +
      `Acima disso, a proposta faz-se a partir de fotografias. ${PRECO_FECHADO}`,
  },
  {
    question: "Recolhem entulho a granel?",
    answer: `Sim. ${A_GRANEL} Diga no pedido como está o entulho — ensacado, solto, ou as duas coisas.`,
  },
  {
    question: "Quanto pesa cada saco, e quantos sacos são 1 m³?",
    answer: `Cada saco de obra leva ${PESO_DO_SACO}. Cerca de ${SACOS_POR_METRO_CUBICO} sacos fazem 1 m³, e um big bag são uns ${SACOS_POR_BIG_BAG} sacos — quase 1 m³.`,
  },
  {
    question: "Quanto tempo demora a recolha de entulho?",
    answer: `${PROMESSA_DO_PRAZO} Se for urgente, diga-o no pedido. ${ACRESCIMO_POR_URGENCIA}`,
  },
  {
    question: "Que tipo de entulho recolhem?",
    answer: "Restos de obra como tijolos, cimento, azulejos, telhas, gesso cartonado, madeira e louças partidas. Não são aceites amianto, tintas e outros resíduos perigosos, nem lixo doméstico misturado.",
  },
  {
    question: "Fazem o carregamento do entulho?",
    answer: `Sim, o profissional carrega o entulho diretamente para a carrinha. ${COMO_SE_RECOLHE_ENTULHO} Andares sem elevador e acessos difíceis dizem-se no pedido, para entrarem na proposta.`,
  },
  {
    /*
      A PERGUNTA DOS CONTENTORES, RESPONDIDA COM UM NÃO.

      É das mais procuradas de todo o serviço, e o site respondia-lhe que sim
      — em cinco cidades, com medidas e prazos de aluguer. Não há contentores.
      A pergunta fica porque continua a ser feita; a resposta é que muda.
    */
    question: "A CLYON fornece ou aluga contentores para entulho?",
    answer: RESPOSTA_SOBRE_CONTENTORES,
  },
  {
    question: "Recolhem entulho em apartamentos?",
    answer: "Sim, em apartamentos, moradias, lojas e escritórios. Os sacos descem por qualquer escada, mesmo em prédios sem elevador — diga o andar e os acessos no pedido.",
  },
  {
    question: "E se o entulho estiver misturado com móveis ou madeira?",
    answer: "Diga-o no pedido, com fotografias: a mistura entra na proposta, e o profissional leva tudo na mesma recolha.",
  },
  {
    question: "A câmara recolhe entulho de graça?",
    answer:
      "Em vários concelhos, sim, para pequenas obras e com limites: em Lisboa, por exemplo, até 1 m³ por obra isenta de licença, a pedido. " +
      "As regras de cada câmara, com a fonte oficial, estão na página «Quanto custa recolher entulho».",
  },
];

// O caminho que os outros hubs já tinham (15-10-2026, pente fino).
const breadcrumbSchema = caminhoDaPagina([
  ["Serviços", "/servicos"],
  ["Recolha de Entulho", "/recolha-de-entulho"],
]);

/** Uma linha da grelha como oferta do catálogo, sem IVA. */
function ofertaDaLinha(nome: string, v: Valor) {
  if (v.tipo !== "faixa" && v.tipo !== "desde") return null;
  return {
    "@type": "Offer",
    name: nome,
    priceCurrency: "EUR",
    priceSpecification: {
      "@type": "PriceSpecification",
      minPrice: v.de,
      ...(v.tipo === "faixa" ? { maxPrice: v.ate } : {}),
      priceCurrency: "EUR",
      valueAddedTaxIncluded: false,
    },
  };
}

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Recolha de Entulho",
  serviceType: "Recolha de entulho de obras, em sacos ou a granel",
  description: "Recolha de entulho de obras e remodelações em Lisboa, Margem Sul e Setúbal, em sacos ou a granel, com destino licenciado.",
  // O prestador é o LocalBusiness do layout, por @id — e não uma cópia
  // sem morada (ou com uma morada inventada) em cada página (29-09-2026).
  provider: PRESTADOR,
  areaServed: keyCities.map((city) => ({ "@type": "City", name: city.name })),
  offers: {
    "@type": "Offer",
    priceCurrency: "EUR",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: PRECO_ENTULHO.minimo,
      priceCurrency: "EUR",
      minPrice: PRECO_ENTULHO.minimo,
      unitCode: "MTQ",
      unitText: PRECO_ENTULHO.unidade,
      valueAddedTaxIncluded: false,
    },
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Preços da recolha de entulho, sem IVA",
    itemListElement: LINHAS.map((l) => ofertaDaLinha(l.oQue, l.valor)).filter(Boolean),
  },
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

export default function RecolhaEntulhoPage() {
  const regioes = [
    { titulo: "Grande Lisboa", cidades: getCitiesByRegion("lisboa") },
    { titulo: "Margem Sul", cidades: getCitiesByRegion("margem-sul") },
    { titulo: "Setúbal", cidades: getCitiesByRegion("setubal") },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Herói ─────────────────────────────────────────────────────── */}
      <section className="sob-o-menu relative overflow-hidden bg-gradient-to-b from-amber-50 via-amber-50/40 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.20),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.10),_transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-8 lg:pb-20 lg:pt-14">
          <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <h1 className="text-[2.35rem] font-bold leading-[1.06] tracking-tight text-tinta sm:text-5xl lg:text-[3.6rem]">
                Recolha de entulho em Lisboa, Margem Sul e Setúbal
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Em sacos de {PESO_DO_SACO} ou a granel, carregado pelo profissional e levado para destino
                licenciado. Sem contentor na rua, com o preço à vista e a proposta fechada antes de começar.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href={PEDIR_ENTULHO} className="site-btn-primary min-w-[220px] px-6 py-3.5">
                  Pedir propostas grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={`tel:${BUSINESS_PHONE}`}
                  className="site-btn-secondary min-w-[220px] border-slate-300 text-slate-900 hover:bg-slate-50"
                >
                  <Phone className="h-4 w-4" />
                  Ligar {BUSINESS_PHONE}
                </a>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex text-amber-500" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </span>
                  <span className="font-semibold text-tinta">{NOTAS_EM_LINHA}</span>
                </span>
                <span className="hidden h-4 w-px bg-slate-300 sm:block" />
                <span>{CONTAGENS_EM_LINHA}</span>
              </div>
            </div>

            {/* O cartão dos preços: sem IVA com «+ IVA», e o com IVA por baixo. */}
            <aside className="rounded-[32px] bg-tinta p-6 text-white shadow-[0_30px_70px_-34px_rgba(11,25,41,0.6)] sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Preços de referência</p>
              <p className="mt-1 text-sm text-slate-300">O que costuma custar, antes de pedir.</p>
              <ul className="mt-5 divide-y divide-white/10">
                {LINHAS.slice(0, 4).map((l) => (
                  <li key={l.oQue} className="flex items-start justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{l.oQue}</p>
                      {l.exemplo && <p className="mt-0.5 text-xs leading-5 text-slate-400">{l.exemplo}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold tabular-nums text-amber-300">{semIvaComAviso(l.valor)}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-400">{comIvaEscrito(l.valor)} com IVA</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-slate-400">{NOTA_DE_PRECO.curta}</p>
              <Link
                href="/precos/recolha-de-entulho"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 hover:text-amber-200"
              >
                A tabela completa, e o que a câmara recolhe
                <ArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        </div>
      </section>

      {/* ── O que se promete, em quatro linhas ─────────────────────────── */}
      <section className="border-y border-amber-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-px bg-amber-100 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icone: Clock3, titulo: `Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`, texto: `${O_DIA_DO_TRABALHO_NO_INICIO}.` },
            { icone: UserCheck, titulo: "Profissionais verificados", texto: "Cada pedido é lido por uma pessoa da CLYON." },
            { icone: Recycle, titulo: "Destino licenciado", texto: "Guia de resíduos, se a pedir." },
            { icone: CheckCircle2, titulo: "Confirma no fim", texto: "Só quando estiver feito." },
          ].map((item) => (
            <div key={item.titulo} className="flex items-start gap-3 bg-white px-5 py-5 sm:px-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <item.icone className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-tinta">{item.titulo}</p>
                <p className="mt-0.5 text-sm text-slate-600">{item.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sacos, granel, e o que não há ──────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Como sai o entulho</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">
            Recolha de entulho em sacos ou a granel
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            O entulho sai como estiver na obra. O que muda é o tempo de carga — e esse fica na proposta, antes de começar.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] border border-amber-100 bg-white p-7 shadow-[0_20px_50px_-34px_rgba(180,83,9,0.18)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Package className="h-6 w-6" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-tinta">Em sacos de {PESO_DO_SACO}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Já ensacado, ou ensacado no local. Cada saco desce à mão por qualquer escada — é o que funciona em
              prédios sem elevador, em ruas estreitas e em bairros onde um contentor não cabe.
            </p>
          </div>
          <div className="rounded-[28px] border border-amber-100 bg-white p-7 shadow-[0_20px_50px_-34px_rgba(180,83,9,0.18)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Shovel className="h-6 w-6" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-tinta">A granel</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{A_GRANEL}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-fundo-alt p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500">
              <Ban className="h-6 w-6" />
            </span>
            <h3 className="mt-5 text-xl font-bold text-tinta">Sem contentores</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {NAO_HA_CONTENTORES} Nem big bags. Não fica um contentor a ocupar a rua, nem a licença de ocupação do
              espaço público que ele costuma pedir à câmara.
            </p>
          </div>
        </div>
      </section>

      {/* ── Preços ─────────────────────────────────────────────────────── */}
      <section className="bg-fundo-alt py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PricingTable
            title="Preços da Recolha de Entulho"
            subtitle={`Recolha de entulho ${maisIva(PRECO_ENTULHO.etiqueta)} em Lisboa, Margem Sul e Setúbal.`}
            rows={pricingRows}
          />
          <CalculadoraDeEntulho />
          {/* A página «quanto custa», com o IVA ao lado e a câmara concelho a concelho (17-10-2026). */}
          <p className="mt-4 text-center text-sm text-slate-600">
            <Link href="/precos/recolha-de-entulho" className="font-semibold text-acao hover:underline">
              Quanto custa recolher entulho: a tabela completa, com IVA
            </Link>
          </p>

          <div className="mt-10 rounded-[28px] border border-amber-100 bg-white p-6 sm:p-7">
            <h3 className="text-lg font-bold text-tinta">Quanto é 1 m³ de entulho?</h3>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {MEDIDAS.map((m) => (
                <div key={m.oQue} className="rounded-2xl bg-amber-50/70 px-4 py-3.5">
                  <dt className="text-xl font-bold text-amber-700">{m.quanto}</dt>
                  <dd className="mt-0.5 text-sm leading-6 text-slate-600">{m.oQue}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Passo a passo</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">Como funciona a recolha de entulho</h2>
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="relative rounded-[28px] border border-slate-200 bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tinta text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold text-tinta">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{p.texto}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Link href={PEDIR_ENTULHO} className="site-btn-primary px-6 py-3.5">
            Descrever o meu entulho
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── O que se recolhe ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[30px] border border-amber-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(180,83,9,0.12)]">
            <h2 className="text-2xl font-bold text-tinta">Que entulho se recolhe</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {ACEITES.map((item) => (
                <li key={item} className="flex items-start gap-2.5 rounded-[18px] border border-amber-100 bg-amber-50/70 p-4 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              Móveis, eletrodomésticos ou madeira misturados com o entulho? Diga-o no pedido: vão na mesma recolha, e
              entram na proposta.
            </p>
          </div>
          <div className="rounded-[30px] border border-slate-200 bg-fundo-alt p-7">
            <h2 className="text-2xl font-bold text-tinta">O que fica de fora</h2>
            <ul className="mt-6 space-y-3">
              {FORA.map((item) => (
                <li key={item} className="flex items-start gap-2.5 rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              São resíduos com regras próprias, que pedem um operador especializado.
            </p>
          </div>
        </div>
      </section>

      {/* ── A história ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-amber-50/60 py-16 lg:py-24">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Quem somos</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">
                A história da CLYON, e porque o entulho se recolhe assim
              </h2>
              <div className="mt-6 space-y-5 text-base leading-8 text-slate-700">
                <p>
                  A CLYON começou a fazer recolhas em Lisboa e na Margem Sul: móveis, monos, casas para esvaziar e
                  entulho de obras. Os primeiros clientes chegaram pela Fixando; hoje há {NOTAS_EM_FRASE}.
                </p>
                <p>
                  Em cada obra voltavam as mesmas três perguntas: quanto vai custar, como é que o entulho desce de um
                  terceiro andar sem elevador, e para onde vai. Foi a responder-lhes que a CLYON se tornou uma
                  plataforma — liga quem tem entulho para tirar a profissionais verificados da zona, e fica no meio
                  para que as respostas sejam as mesmas para toda a gente.
                </p>
                <p className="font-semibold text-tinta">O que essas obras ensinaram ficou em quatro regras.</p>
              </div>
              <Link
                href="/sobre-nos"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-acao hover:underline"
              >
                Conhecer a CLYON
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {REGRAS.map((r) => (
                <div key={r.titulo} className="rounded-[26px] border border-amber-100 bg-white p-6 shadow-[0_20px_50px_-36px_rgba(180,83,9,0.25)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
                    <r.icone className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-tinta">{r.titulo}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{r.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Quem já pediu ──────────────────────────────────────────────── */}
      {TESTEMUNHOS.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Avaliações</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-tinta sm:text-4xl">Quem já pediu à CLYON</h2>
              <p className="mt-2 text-sm text-slate-600">{NOTAS_EM_LINHA}</p>
            </div>
            <Link href="/avaliacoes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-acao hover:underline">
              Ler todas as avaliações
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {TESTEMUNHOS.map((t) => (
              <figure key={t.name} className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-6">
                <Quote className="h-6 w-6 text-amber-400" aria-hidden="true" />
                <blockquote className="mt-3 flex-1 text-sm leading-7 text-slate-700">{t.text}</blockquote>
                <figcaption className="mt-5 text-sm">
                  <span className="font-semibold text-tinta">{t.name}</span>
                  <span className="text-slate-500"> · {t.date}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ── A câmara ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 rounded-[28px] border border-slate-200 bg-fundo-alt p-6 sm:flex-row sm:items-center sm:p-7">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600">
            <Landmark className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-tinta">A câmara recolhe entulho de graça?</h2>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              Em vários concelhos, sim — pequenas quantidades, de obras isentas de licença, e com limites. Juntámos as
              regras de cada câmara, com a fonte oficial: se der para si, poupa a recolha.
            </p>
          </div>
          <Link href="/precos/recolha-de-entulho" className="site-btn-secondary shrink-0">
            Ver concelho a concelho
          </Link>
        </div>
      </section>

      {/* ── Zonas ──────────────────────────────────────────────────────── */}
      <section className="bg-white pb-16 lg:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-tinta sm:text-4xl">Recolha de entulho por zona</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            Escolha a sua terra para ver os preços e o que a câmara de lá recolhe.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {regioes.map((r) => (
              <div key={r.titulo} className="rounded-[24px] border border-amber-100 bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-tinta">
                  <Truck className="h-4 w-4 text-amber-600" />
                  {r.titulo}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {r.cidades.map((city) => (
                    <Link
                      key={city.slug}
                      href={`/${getCityServiceSlug("recolha-entulho", city.slug)}`}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-tinta transition-colors hover:border-amber-300 hover:bg-amber-50"
                    >
                      {city.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/regioes" className="inline-flex items-center gap-2 font-semibold text-amber-700 hover:text-amber-800">
              Ver todas as regiões e terras
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <GuiasDoServico servico="recolha-entulho" />

      {/* ── Perguntas ──────────────────────────────────────────────────── */}
      <section className="bg-slate-50">
        <FAQSection title="Perguntas sobre Recolha de Entulho" faqs={faqs} includeSchema={false} />
      </section>

      {/* ── Fim ────────────────────────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CTABlock
            variant="centered"
            title="Tem entulho para tirar?"
            primaryHref={PEDIR_ENTULHO}
            description={`Descreva-o em dois minutos. ${PROMESSA_DO_PRAZO} O profissional que escolher carrega-o — em sacos ou a granel — e leva-o para destino licenciado.`}
            whatsappMessage="Olá! Preciso de recolha de entulho. Podem dar-me um orçamento?"
          />
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }} />
    </div>
  );
}
