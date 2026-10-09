import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, MessageSquareText, Phone } from "lucide-react";

import CTABlock from "@/components/CTABlock";
import FAQSection from "@/components/service/FAQSection";
import { PRESTADOR } from "@/lib/dados-estruturados";
import { jsonLd } from "@/lib/json-ld";
import { CIDADES_MUDANCAS } from "@/lib/mudancas-cidades";
import { BUSINESS_PHONE, SITE_URL } from "@/lib/seo-data";
import { PEDIR_MUDANCA, TIPOS_DE_MUDANCA } from "@/lib/tipos-de-mudanca";

/**
 * UMA PÁGINA POR TIPO DE MUDANÇA — 09-10-2026.
 *
 * *«Quero fortalecer a nossa presença nas mudanças tanto quanto nas
 * recolhas.»* As recolhas tinham página por objecto (sofás, camas, armários,
 * eletrodomésticos); as mudanças só tinham a geral e as cidades. Quem procura
 * «transporte de móveis», «pequenas mudanças» ou «mudança de escritório» tem
 * uma necessidade diferente, e cada uma destas páginas fala só dela.
 *
 * As três são o mesmo desenho com texto diferente, por isso o desenho vive
 * aqui uma vez. O texto de cada uma fica no seu page.tsx — é lá que se lê e se
 * corrige. As regras são as do resto das mudanças: sem preço anunciado (só
 * orçamento personalizado), e a CLYON liga a profissionais — não executa.
 */

export type ConteudoDoTipoDeMudanca = {
  /** O endereço da página, ex. «/transporte-de-moveis». */
  caminho: string;
  /** O nome curto, para o caminho de navegação e o JSON-LD. */
  nome: string;
  h1: string;
  intro: string;
  quandoFazSentido: { titulo: string; itens: string[] };
  oQueDizer: string[];
  /** O que faz variar o preço, sem número nenhum. */
  fatoresDePreco: string[];
  faqs: Array<{ question: string; answer: string }>;
  /** Um artigo do blog que aprofunda o tema, quando há. */
  artigo?: { href: string; titulo: string };
  /** A pergunta do bloco final, ex. «Precisa de transportar um móvel?». */
  ctaTitulo: string;
  /** A frase do WhatsApp, já com o tipo de mudança. */
  mensagemWhatsApp: string;
};

export default function PaginaDeTipoDeMudanca({ c }: { c: ConteudoDoTipoDeMudanca }) {
  const url = `${SITE_URL}${c.caminho}`;
  const outros = TIPOS_DE_MUDANCA.filter((t) => t.href !== c.caminho);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        serviceType: c.nome,
        name: c.h1,
        description: c.intro,
        provider: PRESTADOR,
        areaServed: CIDADES_MUDANCAS.map((cidade) => ({ "@type": "City", name: cidade.nome })),
        // Sem `offers`: a página não mostra preço, e os dados estruturados não
        // declaram o que a página não mostra (a regra de /mudancas).
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Mudanças", item: `${SITE_URL}/mudancas` },
          { "@type": "ListItem", position: 3, name: c.nome, item: url },
        ],
      },
    ],
  };

  return (
    <div className="bg-gradient-to-br from-white via-emerald-50/30 to-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

      <nav aria-label="Caminho de navegação" className="mx-auto max-w-6xl px-4 pt-6 text-xs text-slate-500 sm:px-6">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="hover:text-emerald-600">Início</Link></li>
          <li>›</li>
          <li><Link href="/mudancas" className="hover:text-emerald-600">Mudanças</Link></li>
          <li>›</li>
          <li className="font-semibold text-slate-800">{c.nome}</li>
        </ol>
      </nav>

      {/* ── Topo ── */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
          <MapPin className="h-3 w-3" aria-hidden="true" /> Lisboa · Margem Sul · Setúbal
        </div>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
          {c.h1}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">{c.intro}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={PEDIR_MUDANCA}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 hover:shadow-lg"
          >
            Pedir orçamento grátis <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href={`tel:${BUSINESS_PHONE}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
          >
            <Phone className="h-4 w-4" aria-hidden="true" /> Ligar {BUSINESS_PHONE}
          </a>
        </div>
      </section>

      {/* ── Quando faz sentido, e o que dizer no pedido ── */}
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">{c.quandoFazSentido.titulo}</h2>
            <ul className="mt-5 space-y-3">
              {c.quandoFazSentido.itens.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-[#F4F8FB] p-6">
            <h2 className="text-2xl font-bold text-slate-900">O que dizer no pedido</h2>
            <p className="mt-2 text-sm text-slate-600">
              É com isto que o profissional faz o preço — quanto mais certo, mais certa a proposta.
            </p>
            <ul className="mt-5 space-y-3">
              {c.oQueDizer.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── O preço, sem número ── */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900">Quanto custa</h2>
          <p className="mt-2 text-slate-600">
            Orçamento personalizado: não há tabela, porque o preço depende do que vai e dos acessos.
            Cada proposta traz o valor fechado antes de começar, e o valor fica acordado por escrito.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {c.fatoresDePreco.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
          {c.artigo && (
            <p className="mt-6 text-sm text-slate-600">
              Para ler com calma:{" "}
              <Link href={c.artigo.href} className="font-semibold text-emerald-700 hover:underline">
                {c.artigo.titulo}
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ── Perguntas — o FAQPage já vai no @graph de cima ── */}
      <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <FAQSection title={`Perguntas sobre ${c.nome.toLowerCase()}`} faqs={c.faqs} includeSchema={false} />
      </section>

      {/* ── Por cidade: as 26 páginas de mudanças ── */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="text-xl font-bold text-slate-900">Mudanças por cidade</h2>
        <p className="mt-2 text-sm text-slate-600">
          Cada cidade tem os seus acessos e o seu estacionamento — veja o que muda na sua.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CIDADES_MUDANCAS.map((cidade) => (
            <Link
              key={cidade.slug}
              href={`/mudancas/${cidade.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {cidade.nome}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Os outros tipos de mudança ── */}
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h2 className="text-xl font-bold text-slate-900">Outros tipos de mudança</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {outros.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 hover:bg-emerald-50/50"
            >
              <p className="text-sm font-bold text-slate-800">{t.titulo}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.resumo}</p>
            </Link>
          ))}
          <Link
            href="/mudancas"
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 hover:bg-emerald-50/50"
          >
            <p className="text-sm font-bold text-slate-800">Mudanças de casa</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Do T0 à moradia, com embalagem, desmontagem e montagem, se as pedir.
            </p>
          </Link>
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <CTABlock
            variant="centered"
            title={c.ctaTitulo}
            description="Propostas grátis em menos de 6 horas, sem compromisso."
            primaryText="Pedir orçamento"
            primaryHref={PEDIR_MUDANCA}
            showWhatsApp
            showPhone
            whatsappMessage={c.mensagemWhatsApp}
          />
        </div>
      </section>
    </div>
  );
}
