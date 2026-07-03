import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, MapPin, Package, Phone, Trash2, Truck } from "lucide-react";
import CTABlock from "@/components/CTABlock";
import Breadcrumb from "@/components/Breadcrumb";

const SITE_URL = "https://clyon.pt";

export const metadata: Metadata = {
  title: "Recolha de Monos na Amadora | Móveis Velhos, Sofás e Volumosos",
  description:
    "Recolha de monos na Amadora com carregamento, transporte e remoção de móveis velhos, sofás, colchões, eletrodomésticos e objetos volumosos. Reboleira, Damaia, Alfragide.",
  alternates: { canonical: `${SITE_URL}/recolha-de-monos-amadora` },
  openGraph: {
    title: "Recolha de Monos na Amadora | Móveis Velhos, Sofás e Volumosos",
    description:
      "Recolha de monos na Amadora com carregamento e transporte. Móveis velhos, sofás, colchões e volumosos.",
    url: `${SITE_URL}/recolha-de-monos-amadora`,
  },
};

const faqs = [
  {
    question: "A CLYON faz recolha de monos na Amadora?",
    answer: "Sim, fazemos recolha de monos em toda a Amadora, incluindo Reboleira, Damaia, Alfragide, Venteira, Mina de Água, Buraca e Falagueira-Venda Nova. A equipa vai ao local, carrega e transporta.",
  },
  {
    question: "Qual a diferença entre a recolha municipal e a CLYON?",
    answer: "A recolha municipal tem horários fixos, volume limitado e não entra no imóvel. A CLYON oferece recolha rápida, retira de dentro de casa, faz desmontagem quando necessário e resolve tudo num só pedido.",
  },
  {
    question: "Vocês retiram os monos de dentro de casa?",
    answer: "Sim, a nossa equipa entra no apartamento ou moradia, carrega os monos e transporta. Não precisa de colocar nada no exterior.",
  },
  {
    question: "Quanto custa a recolha de monos na Amadora?",
    answer: "O valor depende do volume e acessos. Para volumes pequenos (1-2 itens), costuma começar nos 35-60€. Para volumes maiores, envie fotos para orçamento rápido.",
  },
  {
    question: "Recolhem móveis pesados e volumosos?",
    answer: "Sim, retiramos sofás, camas, armários, colchões, eletrodomésticos grandes e outros volumes pesados. A equipa está preparada para carregamento.",
  },
  {
    question: "Fazem desmontagem de móveis?",
    answer: "Sim, quando necessário desmontamos armários, camas e outros móveis para facilitar a retirada, especialmente em acessos difíceis.",
  },
  {
    question: "Atendem Reboleira, Damaia e Alfragide?",
    answer: "Sim, atendemos todas as freguesias da Amadora incluindo Reboleira, Damaia, Alfragide, Venteira, Mina de Água, Águas Livres, Buraca e Falagueira-Venda Nova.",
  },
];

const whatWeCollect = [
  "Sofás, cadeirões e chaise longues",
  "Camas, estrados, colchões e sommiers",
  "Armários, roupeiros e cómodas",
  "Mesas, cadeiras e estantes",
  "Eletrodomésticos grandes (frigoríficos, máquinas)",
  "Colchões e tapetes velhos",
  "Móveis de jardim e varanda",
  "Objetos volumosos e sucata",
];

const amadoraZones = [
  "Reboleira", "Damaia", "Venteira", "Alfragide", "Mina de Água",
  "Águas Livres", "Encosta do Sol", "Falagueira-Venda Nova", "Buraca",
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Recolha de Monos na Amadora",
  description: "Serviço de recolha de monos, móveis velhos e objetos volumosos na Amadora com carregamento e transporte.",
  provider: {
    "@type": "LocalBusiness",
    name: "CLYON",
    telephone: "+351965785395",
    url: SITE_URL,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Lisboa",
      addressRegion: "Lisboa",
      addressCountry: "PT",
    },
    areaServed: "Amadora",
  },
  areaServed: {
    "@type": "City",
    name: "Amadora",
    containedInPlace: { "@type": "AdministrativeArea", name: "Lisboa" },
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

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Recolha de Monos", item: `${SITE_URL}/recolha-monos-lisboa` },
    { "@type": "ListItem", position: 3, name: "Amadora", item: `${SITE_URL}/recolha-de-monos-amadora` },
  ],
};

export default function MonosAmadoraPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="bg-slate-50">
        {/* Hero */}
        <section className="bg-gradient-to-b from-white to-slate-50 pb-12 pt-8">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <Breadcrumb
              items={[
                { label: "Início", href: "/" },
                { label: "Recolha de Monos", href: "/recolha-monos-lisboa" },
                { label: "Amadora" },
              ]}
            />

            <div className="mt-8 grid items-start gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
                  Serviço local na Amadora
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
                  Recolha de monos na Amadora com carregamento e transporte
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  A CLYON faz recolha de monos, móveis velhos, sofás, colchões e objetos volumosos na Amadora. 
                  Ao contrário da recolha municipal, a nossa equipa entra no imóvel, carrega tudo e 
                  transporta. Atendemos Reboleira, Damaia, Alfragide, Venteira e todas as freguesias.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/simulador"
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-amber-600 px-6 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Simular orçamento
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="https://wa.me/351965785395?text=Olá! Preciso de recolha de monos na Amadora. Podem dar-me um orçamento?"
                    className="inline-flex h-12 items-center gap-2 rounded-lg border border-amber-200 bg-white px-6 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                  >
                    WhatsApp
                  </a>
                  <a
                    href="tel:+351965785395"
                    className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Phone className="h-4 w-4" />
                    Ligar agora
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
                  Valores de referência
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    { type: "1-2 itens pequenos", price: "sob avaliação" },
                    { type: "Sofá ou cadeirão", price: "sob avaliação" },
                    { type: "Cama completa", price: "sob avaliação" },
                    { type: "Vários monos", price: "orçamento personalizado" },
                  ].map((item) => (
                    <div key={item.type} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-700">{item.type}</span>
                      <span className="font-semibold text-amber-600">{item.price}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Valores orientativos. O preço final depende do volume, acessos e andar.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Municipal vs Privada */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Qual escolher
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Recolha municipal gratuita ou serviço privado?
            </h2>
            <p className="mt-2 max-w-3xl text-slate-600">
              A recolha municipal pode ser útil quando há disponibilidade e o cliente consegue 
              seguir as regras de agendamento. A CLYON é indicada quando precisa de:
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="font-semibold text-slate-900">Recolha municipal</h3>
                <ul className="mt-4 space-y-2">
                  {[
                    "Gratuita mas com horários fixos",
                    "Volume máximo limitado",
                    "Necessário colocar os monos no exterior",
                    "Agendamento pode demorar dias",
                    "Não faz desmontagem nem carregamento",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6">
                <h3 className="font-semibold text-slate-900">CLYON (serviço privado)</h3>
                <ul className="mt-4 space-y-2">
                  {[
                    "Resposta rápida (24-48h na maioria dos casos)",
                    "Sem limite de volume por pedido",
                    "Retiramos de dentro de casa",
                    "Desmontagem e carregamento incluídos",
                    "Solução completa num só pedido",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* O que recolhemos */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Monos e volumosos
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              O que recolhemos na Amadora
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {whatWeCollect.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quando contratar */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Situações comuns
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Quando contratar a CLYON para recolha de monos
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Clock, title: "Precisa de resposta rápida", desc: "Quando não pode esperar pelo agendamento municipal." },
                { icon: Package, title: "Monos dentro de casa", desc: "Quando não consegue ou não quer levar os monos ao exterior." },
                { icon: Trash2, title: "Volume grande", desc: "Quando tem muitos monos e o limite municipal não é suficiente." },
                { icon: Truck, title: "Móveis pesados", desc: "Sofás, armários, camas e eletrodomésticos que precisam de equipa." },
                { icon: MapPin, title: "Acessos difíceis", desc: "Prédios sem elevador, escadas estreitas ou andares altos." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5">
                  <item.icon className="h-6 w-6 text-amber-600" />
                  <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Zonas */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Cobertura local
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Zonas da Amadora onde atuamos
            </h2>
            <p className="mt-2 text-slate-600">
              Atendemos todas as freguesias e zonas da Amadora para recolha de monos.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {amadoraZones.map((zone) => (
                <span
                  key={zone}
                  className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700"
                >
                  {zone}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Serviços relacionados */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Serviços relacionados na Amadora
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Outros serviços que pode precisar
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: "/recolha-moveis-amadora", label: "Recolha de móveis na Amadora", desc: "Sofás, camas, armários" },
                { href: "/esvaziamento-de-casas-amadora", label: "Esvaziamento na Amadora", desc: "Casas e apartamentos" },
                { href: "/recolha-de-moveis", label: "Recolha de móveis", desc: "Serviço em toda a área" },
                { href: "/recolha-de-sofas", label: "Recolha de sofás", desc: "Sofás e cadeirões" },
                { href: "/recolha-de-camas", label: "Recolha de camas", desc: "Camas e colchões" },
                { href: "/retirar-moveis-velhos", label: "Retirar móveis velhos", desc: "Desmontagem incluída" },
                { href: "/simulador", label: "Simular orçamento", desc: "Cálculo online" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-lg border border-slate-200 bg-white p-4 transition hover:border-amber-200 hover:bg-amber-50"
                >
                  <span className="font-semibold text-slate-900 group-hover:text-amber-700">{link.label}</span>
                  <p className="mt-1 text-sm text-slate-500">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Dúvidas frequentes
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Perguntas sobre recolha de monos na Amadora
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-semibold text-slate-900">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-16 pt-8">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <CTABlock
              variant="centered"
              title="Precisa de recolha de monos na Amadora?"
              description="Peça um orçamento grátis. Atendemos Reboleira, Damaia, Alfragide, Venteira e todas as zonas."
              whatsappMessage="Olá! Preciso de recolha de monos na Amadora. Podem dar-me um orçamento?"
            />
          </div>
        </section>
      </main>
    </>
  );
}
