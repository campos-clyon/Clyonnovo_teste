import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Home, MapPin, Package, Phone, Sparkles, Trash2, Truck } from "lucide-react";
import CTABlock from "@/components/CTABlock";

const SITE_URL = "https://clyon.pt";

export const metadata: Metadata = {
  title: "Esvaziamento de Casas na Amadora | Apartamentos, Garagens e Arrecadações",
  description:
    "Esvaziamento de casas e apartamentos na Amadora com remoção de móveis, monos, eletrodomésticos e limpeza associada. Atendemos Reboleira, Damaia, Alfragide, Venteira e mais zonas.",
  alternates: { canonical: `${SITE_URL}/esvaziamento-de-casas-amadora` },
  openGraph: {
    title: "Esvaziamento de Casas na Amadora | Apartamentos, Garagens e Arrecadações",
    description:
      "Esvaziamento completo na Amadora com remoção de móveis e limpeza. Reboleira, Damaia, Alfragide, Venteira.",
    url: `${SITE_URL}/esvaziamento-de-casas-amadora`,
  },
};

const faqs = [
  {
    question: "A CLYON faz esvaziamento de casas na Amadora?",
    answer: "Sim, fazemos esvaziamento completo de casas, apartamentos, garagens e arrecadações em toda a Amadora, incluindo Reboleira, Damaia, Alfragide, Venteira, Mina de Água, Buraca e Falagueira-Venda Nova.",
  },
  {
    question: "Vocês retiram os móveis de dentro do apartamento?",
    answer: "Sim, a nossa equipa entra no imóvel, desmonta o necessário, carrega tudo e transporta. Mesmo em prédios sem elevador ou com acessos difíceis.",
  },
  {
    question: "Quanto custa esvaziar um apartamento na Amadora?",
    answer: "O valor depende do volume, andar, elevador e estado do imóvel. Um T1/T2 costuma ficar entre 300€ e 600€. Envie fotos para orçamento rápido.",
  },
  {
    question: "Fazem esvaziamento de casas de herança na Amadora?",
    answer: "Sim, é um dos pedidos mais frequentes. Tratamos do esvaziamento completo incluindo móveis antigos, eletrodomésticos, monos e limpeza quando necessário.",
  },
  {
    question: "Também fazem limpeza após o esvaziamento?",
    answer: "Sim, oferecemos limpeza básica ou completa após a remoção. O valor é combinado no orçamento dependendo do estado do imóvel.",
  },
  {
    question: "Fazem esvaziamento de garagens e arrecadações na Amadora?",
    answer: "Sim, esvaziamos garagens, arrecadações, caves e armazéns. Removemos móveis guardados, monos, sucata e objetos acumulados.",
  },
  {
    question: "Qual o prazo para fazer o esvaziamento?",
    answer: "Conseguimos agendar normalmente em 1-3 dias úteis. Para pedidos urgentes, podemos avaliar disponibilidade no mesmo dia ou dia seguinte.",
  },
];

const amadoraZones = [
  { name: "Reboleira", desc: "Zona central da Amadora com muitos prédios e apartamentos." },
  { name: "Damaia", desc: "Área residencial com boa acessibilidade ao centro." },
  { name: "Venteira", desc: "Zona junto ao centro comercial e estação de comboios." },
  { name: "Alfragide", desc: "Área mista com habitação, comércio e escritórios." },
  { name: "Mina de Água", desc: "Zona residencial a norte da Amadora." },
  { name: "Águas Livres", desc: "Área junto ao aqueduto com prédios e moradias." },
  { name: "Encosta do Sol", desc: "Zona habitacional com vista sobre Lisboa." },
  { name: "Falagueira-Venda Nova", desc: "Área de crescimento com novos edifícios." },
  { name: "Buraca", desc: "Zona próxima de Benfica com fácil acesso." },
];

const whatWeRemove = [
  "Móveis de todos os tipos (sofás, camas, armários, estantes)",
  "Eletrodomésticos grandes e pequenos",
  "Monos, objetos volumosos e sucata",
  "Recheios completos de apartamentos",
  "Conteúdo de garagens e arrecadações",
  "Restos de mudança e objetos acumulados",
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Esvaziamento de Casas na Amadora",
  description: "Serviço de esvaziamento de casas e apartamentos na Amadora com remoção de móveis, monos e limpeza.",
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
    { "@type": "ListItem", position: 2, name: "Esvaziamento de Casas", item: `${SITE_URL}/esvaziamento-de-casas` },
    { "@type": "ListItem", position: 3, name: "Amadora", item: `${SITE_URL}/esvaziamento-de-casas-amadora` },
  ],
};

export default function EsvaziamentoAmadoraPage() {
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
            <div className="mt-8 grid items-start gap-10 lg:grid-cols-2">
              <div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
                  Esvaziamento de casas e apartamentos na Amadora
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  A CLYON faz esvaziamento completo de casas e apartamentos na Amadora. Retiramos móveis, 
                  eletrodomésticos, monos e recheios com carregamento, transporte e limpeza associada. 
                  Atendemos Reboleira, Damaia, Alfragide, Venteira, Mina de Água, Buraca e todas as freguesias.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/simulador"
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Simular orçamento
                  </Link>
                  <a
                    href="https://wa.me/351965785395?text=Olá! Preciso de esvaziamento de casa na Amadora. Podem dar-me um orçamento?"
                    className="inline-flex h-12 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-6 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
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

              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mt-4 space-y-3">
                  {[
                    { type: "Apartamento T0/T1", price: "300€ – 500€" },
                    { type: "Apartamento T2/T3", price: "500€ – 800€" },
                    { type: "Moradia ou T4+", price: "800€ – 1500€" },
                    { type: "Garagem ou arrecadação", price: "150€ – 400€" },
                  ].map((item) => (
                    <div key={item.type} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-700">{item.type}</span>
                      <span className="font-semibold text-emerald-600">{item.price}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Valores orientativos. O preço final depende do volume, andar, elevador e limpeza.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quando pedir */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Quando pedir esvaziamento de casa na Amadora
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Home, title: "Herança ou espólio", desc: "Esvaziamento de imóveis herdados na Amadora com remoção completa." },
                { icon: Package, title: "Venda ou arrendamento", desc: "Libertar apartamento para escritura, visitas ou novo inquilino." },
                { icon: Sparkles, title: "Remodelação", desc: "Esvaziar divisões ou imóvel completo antes de obras na Amadora." },
                { icon: Trash2, title: "Acumulação", desc: "Remoção de objetos e móveis em casas com excesso de coisas." },
                { icon: Truck, title: "Mudança incompleta", desc: "Retirar o que ficou para trás após uma mudança." },
                { icon: MapPin, title: "Fim de arrendamento", desc: "Devolver imóvel vazio e limpo ao senhorio." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5">
                  <item.icon className="h-6 w-6 text-emerald-600" />
                  <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* O que removemos */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              O que a equipa remove na Amadora
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {whatWeRemove.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Esvaziamento com limpeza */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  Esvaziamento com limpeza na Amadora
                </h2>
                <p className="mt-4 text-slate-600">
                  Além do esvaziamento, oferecemos limpeza associada. A equipa retira todos os móveis 
                  e objetos, e depois faz limpeza básica (varrer, remover restos) ou limpeza mais 
                  completa dependendo do estado do imóvel.
                </p>
                <p className="mt-4 text-slate-600">
                  Este serviço é ideal para quem precisa de entregar o imóvel pronto — seja para 
                  escritura, arrendamento, visitas ou simplesmente para usar novamente.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-6">
                <h3 className="font-semibold text-slate-900">O que inclui a limpeza</h3>
                <ul className="mt-4 space-y-2">
                  {[
                    "Remoção de pó e detritos após a recolha",
                    "Varrer e limpar o chão",
                    "Retirar restos de embalagens e papéis",
                    "Limpeza de superfícies (opcional)",
                    "Deixar o espaço apresentável",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Zonas da Amadora */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Zonas da Amadora onde fazemos esvaziamento
            </h2>
            <p className="mt-2 text-slate-600">
              Atendemos todas as freguesias e zonas da Amadora, incluindo áreas com prédios antigos, 
              escadas sem elevador e acessos mais difíceis.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {amadoraZones.map((zone) => (
                <div key={zone.name} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-900">{zone.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{zone.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Serviços relacionados */}
        <section className="bg-slate-50/50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Outros serviços que pode precisar
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: "/recolha-moveis-amadora", label: "Recolha de móveis na Amadora", desc: "Sofás, camas, armários" },
                { href: "/recolha-de-monos-amadora", label: "Recolha de monos na Amadora", desc: "Volumosos e sucata" },
                { href: "/esvaziamento-de-casas", label: "Esvaziamento de casas", desc: "Página geral do serviço" },
                { href: "/recolha-de-moveis", label: "Recolha de móveis", desc: "Serviço em toda a área" },
                { href: "/recolha-de-sofas", label: "Recolha de sofás", desc: "Sofás e cadeirões" },
                { href: "/retirar-moveis-velhos", label: "Retirar móveis velhos", desc: "Desmontagem incluída" },
                { href: "/simulador", label: "Simular orçamento", desc: "Cálculo online" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-cyan-200 hover:shadow-md"
                >
                  <div>
                    <span className="font-semibold text-slate-900 group-hover:text-cyan-700">{link.label}</span>
                    <p className="mt-0.5 text-sm text-slate-500">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-600" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Perguntas sobre esvaziamento na Amadora
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
              title="Precisa de esvaziar uma casa na Amadora?"
              description="Peça um orçamento grátis. Atendemos Reboleira, Damaia, Alfragide, Venteira e todas as zonas."
              whatsappMessage="Olá! Preciso de esvaziamento de casa na Amadora. Podem dar-me um orçamento?"
            />
          </div>
        </section>
      </main>
    </>
  );
}
