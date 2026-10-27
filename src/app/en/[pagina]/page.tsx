import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, MessageCircle, Phone } from "lucide-react";

import { PRESTADOR } from "@/lib/dados-estruturados";
import { EMPRESA_PARCEIRA_EM_INGLES } from "@/lib/identificacao-legal";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import {
  PAGINAS_EM_INGLES,
  PRECOS_EM_INGLES,
  equivalenteEmPortugues,
  paginaEmIngles,
} from "@/lib/paginas-em-ingles";
import { BUSINESS_PHONE, SITE_URL } from "@/lib/seo-data";
import { telefoneLegivel } from "@/lib/telefone-legivel";

/*
 * UMA PÁGINA EM INGLÊS POR TERRA — 14-10-2026 (auditoria de SEO, 90 dias).
 * Ver paginas-em-ingles.ts. O cabeçalho e o rodapé ficam em português (são
 * os do site); o conteúdo vai marcado com lang="en", e o hreflang liga cada
 * uma à página portuguesa da mesma terra.
 */

type Props = { params: Promise<{ pagina: string }> };

export function generateStaticParams() {
  return PAGINAS_EM_INGLES.map((p) => ({ pagina: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pagina } = await params;
  const p = paginaEmIngles(pagina);
  if (!p) return {};
  const url = `${SITE_URL}/en/${p.slug}`;
  const titulo = `${p.titulo} — Quotes in 6h`;
  const partilha = og({ title: titulo, description: p.descricao, url });
  return {
    title: titulo,
    description: p.descricao,
    alternates: {
      canonical: url,
      languages: { en: url, "pt-PT": `${SITE_URL}${equivalenteEmPortugues(p)}` },
    },
    openGraph: { ...partilha, locale: "en_GB" },
  };
}

const O_QUE_SAI = [
  "Sofas, armchairs and sofa beds",
  "Beds, mattresses and bed frames",
  "Wardrobes, chests of drawers and shelving",
  "Fridges, washing machines and other appliances",
  "Boxes, junk and bulky waste",
  "Construction rubble, in 25–30 kg bags — no skips",
  "Whole-house and flat clearances",
];

const PASSOS = [
  "Describe what needs to go: photos, the address, the floor and whether there is a lift.",
  "Receive quotes from verified local professionals in under 6 hours, with the price fixed before work starts.",
  "Choose one — or none. The professional you choose does the job; CLYON is who you turn to if something goes wrong.",
];

export default async function PaginaEmInglesPage({ params }: Props) {
  const { pagina } = await params;
  const p = paginaEmIngles(pagina);
  if (!p) notFound();

  const url = `${SITE_URL}/en/${p.slug}`;
  const whatsapp = `https://wa.me/${BUSINESS_PHONE.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hi! I need junk removal in ${p.cidade}. Could you send me a quote?`,
  )}`;

  const perguntas = [
    {
      q: "Do you speak English?",
      a: "Yes. Write to us on WhatsApp in English and we reply in English. The online quote form is in Portuguese, so WhatsApp is the easiest way.",
    },
    {
      q: `How much does it cost to remove a sofa in ${p.cidade}?`,
      a: `A single piece such as a sofa, a bed or a wardrobe is usually within ${PRECOS_EM_INGLES[0].preco}, depending on size, floor, lift and dismantling. The exact price comes in the quotes, fixed before work starts.`,
    },
    {
      q: "Do you take construction rubble?",
      a: `Yes — in 25–30 kg bags, carried out by hand, with no skip on the street. ${PRECOS_EM_INGLES[2].preco.charAt(0).toUpperCase()}${PRECOS_EM_INGLES[2].preco.slice(1)}.`,
    },
    {
      q: "Is there a free council collection?",
      a: p.camara,
    },
    {
      q: "Do I get an invoice?",
      // Sem o nome da parceira desde 26-10-2026 (decisão do dono): só a categoria.
      a: `Yes. Every job comes with an invoice, issued by ${EMPRESA_PARCEIRA_EM_INGLES}, and the prices in the quotes already include VAT.`,
    },
  ];

  /*
   * `inLanguage` não é propriedade de Service (27-10-2026, d9): a língua vai
   * num WebPage, que tem o Service como assunto principal.
   */
  const esquema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url,
    inLanguage: "en",
    name: p.titulo,
    mainEntity: {
      "@type": "Service",
      name: p.titulo,
      serviceType: "Junk and furniture removal",
      url,
      provider: PRESTADOR,
      areaServed: { "@type": "City", name: p.cidade },
    },
  };

  return (
    <div lang="en" className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(esquema) }} />

      <section className="sob-o-menu bg-gradient-to-br from-cyan-50 via-white to-white">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8 lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">{p.titulo}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{p.intro}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-emerald-400"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp us in English
            </a>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="site-btn-secondary min-w-[220px] border-slate-300 px-6 py-3.5 text-slate-900"
            >
              <Phone className="h-4 w-4" />
              Call {telefoneLegivel(BUSINESS_PHONE, { comIndicativo: true })}
            </a>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Prefer a form?{" "}
            <Link href="/simulador" className="font-semibold text-acao underline-offset-4 hover:underline">
              Get a quote online
            </Link>{" "}
            (the form is in Portuguese).
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">What can go</h2>
            <ul className="mt-5 space-y-2">
              {O_QUE_SAI.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-7 text-slate-700">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-acao" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Prices</h2>
            <ul className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {PRECOS_EM_INGLES.map((l) => (
                <li key={l.servico} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-slate-700">{l.servico}</span>
                  <span className="font-semibold text-acao">{l.preco}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-6 text-slate-500">
              Reference prices, excluding VAT (23%). Every quote you receive already includes VAT
              and the platform fee, and every job comes with an invoice.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-950">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {PASSOS.map((passo, i) => (
              <li key={passo} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-acao text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-3">{passo}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-950">Working in {p.cidade}</h2>
        <p className="mt-4 text-base leading-8 text-slate-600">{p.acesso}</p>
        <p className="mt-3 text-base leading-8 text-slate-600">{p.estacionamento}</p>
        <h3 className="mt-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-acao">
          <MapPin className="h-4 w-4" />
          Areas
        </h3>
        <p className="mt-2 text-sm leading-7 text-slate-700">{p.zonas.join(" · ")}</p>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-950">Questions</h2>
          <dl className="mt-6 space-y-6">
            {perguntas.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-slate-900">{f.q}</dt>
                <dd className="mt-1 text-sm leading-7 text-slate-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 text-center lg:px-8">
        <h2 className="text-2xl font-bold text-slate-950">Need something removed in {p.cidade}?</h2>
        <p className="mt-3 text-base text-slate-600">Send a few photos on WhatsApp and get quotes in under 6 hours.</p>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-emerald-400"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp us in English
        </a>
        <p className="mt-6 text-xs text-slate-500">
          <Link href={equivalenteEmPortugues(p)} hrefLang="pt-PT" className="underline-offset-4 hover:underline">
            Ver esta página em português
          </Link>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Also in English:{" "}
          {PAGINAS_EM_INGLES.filter((o) => o.slug !== p.slug).map((o, i) => (
            <span key={o.slug}>
              {i > 0 ? " · " : ""}
              <Link href={`/en/${o.slug}`} className="underline-offset-4 hover:underline">
                {o.titulo}
              </Link>
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
