import { OFERTA_DA_MUDANCA, PRECO_DA_MUDANCA_CURTO, PRECO_DA_MUDANCA_NA_DESCRICAO } from "@/lib/tabela-das-mudancas";
import type { Metadata } from "next";
// Com outro nome: esta página já tem uma constante `jsonLd`, que é o objecto.
import { jsonLd as paraScriptJsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Route,
  Shield,
  Star,
} from "lucide-react";

import CTABlock from "@/components/CTABlock";
import ProfissionaisComPagina from "@/components/ProfissionaisComPagina";
import FAQSection from "@/components/service/FAQSection";
import {
  BUSINESS_PHONE,
  PRAZO_DE_RESPOSTA,
  SITE_URL,
  CONTAGENS_EM_LINHA,
  NOTAS_EM_LINHA,
} from "@/lib/seo-data";
import { PRESTADOR } from "@/lib/dados-estruturados";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import {
  CIDADES_MUDANCAS,
  getAllCidadeSlugs,
  getCidadeMudancaBySlug,
} from "@/lib/mudancas-cidades";
import { getCidadeLocal } from "@/lib/cidades-local";
import { caminhoDoServicoNaCidade } from "@/lib/caminho-da-cidade";
import { PEDIR_MUDANCA, TIPOS_DE_MUDANCA } from "@/lib/tipos-de-mudanca";
import { tituloDaMudanca } from "@/lib/titulos-seo";
import { AO_FIM_DE_SEMANA, O_DIA_DO_TRABALHO_NO_INICIO, PROPOSTAS_EM_ATE, PROMESSA_DO_PRAZO } from "@/lib/promessas-publicas";
import { deTerra, emTerra, paraTerra } from "@/lib/preposicao-da-terra";
import { localidadesDaPagina } from "@/lib/localidades-dos-concelhos";

interface Props {
  params: Promise<{ cidade: string }>;
}

/*
 * Uma vez por dia: o bloco dos profissionais da cidade vem da base, e um
 * profissional aprovado hoje não deve esperar pelo próximo deploy para
 * aparecer na página da zona dele (o mesmo das páginas de recolha).
 */
export const revalidate = 86400;

/**
 * AS PERGUNTAS QUE TODAS AS CIDADES TÊM — 09-10-2026.
 *
 * Cada cidade tinha duas ou três perguntas, todas sobre ela. Faltavam as que
 * toda a gente faz antes de pedir — como funciona, quem vai, o preço muda? — e
 * eram essas que as páginas das recolhas respondiam e estas não. Vêm depois
 * das da cidade, com o nome dela, e das constantes de `promessas-publicas`:
 * o que se promete aqui é o mesmo que se promete no resto do site.
 */
function perguntasGerais(nome: string): Array<{ pergunta: string; resposta: string }> {
  return [
    {
      pergunta: `Como funciona o pedido de mudança ${emTerra(nome)}?`,
      resposta: `Descreve a mudança — as duas moradas, os andares, se há elevador e o que vai — e o pedido chega a parceiros verificados com actividade ${emTerra(nome)}. Recebe as propostas ${PROPOSTAS_EM_ATE}, compara e escolhe; pedir não custa nada.`,
    },
    {
      pergunta: "Quem faz a mudança?",
      resposta:
        "Um parceiro independente, com a viatura e as pessoas dele. A CLYON liga o seu pedido aos parceiros, guarda a proposta escrita e acompanha o trabalho até ao fim — não tem camiões nem equipas próprias.",
    },
    {
      pergunta: "O preço pode mudar no dia da mudança?",
      // À hora desde 13-10-2026: o que se acorda é o preço da hora.
      resposta: `Fica acordado por escrito o preço da hora (${PRECO_DA_MUDANCA_CURTO}); o total depende das horas de trabalho no dia. Por isso vale a pena descrever bem o volume e os acessos: é com isso que o parceiro prevê as horas.`,
    },
    {
      pergunta: "Fazem mudanças ao fim de semana?",
      resposta: AO_FIM_DE_SEMANA,
    },
    {
      pergunta: "Posso pedir só o transporte de alguns móveis?",
      resposta:
        "Sim. Um sofá, uma cama, um roupeiro ou poucos volumes também se pedem — é um transporte de móveis, com o mesmo pedido e as mesmas propostas.",
    },
  ];
}

/** Os outros serviços na mesma cidade — quem muda de casa muitas vezes esvazia a antiga. */
const SERVICOS_NA_MESMA_CIDADE = [
  { servico: "recolha-moveis", rotulo: "Recolha de móveis" },
  { servico: "esvaziamento-casas", rotulo: "Esvaziamento de casas" },
  { servico: "recolha-monos", rotulo: "Recolha de monos" },
  { servico: "recolha-entulho", rotulo: "Recolha de entulho" },
] as const;

/** Pré-gerar todas as páginas estáticas em build — máxima performance + SEO */
export function generateStaticParams() {
  return getAllCidadeSlugs().map((cidade) => ({ cidade }));
}

/** Metadata única por cidade — title, description e canonical */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidade } = await params;
  const c = getCidadeMudancaBySlug(cidade);
  if (!c) return { title: "Mudanças" };

  /*
   * Sem « | CLYON» no fim (29-09-2026): o template do layout acrescenta-o, e
   * as treze páginas saíam no Google como «Mudanças em Sintra — Orçamento em
   * 6h | CLYON | CLYON». O `comExtra` deita fora o «Orçamento em 6h» numa
   * terra de nome comprido em vez de deixar o Google cortar o título.
   */
  const title = tituloDaMudanca(c.nome);
  // O PREÇO À HORA, E PARA QUANTOS É (14-10-2026). Aqui não havia número
  // nenhum: a meta description dizia «Preços desde 150€» para um serviço que
  // o motor facturava a partir de 490 €, e saiu. Desde 13-10-2026 há tabela,
  // e o dono manteve-a («Mantenha as mudanças a 50 € + IVA por hora»): o
  // número que a página mostra é o que o Google mostra, com a equipa ao lado.
  //
  // E até 155 caracteres (29-09-2026): tinha 161 a 173, e o Google cortava o
  // prazo, que é o que a pessoa quer saber. O essencial primeiro; o resto só
  // se couber inteiro (ver descricoes-seo.ts).
  const description = descricaoQueCabe([
    `Mudanças ${emTerra(c.nome)} a ${PRECO_DA_MUDANCA_NA_DESCRICAO}.`,
    `Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
    "Orçamento grátis.",
  ]);

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/mudancas/${c.slug}` },
    openGraph: og({
      title,
      description,
      url: `${SITE_URL}/mudancas/${c.slug}`,
    }),
    // Sem `twitter` próprio (29-09-2026): o do layout já tem o cartão e a
    // imagem, e o Next preenche o título e a descrição com os do Open Graph.
    // Definido aqui, substituía o do layout e perdia a imagem.
  };
}

export default async function MudancasCidadePage({ params }: Props) {
  const { cidade } = await params;
  const c = getCidadeMudancaBySlug(cidade);
  if (!c) notFound();

  const faqs = [...c.faqs, ...perguntasGerais(c.nome)];
  const local = getCidadeLocal(c.slug);
  // As terras que se juntaram a esta página (d13, 28-10-2026): a Amora e
  // Corroios ao Seixal, a Costa da Caparica a Almada.
  const terrasDoConcelho = localidadesDaPagina(`mudancas/${c.slug}`);
  const cidadeServida = {
    "@type": "City",
    name: c.nome,
    geo: { "@type": "GeoCoordinates", latitude: c.geo.lat, longitude: c.geo.lng },
  };

  // ── Schema.org: Service + FAQPage + BreadcrumbList ─────────────────────────
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      /*
       * SEM O `LocalBusiness` DA CIDADE — 29-09-2026.
       *
       * Havia aqui um «CLYON — Mudanças em Sintra» com morada em Sintra, e o
       * mesmo nas treze cidades: treze empresas com o mesmo nome e telefone,
       * cada uma a declarar uma morada onde a CLYON não tem porta. É o padrão
       * das fichas locais falsas, e não é o que a CLYON é — é uma plataforma
       * com sede em Amora, e quem faz as mudanças são os profissionais.
       *
       * Fica o serviço, com o prestador verdadeiro (o `LocalBusiness` do
       * layout, por `@id`) e a cidade onde se presta em `areaServed`. As
       * coordenadas passam para a cidade, que é o que elas sempre foram.
       */
      {
        "@type": "Service",
        "@id": `${SITE_URL}/mudancas/${c.slug}#service`,
        serviceType: "Mudanças residenciais e comerciais",
        name: `Mudanças ${emTerra(c.nome)}`,
        description: `Mudanças de casa e de escritório, pequenas mudanças e transporte de móveis ${emTerra(c.nome)}, por parceiros verificados da zona.`,
        provider: PRESTADOR,
        // Com as terras que se juntaram a esta página, só pelo nome (d13).
        areaServed:
          terrasDoConcelho.length > 0
            ? [cidadeServida, ...terrasDoConcelho.map((t) => ({ "@type": "City", name: t.nome }))]
            : cidadeServida,
        /*
         * Aqui estava um `AggregateOffer` com `lowPrice` a 140–220 € consoante
         * a cidade, que o motor nunca praticava, e saiu. Desde 17-10-2026
         * declara-se a tabela à hora, a que a página mostra no cartão do preço
         * (`OFERTA_DA_MUDANCA`).
         */
        offers: OFERTA_DA_MUDANCA,
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.pergunta,
          acceptedAnswer: { "@type": "Answer", text: f.resposta },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Mudanças", item: `${SITE_URL}/mudancas` },
          { "@type": "ListItem", position: 3, name: c.nome, item: `${SITE_URL}/mudancas/${c.slug}` },
        ],
      },
    ],
  };

  const vizinhas = c.cidadesVizinhas
    .map((slug) => CIDADES_MUDANCAS.find((v) => v.slug === slug))
    .filter((v): v is (typeof CIDADES_MUDANCAS)[number] => Boolean(v));

  return (
    <div className="bg-gradient-to-br from-white via-emerald-50/30 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: paraScriptJsonLd(jsonLd) }}
      />

      {/* Sem o caminho «Início / …» à vista — 18-10-2026, a pedido do dono. Fica no JSON-LD. */}

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Mudanças {emTerra(c.nome)}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Mudanças residenciais e comerciais {emTerra(c.nome)} por parceiros
              verificados da zona — embalagem, carga, transporte, descarga e
              montagem, conforme o que pedir. {PROMESSA_DO_PRAZO}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={PEDIR_MUDANCA}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 hover:shadow-lg"
              >
                Pedir orçamento grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={`tel:${BUSINESS_PHONE}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
              >
                <Phone className="h-4 w-4" /> Ligar {BUSINESS_PHONE}
              </a>
            </div>

            {/*
              Dizia "Preços desde {precoMin}€ para T0/T1". O motor factura a
              mudança a partir de 490 € — o número que estava aqui prometia
              menos de metade. Sai o valor, fica o prazo, que é verdade.
            */}
            <p className="mt-3 text-xs text-slate-500">
              <strong className="text-emerald-600">Propostas grátis</strong> em menos de 6 horas {paraTerra(c.nome)}
            </p>
          </div>

          {/* Info cards à direita */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* 30-09-2026: o primeiro cartão era «Distância à base — X km, ~Y de
                viagem», medida a partir de Fernão Ferro. Quem faz a mudança é
                um profissional da zona, a partir da base dele; a distância à
                CLYON não diz nada a quem contrata. */}
            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Quem faz</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">Parceiros da sua zona</p>
              <p className="text-xs text-tinta-fraca">Independentes e verificados</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Propostas em menos de</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">6 horas</p>
              <p className="text-xs text-tinta-fraca">{O_DIA_DO_TRABALHO_NO_INICIO}</p>
            </div>
            {/*
              Este cartão mostrava a faixa "{precoMin}€ – {precoMax}€" da
              cidade. Era o número mais visível da página e o mais errado: o
              motor factura a partir de 490 €. Em vez de outra faixa, o cartão
              passa a dizer o que determina o preço — que é a informação que o
              cliente procura quando olha para aqui.
            */}
            <div className="col-span-full rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Preço {emTerra(c.nome)}</p>
              {/* A tabela à hora (13-10-2026) — a mesma em todas as cidades. */}
              <p className="mt-1 text-2xl font-bold text-emerald-600">{PRECO_DA_MUDANCA_CURTO}</p>
              <p className="text-xs text-tinta-fraca">
                Carrinha, motorista e 2 ajudantes ·{" "}
                <Link href="/precos/mudancas" className="underline">
                  quanto custa, do T0 ao T4
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rotas comuns ── */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Rotas mais pedidas a partir {deTerra(c.nome)}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          O pedido pode ir para qualquer destino da região. Algumas das rotas mais comuns:
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {c.rotasComuns.map((rota) => (
            <div
              key={rota}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
            >
              <Route className="h-4 w-4 shrink-0 text-emerald-500" />
              {rota}
            </div>
          ))}
        </div>
      </section>

      {/* ── Landmarks / Zonas ── */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Zonas {deTerra(c.nome)} e o que cada uma pede
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Cada bairro tem os seus desafios logísticos — dizê-los no pedido é o que deixa as propostas certas.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {c.landmarks.map((l) => (
            <li key={l} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-sm text-slate-700">{l}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Particularidade logística {deTerra(c.nome)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{c.desafio}</p>
        </div>

        {/*
          ESTACIONAR A CARRINHA — o que cidades-local.ts sabe da zona, e o que
          mais pesa numa mudança depois dos andares. É o mesmo texto das
          páginas de recolha da cidade, porque é a mesma rua (09-10-2026).
        */}
        {local && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Estacionar a carrinha {emTerra(c.nome)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{local.estacionamento}</p>
            <p className="mt-3 text-xs text-slate-500">
              Zonas: {local.zonas.join(", ")}.
            </p>
          </div>
        )}
      </section>

      {/* ── As terras do concelho que se juntaram a esta página (d13) ── */}
      {terrasDoConcelho.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className={`grid gap-4 ${terrasDoConcelho.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {terrasDoConcelho.map((terra) => (
              <div key={terra.enderecoAntigo} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-2xl font-bold text-slate-900">{terra.titulo}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-base">{terra.texto}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Testemunho (se existir) ── */}
      {c.testemunho && (
        <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <blockquote className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm">
            <div className="mb-3 flex gap-0.5">
              {Array.from({ length: c.testemunho.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-base italic leading-relaxed text-slate-700">
              &ldquo;{c.testemunho.texto}&rdquo;
            </p>
            <footer className="mt-4 text-sm font-semibold text-slate-600">— {c.testemunho.autor}</footer>
          </blockquote>
        </section>
      )}

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* `includeSchema={false}`: o FAQPage já vai no @graph de cima, e saía
            duas vezes (09-10-2026). */}
        <FAQSection
          title={`Perguntas frequentes sobre mudanças ${emTerra(c.nome)}`}
          faqs={faqs.map((f) => ({ question: f.pergunta, answer: f.resposta }))}
          includeSchema={false}
        />
      </section>

      {/* ── CTA ── */}
      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <CTABlock
            variant="centered"
            title={`Precisa de fazer uma mudança ${emTerra(c.nome)}?`}
            description="Propostas grátis em menos de 6 horas, sem compromisso."
            primaryText="Pedir orçamento"
            primaryHref={PEDIR_MUDANCA}
            showWhatsApp
            showPhone
            whatsappMessage={`Olá! Preciso de fazer uma mudança ${emTerra(c.nome)}. Podem dar-me um orçamento?`}
          />
        </div>
      </section>

      {/* ── Cidades vizinhas (internal linking) ── */}
      {vizinhas.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="text-xl font-bold text-slate-900">
            Mudanças nas cidades próximas
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {vizinhas.map((v) => (
              <Link
                key={v.slug}
                href={`/mudancas/${v.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <MapPin className="h-3.5 w-3.5" /> Mudanças {emTerra(v.nome)}
              </Link>
            ))}
            <Link
              href="/mudancas"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-400"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ── Que tipo de mudança — as três páginas de tipo (09-10-2026) ── */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-xl font-bold text-slate-900">Que tipo de mudança é a sua?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {TIPOS_DE_MUDANCA.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 hover:bg-emerald-50/50"
            >
              <p className="text-sm font-bold text-slate-800">{t.titulo}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.resumo}</p>
            </Link>
          ))}
        </div>
      </section>

      {/*
        ── Os outros serviços em {cidade} ──
        As páginas de recolha de cada cidade já ligavam umas às outras; às de
        mudanças não ligava nada, e destas não se saía para lado nenhum. Quem
        muda de casa muitas vezes tem de esvaziar a antiga (09-10-2026).
      */}
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h2 className="text-xl font-bold text-slate-900">Também {emTerra(c.nome)}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {SERVICOS_NA_MESMA_CIDADE.map((s) => (
            <Link
              key={s.servico}
              href={caminhoDoServicoNaCidade(s.servico, c.slug)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {s.rotulo} {emTerra(c.nome)}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Quem faz mudanças nesta zona — só quem tem «mudança» nos serviços ── */}
      <ProfissionaisComPagina
        cidade={c.nome}
        categoria="mudanca"
        titulo={`Parceiros de mudanças ${emTerra(c.nome)}`}
        descricao={`Quem faz a mudança são eles. A CLYON recebe o seu pedido e liga-o a parceiros independentes com actividade ${emTerra(c.nome)} — veja a nota de cada um antes de escolher.`}
        limite={6}
      />

      {/* ── Trust block ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white border border-slate-100 p-5 text-center">
            <Shield className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-bold text-slate-800">Sem stress</p>
            {/* 30-09-2026: dizia «Equipa profissional, seguros incluídos» — não
                há seguro nenhum (ver sem-seguro.test.ts), nem equipa da CLYON. */}
            <p className="text-xs text-slate-500">Parceiros verificados</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-5 text-center">
            <Clock3 className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-bold text-slate-800">Propostas em menos de 6h</p>
            <p className="text-xs text-slate-500">Com o preço fechado antes de começar</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-5 text-center">
            <Star className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-bold text-slate-800">{NOTAS_EM_LINHA}</p>
            <p className="text-xs text-slate-500">{CONTAGENS_EM_LINHA}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
