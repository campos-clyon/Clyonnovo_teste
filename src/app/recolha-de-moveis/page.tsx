import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Recycle,
  Shield,
  ShieldCheck,
  Sofa,
  Truck,
  Users,
  Zap,
} from "lucide-react";

import FurnitureSeoLinks from "@/components/FurnitureSeoLinks";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  BUSINESS_EMAIL,
  BUSINESS_ADDRESS,
  CITIES,
  SITE_URL,
  getCityServiceSlug,
} from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Recolha de Móveis em Lisboa — Sofás, Camas e Armários",
  description:
    "Recolha de móveis usados em Lisboa, Margem Sul e Setúbal: sofás, camas, colchões, armários, cómodas, mesas, cadeiras e eletrodomésticos. Desmontagem, carregamento porta a porta e destino responsável. Preços desde 40€. Orçamento grátis em 24h.",
  keywords: [
    "recolha de móveis",
    "recolha de móveis Lisboa",
    "recolha de móveis usados",
    "recolha gratuita de móveis usados",
    "recolha de sofá Lisboa",
    "recolha de sofás usados",
    "recolha de camas",
    "recolha de armários",
    "recolha de eletrodomésticos",
    "retirar móveis velhos",
    "recolha de móveis Setúbal",
    "recolha de móveis Almada",
    "remoção de móveis",
    "levar móveis velhos",
    "recolha de móveis no mesmo dia",
  ],
  alternates: {
    canonical: `${SITE_URL}/recolha-de-moveis`,
  },
  openGraph: {
    title: "Recolha de Móveis em Lisboa — Sofás, Camas e Armários",
    description:
      "Recolha de sofás, camas, armários, eletrodomésticos e móveis usados em Lisboa. Desmontagem e carregamento porta a porta. Preços desde 40€.",
    url: `${SITE_URL}/recolha-de-moveis`,
    locale: "pt_PT",
    type: "website",
  },
};

const keyCities = [
  "lisboa",
  "amadora",
  "sintra",
  "oeiras",
  "cascais",
  "almada",
  "seixal",
  "setubal",
]
  .map((slug) => CITIES.find((city) => city.slug === slug))
  .filter((city): city is (typeof CITIES)[number] => Boolean(city));

const areaServedCities = [
  "Lisboa",
  "Amadora",
  "Sintra",
  "Oeiras",
  "Cascais",
  "Almada",
  "Seixal",
  "Barreiro",
  "Setúbal",
];

const benefits = [
  { icon: Clock3, title: "Resposta rápida", desc: "Orçamento em minutos, recolha em 24-48h quando disponível" },
  { icon: Users, title: "Desmontagem quando necessário", desc: "A equipa desmonta armários, camas e móveis grandes" },
  { icon: Truck, title: "Carregamento porta a porta", desc: "Retirada a partir do interior do imóvel" },
  { icon: Recycle, title: "Destino responsável", desc: "Triagem, doação ou encaminhamento correto" },
];

const includedItems = [
  "Sofás, chaise longues e cadeirões",
  "Camas, estrados, colchões e mesinhas de cabeceira",
  "Armários, roupeiros, cómodas e aparadores",
  "Mesas, cadeiras, secretárias e móvel de TV",
  "Frigoríficos, máquinas de lavar e pequenos eletrodomésticos",
  "Recheios completos de apartamentos, moradias, escritórios e lojas",
];

const pricingTable = [
  { item: "Sofá (2-3 lugares)", price: "sob avaliação" },
  { item: "Cama de casal com estrado", price: "sob avaliação" },
  { item: "Armário grande", price: "sob avaliação" },
  { item: "Eletrodoméstico (frigorífico, máquina)", price: "sob avaliação" },
  { item: "Recolha de vários móveis", price: "orçamento personalizado" },
];

const faqs = [
  {
    q: "Quanto custa a recolha de móveis?",
    a: "O preço depende do volume, peso, acessos, necessidade de desmontagem e distância. A forma mais rápida de fechar o valor certo é enviar fotos e a morada para receber um orçamento imediato.",
  },
  {
    q: "Recolhem móveis usados no mesmo dia?",
    a: "Sim. Quando há disponibilidade operacional, a recolha pode ser feita no próprio dia ou no dia seguinte, sobretudo em Lisboa, Amadora, Sintra, Oeiras, Cascais, Almada e Setúbal.",
  },
  {
    q: "Também recolhem eletrodomésticos?",
    a: "Sim. Recolhemos frigoríficos, máquinas de lavar, fogões, micro-ondas e outros equipamentos volumosos, desde que o pedido seja identificado no orçamento.",
  },
  {
    q: "O que acontece aos móveis recolhidos?",
    a: "Sempre que o estado dos móveis permita, fazemos triagem para doação ou reaproveitamento. O restante segue para encaminhamento responsável e descarte legal.",
  },
  {
    q: "Fazem desmontagem de armários e camas?",
    a: "Sim. Quando necessário, a equipa desmonta móveis e trata da retirada a partir do interior do imóvel. Indique essa necessidade no pedido para o orçamento refletir o trabalho.",
  },
  {
    q: "Qual é a diferença entre a CLYON e a recolha municipal?",
    a: "A recolha municipal funciona bem para alguns pedidos gratuitos e agendados, mas costuma ser mais limitada em horários, volume, desmontagem e apoio dentro do imóvel. A CLYON entra quando o cliente precisa de rapidez, carregamento completo e resolução total.",
  },
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: BUSINESS_NAME,
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Serviços",
      item: `${SITE_URL}/servicos`,
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Recolha de Móveis",
      item: `${SITE_URL}/recolha-de-moveis`,
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#organization`,
  name: BUSINESS_NAME,
  description: "Recolha de móveis, entulho, monos, esvaziamento de casas, mudanças e limpeza pós-obra em Lisboa, Margem Sul e Setúbal.",
  url: SITE_URL,
  telephone: BUSINESS_PHONE,
  email: BUSINESS_EMAIL,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Belverde",
    addressLocality: "Amora",
    addressRegion: "Setúbal",
    postalCode: "2845-513",
    addressCountry: "PT",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 38.6266,
    longitude: -9.1092,
  },
  areaServed: areaServedCities.map((city) => ({
    "@type": "City",
    name: city,
  })),
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "08:00",
    closes: "19:00",
  },
  priceRange: "€€",
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Recolha de Móveis",
  serviceType: "Recolha de móveis usados e eletrodomésticos",
  url: `${SITE_URL}/recolha-de-moveis`,
  description:
    "Serviço de recolha de móveis usados com desmontagem, carregamento porta a porta, transporte e encaminhamento responsável em Lisboa, Margem Sul e Setúbal.",
  provider: {
    "@type": "LocalBusiness",
    name: BUSINESS_NAME,
    telephone: BUSINESS_PHONE,
    url: SITE_URL,
  },
  areaServed: areaServedCities.map((city) => ({
    "@type": "City",
    name: city,
  })),
  availableChannel: {
    "@type": "ServiceChannel",
    serviceUrl: `${SITE_URL}/recolha-de-moveis`,
    servicePhone: BUSINESS_PHONE,
  },
  offers: {
    "@type": "Offer",
    priceCurrency: "EUR",
    price: "35",
    priceValidUntil: "2026-12-31",
    availability: "https://schema.org/InStock",
  },
};

export default function RecolhaDeMoveisPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section - Clean Light Background */}
      <section className="relative min-h-[550px] overflow-hidden bg-gradient-to-b from-slate-50 to-white lg:min-h-[640px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_50%)]" />
        
        {/* Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-14 lg:px-8 lg:pb-18 lg:pt-18">
          
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              163 avaliações 5 estrelas
            </div>
            
            {/* Title */}
            <h1 className="mt-5 text-[1.75rem] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-[2.2rem] lg:text-[2.5rem]">
              Recolha de Móveis, Entulho e Esvaziamento de Casas em Lisboa
            </h1>
            
            {/* Subtitle */}
            <p className="mt-3 text-base font-medium text-cyan-600">
              Sem contentores, sem espera: recolha rápida diretamente no local.
            </p>
            
            {/* Description */}
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate-600">
              Recolha rápida de móveis, entulho, monos e limpeza pós-obra em Lisboa, Margem Sul e Setúbal. Orçamento grátis em 24h.
            </p>

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/simulador"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0891b2] px-7 text-sm font-semibold text-white shadow-lg shadow-cyan-600/25 transition hover:bg-[#0e7490]"
              >
                <span className="text-white">Pedir Orçamento Grátis</span>
              </Link>
              <a
                href="https://wa.me/351931632622?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20m%C3%B3veis."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-7 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-[#1ebe5d]"
              >
                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="text-white">WhatsApp</span>
              </a>
            </div>

            {/* Stats */}
            <div className="mt-8 flex flex-wrap gap-6 border-t border-slate-200 pt-6">
              <div>
                <div className="text-xl font-bold text-slate-900">163</div>
                <div className="text-xs text-slate-500">Avaliações</div>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">24h</div>
                <div className="text-xs text-slate-500">Resposta</div>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">Grátis</div>
                <div className="text-xs text-slate-500">Orçamento</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Floating badges - desktop only */}
        <div className="absolute bottom-6 right-6 z-10 hidden flex-col gap-2.5 lg:flex">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100">
                <ShieldCheck className="h-4 w-4 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Equipa Profissional</p>
                <p className="text-[10px] text-slate-500">Lisboa e Setúbal</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                <Zap className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Resposta Rápida</p>
                <p className="text-[10px] text-slate-500">Em 11 minutos</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O que recolhemos */}
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Móveis usados, recheios e volumes grandes
            </h2>
            <div className="mt-4 space-y-2">
              {includedItems.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Exemplos de valores para recolha de móveis
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Valores orientativos. O orçamento final depende de volume, acessos, andares e necessidade de desmontagem.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Item</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pricingTable.map((row) => (
                    <tr key={row.item}>
                      <td className="px-4 py-3 text-slate-700">{row.item}</td>
                      <td className="px-4 py-3 text-right font-semibold text-cyan-600">{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* SEO Section: Recolha gratuita vs privada */}
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Recolha gratuita, doação ou recolha privada: qual escolher?
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Muitas pesquisas por &quot;recolha de móveis usados&quot; ou &quot;recolha gratuita de móveis&quot; incluem intenções diferentes: doação, recolha municipal, reaproveitamento ou serviço profissional. É importante perceber quando cada opção faz sentido.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-semibold text-slate-900">Recolha municipal / gratuita</h3>
              <p className="mt-2 text-sm text-slate-600">
                Funciona bem para pedidos simples, agendados com antecedência, em que os móveis estão no exterior e não há urgência. Limitações: horários fixos, sem desmontagem, volume limitado, pode demorar semanas.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-semibold text-slate-900">Doação / reaproveitamento</h3>
              <p className="mt-2 text-sm text-slate-600">
                Ideal se os móveis estão em bom estado e há tempo para contactar instituições ou publicar anúncios. Requer que a peça seja funcional e que o interessado vá buscar.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-5">
              <h3 className="font-semibold text-cyan-800">Recolha privada (CLYON)</h3>
              <p className="mt-2 text-sm text-cyan-600">
                A escolha certa quando precisa de rapidez, desmontagem, carregamento a partir do interior do imóvel, transporte e retirada completa. Resolve tudo num só pedido, sem depender de terceiros.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-[#F4F8FB] p-5">
            <p className="text-sm font-semibold text-[#0B1929]">Quando escolher a CLYON:</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>• Precisa de recolha de móveis usados nos próximos dias</li>
              <li>• Tem armários, camas ou móveis grandes que precisam de desmontagem</li>
              <li>• Os móveis estão em andares altos ou acessos difíceis</li>
              <li>• Quer libertar o espaço sem gerir múltiplos contactos</li>
              <li>• Precisa de retirar móveis velhos de dentro do imóvel</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Páginas por tipo de móvel */}
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          Recolha por tipo de móvel ou equipamento
        </h2>
        <p className="mt-2 max-w-3xl text-base text-slate-600">
          Além da recolha geral de móveis, temos páginas específicas para cada tipo de item. Escolha o que precisa de recolher.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { href: "/recolha-de-sofas", label: "Recolha de Sofás", desc: "Sofás, chaise longues, cadeirões" },
            { href: "/recolha-de-camas", label: "Recolha de Camas", desc: "Camas, estrados, colchões" },
            { href: "/recolha-de-armarios", label: "Recolha de Armários", desc: "Armários, roupeiros, cómodas" },
            { href: "/recolha-de-eletrodomesticos", label: "Eletrodomésticos", desc: "Frigoríficos, máquinas" },
            { href: "/recolha-gratuita-de-moveis-usados", label: "Gratuita vs Privada", desc: "Quando escolher" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-200 hover:shadow-sm"
            >
              <h3 className="font-semibold text-slate-900 group-hover:text-cyan-700">
                {item.label}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Cidades */}
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          Recolha de móveis nas principais zonas
        </h2>
        <p className="mt-2 max-w-3xl text-base text-slate-600">
          Atendemos pedidos em Lisboa, Grande Lisboa, Margem Sul e Setúbal. Clique na sua zona para ver mais detalhes e pedir orçamento.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {keyCities.map((city) => (
            <Link
              key={city.slug}
              href={`/${getCityServiceSlug("recolha-moveis", city.slug)}`}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-200 hover:shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-600">
                <MapPin className="h-3.5 w-3.5" />
                {city.regionLabel}
              </div>
              <h3 className="mt-2 font-semibold text-slate-900 group-hover:text-cyan-700">
                Recolha de móveis em {city.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Ver preços e pedir orçamento
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Links internos SEO */}
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <FurnitureSeoLinks currentPage="/recolha-de-moveis" />
      </section>

      {/* FAQs */}
      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          Dúvidas sobre recolha de móveis usados
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">{faq.q}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-6 lg:px-8">
        <div className="rounded-2xl bg-[#F4F8FB] p-8 text-center lg:p-12">
          <h2 className="text-2xl font-bold text-[#0B1929] lg:text-3xl">
            Precisa de recolha de móveis hoje?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Envie fotos e morada para receber orçamento rápido. Quanto mais informação nos der, mais preciso será o valor.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/simulador"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-8 font-semibold text-white transition hover:bg-cyan-400"
            >
              Simular Orçamento
            </Link>
            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-8 font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <Phone className="h-4 w-4" />
              <span>Ligar Agora</span>
            </a>
          </div>
        </div>
      </section>

      {/* Schema.org Scripts */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
    </div>
  );
}
