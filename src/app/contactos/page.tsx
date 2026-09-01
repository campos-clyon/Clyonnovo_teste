import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Clock3, Camera, Ruler, DoorOpen, FileText } from "lucide-react";
import ContactosClient from "./ContactosClient";
import {
  SITE_URL,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  BUSINESS_EMAIL,
  REGIONS,
  CITIES,
  AVALIACOES,
  AVALIACOES_TOTAL,
  PRAZO_DE_RESPOSTA,
} from "@/lib/seo-data";
import { PRECOS } from "@/lib/precos-publicos";
import { PROMESSA } from "@/lib/pagamento-na-plataforma";

/**
 * A página de contactos, refeita para ser encontrada.
 *
 * "A nossa página de contacto é realmente muito fraca — reformule para uma
 * página forte e competitiva no SEO do Google."
 *
 * Tinha razão, e o problema não era o desenho. Eram duzentas palavras, quase
 * todas rótulos de campos: "Nome completo", "Telemóvel", "Enviar pedido". Uma
 * página assim só é encontrada por quem já escreve "clyon" na pesquisa — ou
 * seja, por quem já a ia encontrar de qualquer maneira. Não tinha dados
 * estruturados próprios, não tinha uma única ligação para dentro do site, e
 * não respondia a nenhuma das perguntas que uma pessoa faz antes de ligar.
 *
 * O QUE ESTA PÁGINA PASSA A RESPONDER
 *
 * Quem procura "recolha de móveis Lisboa contacto" ou "empresa de entulho
 * telefone Almada" não quer um formulário: quer saber quanto tempo demora a
 * resposta, se custa alguma coisa perguntar, se vão à zona dele e o que tem
 * de ter à mão. Isso é conteúdo a sério, é único, e é exatamente o que o
 * Google procura numa página de contactos — que é uma página de intenção
 * alta e concorrência baixa, das poucas onde ainda se ganha depressa.
 *
 * AS REGRAS QUE NÃO SE QUEBRAM AQUI
 *
 * Nenhum número é escrito à mão. As avaliações vêm de AVALIACOES, os preços de
 * PRECOS, o prazo de PRAZO_DE_RESPOSTA — as mesmas constantes que o resto do
 * site usa, para nunca haver duas versões da mesma verdade em duas páginas.
 *
 * E a CLYON não diz que faz o trabalho. Quem recolhe, esvazia e muda é o
 * profissional; a CLYON põe os dois em contacto e guarda o dinheiro até estar
 * feito. Uma página de contactos que prometesse "nós vamos lá" estaria a
 * vender uma coisa que a plataforma não é.
 */

export const metadata: Metadata = {
  title: "Contactos CLYON — Telefone, WhatsApp e Orçamento Grátis em 6h",
  description:
    "Fale connosco por telefone, WhatsApp, email ou formulário. Orçamento gratuito e sem compromisso em 6 horas para recolha de móveis, entulho, monos, esvaziamentos e mudanças em Lisboa, Margem Sul e Setúbal.",
  keywords: [
    "contactos CLYON",
    "telefone recolha de móveis Lisboa",
    "orçamento recolha de entulho",
    "empresa recolha de móveis contacto",
    "pedir orçamento esvaziamento de casa",
    "recolha de monos Almada contacto",
  ],
  alternates: { canonical: `${SITE_URL}/contactos` },
  openGraph: {
    title: "Contactos CLYON — Orçamento grátis em 6 horas",
    description:
      "Telefone, WhatsApp, email ou formulário. Pedir orçamento não custa nada e não obriga a nada.",
    url: `${SITE_URL}/contactos`,
    type: "website",
  },
};

export const revalidate = 86400;

/**
 * As perguntas que se fazem ANTES de ligar.
 *
 * Não repetem as da /faq de propósito: aquelas são sobre os serviços — quanto
 * custa recolher um sofá, para onde vão os móveis. Estas são sobre o acto de
 * contactar, que é outra intenção e outra pesquisa. Duas páginas com o mesmo
 * FAQPage competem uma com a outra e o Google escolhe uma; com perguntas
 * diferentes, ficam as duas.
 */
const PERGUNTAS = [
  {
    q: "Quanto tempo demora a resposta?",
    a: `${PRAZO_DE_RESPOSTA.frase}, em dias úteis e ao sábado. Pelo WhatsApp e por telefone costuma ser mais rápido — o formulário e o email seguem o mesmo prazo. Se o pedido entrar ao domingo, a resposta sai na manhã seguinte.`,
  },
  {
    q: "Pedir um orçamento custa alguma coisa?",
    a: "Não custa nada e não obriga a nada. Recebe uma ou mais propostas de profissionais da sua zona e decide se aceita alguma. Se não aceitar nenhuma, o pedido expira sozinho e não paga.",
  },
  {
    q: "Preciso de estar em casa para receberem o pedido?",
    a: "Não. A maior parte dos pedidos resolve-se com fotografias e três informações: a morada, o andar e o que é preciso levar. A visita ao local só é necessária quando o volume é difícil de estimar — um esvaziamento completo, por exemplo — e nesse caso é combinada consigo.",
  },
  {
    q: "Trabalham na minha zona?",
    a: `Os profissionais cobrem Lisboa, a Margem Sul e o distrito de Setúbal — ${CITIES.length} localidades com página própria no site. Se a sua não estiver na lista, pergunte na mesma: cada profissional define o seu próprio raio, e há quem vá mais longe.`,
  },
  {
    q: "Posso pedir orçamento só com fotografias?",
    a: "Pode, e é a forma mais rápida. Mande as fotografias por WhatsApp com a morada e o andar. Sem imagens, o profissional propõe às cegas — e um valor proposto às cegas costuma ser mais alto, porque tem de cobrir o pior caso.",
  },
  {
    q: "Qual é o horário de atendimento?",
    a: "Segunda a sábado, das 08:00 às 20:00. Ao domingo pode deixar mensagem por WhatsApp ou pelo formulário; é respondida na segunda de manhã.",
  },
  {
    q: "É a CLYON que faz o trabalho?",
    a: PROMESSA.faqQuemFaz,
  },
  {
    q: "Que serviços posso pedir por aqui?",
    a: "Recolha de móveis, de monos e de entulho, esvaziamento de casas e apartamentos, mudanças, montagem e desmontagem de móveis, jardinagem e limpeza de quintais. Se o que precisa não está na lista, descreva-o no formulário — há profissionais para trabalhos fora do catálogo.",
  },
];

/** Preços de referência que a página mostra, tirados da fonte única. */
const REFERENCIAS = [
  { rotulo: "Recolha de móveis", chave: "recolha_moveis", href: "/recolha-de-moveis" },
  { rotulo: "Recolha de monos", chave: "recolha_monos", href: "/recolha-de-monos" },
  { rotulo: "Recolha de entulho", chave: "recolha_entulho", href: "/recolha-de-entulho" },
  { rotulo: "Esvaziamento de casa", chave: "esvaziamento_casa", href: "/esvaziamento-de-casas" },
  { rotulo: "Mudanças", chave: "mudanca", href: "/mudancas" },
  { rotulo: "Montagem de móveis", chave: "montagem_moveis", href: "/servicos" },
] as const;

const TER_A_MAO = [
  {
    Icone: MapPin,
    titulo: "A morada e a localidade",
    texto:
      "É a morada que decide que profissionais alcançam o trabalho — cada um define o seu raio a partir da base dele. Sem morada, o pedido não chega a ninguém.",
  },
  {
    Icone: DoorOpen,
    titulo: "O andar, o elevador e o estacionamento",
    texto:
      "Um segundo andar sem elevador não é o mesmo trabalho que um rés-do-chão com garagem — pode ser o dobro do tempo. Dizê-lo à partida evita a proposta ser revista no dia.",
  },
  {
    Icone: Camera,
    titulo: "Fotografias do que é preciso levar",
    texto:
      "São o que mais aproxima o orçamento do preço final. Uma fotografia de cada divisão chega; para entulho, uma do monte e outra do acesso.",
  },
  {
    Icone: Ruler,
    titulo: "A quantidade, mesmo por alto",
    texto:
      "Quantas peças, quantos sacos, quantas divisões. Trinta sacos de entulho são uma manhã; trezentos são um dia inteiro e outro camião.",
  },
  {
    Icone: Clock3,
    titulo: "Quando precisa que seja feito",
    texto:
      "Uma data concreta ajuda mais do que «o mais depressa possível». A urgência entra na conta, e um dia flexível costuma sair mais barato.",
  },
  {
    Icone: FileText,
    titulo: "Se precisa de fatura",
    texto:
      "Diga-o logo. Nem todos os profissionais emitem fatura, e saber isso à partida evita fechar negócio com quem não a passa.",
  },
] as const;

const contactPageSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "@id": `${SITE_URL}/contactos#contactpage`,
  url: `${SITE_URL}/contactos`,
  name: "Contactos CLYON",
  description:
    "Formas de contactar a CLYON para pedir orçamento gratuito de recolha de móveis, entulho, monos, esvaziamentos e mudanças em Lisboa, Margem Sul e Setúbal.",
  inLanguage: "pt-PT",
  isPartOf: { "@id": `${SITE_URL}/#website` },
  about: { "@id": `${SITE_URL}/#localbusiness` },
  /*
   * O ContactPoint vive AQUI e não no schema global.
   *
   * O LocalBusiness do layout já leva o telefone e o email, e vai no <head> de
   * todas as páginas. O que só faz sentido nesta é o ponto de contacto com
   * horário e línguas — é a página onde ele é o assunto, e é onde o Google o
   * espera encontrar.
   */
  mainEntity: {
    "@type": "ContactPoint",
    "@id": `${SITE_URL}/contactos#contactpoint`,
    contactType: "customer service",
    telephone: BUSINESS_PHONE,
    email: BUSINESS_EMAIL,
    areaServed: "PT",
    availableLanguage: ["Portuguese"],
    hoursAvailable: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "08:00",
      closes: "20:00",
    },
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/contactos#faq`,
  mainEntity: PERGUNTAS.map((p) => ({
    "@type": "Question",
    name: p.q,
    acceptedAnswer: { "@type": "Answer", text: p.a },
  })),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Contactos", item: `${SITE_URL}/contactos` },
  ],
};

export default function ContactosPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-[#F4F8FB]">
        <div className="mx-auto max-w-5xl px-4 pb-20 pt-24 sm:px-6 lg:px-8">
          {/* Migalhas visíveis: as mesmas do schema, para quem lê e para quem indexa. */}
          <nav aria-label="Percurso" className="mb-6 text-xs text-slate-500">
            <Link href="/" className="hover:text-acao">
              Início
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-700">Contactos</span>
          </nav>

          <header className="mb-10 max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-tinta sm:text-4xl">
              Falar com a {BUSINESS_NAME}
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Telefone, WhatsApp, email ou formulário — escolha o que lhe der jeito.{" "}
              <strong className="font-semibold text-tinta">
                {PRAZO_DE_RESPOSTA.frase.toLowerCase()}
              </strong>
              , e pedir orçamento não custa nada nem obriga a nada. O seu pedido chega a
              profissionais verificados que trabalham na sua zona; recebe as propostas
              deles e escolhe, se alguma lhe servir.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {AVALIACOES_TOTAL} avaliações de 5 estrelas entre a{" "}
              <a
                href={AVALIACOES.fixandoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-300 underline-offset-2 hover:text-acao"
              >
                Fixando
              </a>{" "}
              e o{" "}
              <a
                href={AVALIACOES.googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-300 underline-offset-2 hover:text-acao"
              >
                Google
              </a>
              , com média de {AVALIACOES.media}. Pode abrir os perfis e confirmar.
            </p>
          </header>

          {/* Os canais e o formulário — a parte que age. */}
          <ContactosClient />

          {/* ── O que acontece a seguir ───────────────────────────────────── */}
          <section className="mt-14">
            <h2 className="text-xl font-bold text-tinta">
              O que acontece depois de nos contactar
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              É a pergunta que ninguém faz em voz alta e toda a gente tem. São quatro
              passos e nenhum deles o compromete.
            </p>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                [
                  "O pedido é lido por uma pessoa",
                  "Ninguém responde a um formulário com um formulário. Se faltar alguma coisa para o preço fazer sentido — o andar, uma fotografia, o número de sacos — perguntamos antes de o enviar seja a quem for.",
                ],
                [
                  "Chega aos profissionais da sua zona",
                  "Só aos que fazem esse serviço e cujo raio alcança a sua morada. A sua morada exacta e o seu telefone não são visíveis para eles nesta fase — só a localidade.",
                ],
                [
                  "Recebe propostas com valores",
                  `Normalmente mais do que uma, ${PRAZO_DE_RESPOSTA.porExtenso} depois. Pode aceitar, pode contrapropor, e pode não fazer nada — uma proposta expira sozinha ao fim de 48 horas.`,
                ],
                [
                  "Escolhe, e só depois se paga",
                  PROMESSA.faqComoSePaga,
                ],
              ].map(([titulo, texto], i) => (
                <li
                  key={titulo}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-acao">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-tinta">{titulo}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{texto}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-slate-500">
              Em detalhe na página{" "}
              <Link href="/como-funciona" className="font-semibold text-acao hover:underline">
                como funciona
              </Link>
              .
            </p>
          </section>

          {/* ── O que ter à mão ───────────────────────────────────────────── */}
          <section className="mt-14">
            <h2 className="text-xl font-bold text-tinta">
              O que ter à mão para receber um preço certo
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Nada disto é obrigatório para pedir. Mas cada um destes pontos aproxima a
              proposta do valor final — e um profissional que propõe às cegas tem de
              cobrir o pior caso, o que costuma sair mais caro para si.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TER_A_MAO.map(({ Icone, titulo, texto }) => (
                <div
                  key={titulo}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-acao">
                    <Icone className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-tinta">{titulo}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{texto}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Preços de referência ──────────────────────────────────────── */}
          <section className="mt-14">
            <h2 className="text-xl font-bold text-tinta">
              Antes de contactar: os preços de referência
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Valores de partida, sem IVA, para saber se vale a pena a conversa. O preço a
              sério é a proposta que o profissional faz depois de ver o seu caso.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {REFERENCIAS.map(({ rotulo, chave, href }) => (
                <li key={chave}>
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition hover:border-cyan-200 hover:shadow"
                  >
                    <span className="text-sm font-semibold text-tinta">{rotulo}</span>
                    <span className="whitespace-nowrap text-sm font-bold text-acao">
                      {PRECOS[chave]?.etiqueta}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500">
              A tabela completa está em{" "}
              <Link href="/precos" className="font-semibold text-acao hover:underline">
                preços
              </Link>{" "}
              e há uma estimativa imediata no{" "}
              <Link href="/simulador" className="font-semibold text-acao hover:underline">
                simulador
              </Link>
              .
            </p>
          </section>

          {/* ── Onde chegamos ─────────────────────────────────────────────── */}
          <section className="mt-14">
            <h2 className="text-xl font-bold text-tinta">Onde é que os profissionais vão</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Lisboa, Margem Sul e distrito de Setúbal. Cada profissional define o seu raio
              a partir da base dele, por isso a lista não é uma fronteira — se a sua
              localidade não estiver aqui, pergunte na mesma.
            </p>
            <div className="mt-6 space-y-5">
              {REGIONS.map((regiao) => {
                const cidades = CITIES.filter((c) => c.region === regiao.slug);
                if (cidades.length === 0) return null;
                return (
                  <div key={regiao.slug}>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-acao">
                      <Link href={`/regioes/${regiao.slug}`} className="hover:underline">
                        {regiao.name}
                      </Link>
                    </h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {cidades.map((cidade) => (
                        <li key={cidade.slug}>
                          <Link
                            href={`/recolha-moveis-${cidade.slug}`}
                            className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-300 hover:text-acao"
                          >
                            {cidade.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Perguntas frequentes ──────────────────────────────────────── */}
          <section className="mt-14">
            <h2 className="text-xl font-bold text-tinta">
              Perguntas frequentes sobre contactar a {BUSINESS_NAME}
            </h2>
            <div className="mt-6 space-y-3">
              {PERGUNTAS.map((p) => (
                <details
                  key={p.q}
                  className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <summary className="cursor-pointer list-none text-sm font-bold text-tinta marker:hidden">
                    <span className="flex items-start justify-between gap-4">
                      {p.q}
                      <span
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-acao transition group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{p.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Mais perguntas sobre os serviços em si na{" "}
              <Link href="/faq" className="font-semibold text-acao hover:underline">
                página de perguntas frequentes
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
