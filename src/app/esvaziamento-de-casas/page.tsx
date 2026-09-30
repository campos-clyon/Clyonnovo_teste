import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Home, Package, Phone, Sparkles, Trash2, Truck, Users } from "lucide-react";
import CTABlock from "@/components/CTABlock";
import { NOTA_DE_PRECO } from "@/lib/seo-data";
import { PRECOS } from "@/lib/precos-publicos";
import { PRESTADOR } from "@/lib/dados-estruturados";
import {
  AO_FIM_DE_SEMANA,
  DESMONTAGEM_A_PEDIDO,
  NO_MESMO_DIA,
  PROPOSTAS_EM_ATE,
  RECEBE_PROPOSTAS,
} from "@/lib/promessas-publicas";

/*
 * 30-09-2026 — O QUE ESTA PÁGINA DEIXOU DE PROMETER.
 *
 * «Doamos o que estiver em bom estado a instituições parceiras» e «limpeza
 * associada / limpeza pós-obra completa». Não há instituição parceira nem
 * circuito de doação na plataforma, e a limpeza não é uma categoria de
 * serviço (service-categories.ts). Quem quer doar tem a página própria, com
 * as instituições confirmadas nos sites oficiais.
 */

const SITE_URL = "https://clyon.pt";

/*
 * Os dois valores publicados para esvaziamento, e nada fora deles.
 *
 * A grelha desta página abria nos 300 € e ia aos 1500 €; a grelha oficial diz
 * desde 250 € para casa e 260 – 450 € para apartamento. As linhas de
 * apartamento vivem agora dentro dessa faixa e a moradia começa onde ela
 * acaba — nenhum número desta página contradiz o preçário.
 */
const PRECO_CASA = PRECOS.esvaziamento_casa.etiqueta; // "desde 250 €"
const PRECO_APARTAMENTO = PRECOS.esvaziamento_apartamento.etiqueta; // "260 – 450 €"

export const metadata: Metadata = {
  title: "Esvaziamento de Casas e Apartamentos — Heranças",
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description:
    `Esvaziar casa ou apartamento em Lisboa, Margem Sul e Setúbal: profissionais verificados retiram móveis, eletrodomésticos e recheio. Preços ${PRECO_CASA}.`,
  keywords: [
    "esvaziar casas",
    "esvaziar casa",
    "esvaziar casa Lisboa",
    "esvaziar apartamento",
    "esvaziar apartamento Lisboa",
    "esvaziamento de casas",
    "esvaziamento de casa Lisboa",
    "esvaziamento de apartamento",
    "esvaziamento de heranças",
    "esvaziamento de recheio",
    "esvaziamento de imóveis",
    "remoção de recheio",
    "esvaziamento Margem Sul",
    "esvaziamento Setúbal",
    "quem esvazia casas",
  ],
  alternates: { canonical: `${SITE_URL}/esvaziamento-de-casas` },
  openGraph: og({
    // Sem «em Lisboa», como o título: o hub é o das três regiões (29-09-2026).
    title: "Esvaziamento de Casas e Apartamentos — Heranças",
    description:
      `Esvaziamento completo de casas, apartamentos e heranças em Lisboa, Margem Sul e Setúbal. Preços ${PRECO_CASA}. Orçamento em 6h.`,
    url: `${SITE_URL}/esvaziamento-de-casas`,
  }),
};

const faqs = [
  {
    question: "O que está incluído no esvaziamento de casa?",
    answer: "O profissional retira móveis, eletrodomésticos, monos, objetos volumosos e recheios completos: carrega, transporta e leva para destino licenciado. O que cada proposta inclui vem escrito nela.",
  },
  {
    question: "Quanto custa esvaziar uma casa em Lisboa?",
    answer: `O valor depende do volume, acessos, andar e elevador. Um esvaziamento de casa é a partir de 250 €. Num apartamento fica em ${PRECO_APARTAMENTO}: T0/T1 em 260 – 350 €, T2 em 320 – 420 €, T3/T4 em 380 – 450 €. Numa moradia completa, a partir de 450 €. Descreva o imóvel com fotos e recebe propostas ${PROPOSTAS_EM_ATE}. ${NOTA_DE_PRECO.curta}`,
  },
  {
    question: "Fazem esvaziamento de casas de herança?",
    answer: "Sim, é dos pedidos mais comuns. Se houver objetos a guardar (fotografias, documentos, jóias), separe-os antes ou indique-os no pedido, para o profissional os deixar de lado. A família não precisa de estar presente, se combinar com o profissional a entrega das chaves.",
  },
  {
    question: "Retiram os móveis de dentro da casa?",
    answer: `Sim, o profissional entra no imóvel, carrega tudo e transporta. Não precisa de colocar nada no exterior. ${DESMONTAGEM_A_PEDIDO}`,
  },
  {
    question: "Também fazem limpeza após o esvaziamento?",
    answer: "A limpeza não é um serviço da CLYON: o esvaziamento deixa o imóvel sem recheio. Se quiser que fique também varrido, escreva-o no pedido — o profissional diz na proposta se o faz. Para limpeza a fundo, conte com uma empresa de limpezas.",
  },
  {
    question: "Quanto tempo demora um esvaziamento?",
    answer: "Depende do volume e dos acessos. Como referência, um T1 costuma ficar vazio em 3 a 5 horas e um T2 em meio dia; T3 e moradias podem precisar de um dia ou dois, e heranças com muito acumulado de mais. Combine a duração com o profissional antes de aceitar a proposta.",
  },
  {
    question: "Precisam que eu esteja presente durante o esvaziamento?",
    answer: "Não é obrigatório. Basta entregar as chaves no início e recolhê-las no final. Se preferir acompanhar, também é possível. Muitos senhorios e famílias em heranças pedem que o profissional trate de tudo sem estarem presentes; a entrega das chaves combina-se com ele.",
  },
  {
    question: "Podem separar objetos de valor antes de esvaziar?",
    answer: "Sim. Indique no pedido os documentos, fotografias, objetos de valor sentimental, jóias ou quadros que quer guardar — ou separe-os antes. O profissional deixa de lado o que indicar.",
  },
  {
    question: "O que acontece aos objetos retirados?",
    answer: "O profissional leva o que sai para destino licenciado — ecocentro ou operador de resíduos, com os recicláveis separados. Se quiser doar peças em bom estado, faça-o antes do esvaziamento: a página «Doar móveis usados em Lisboa» diz quem as recebe.",
  },
  {
    question: "Fazem esvaziamento de apartamento sem elevador?",
    answer: "Sim. Sem elevador o esforço é maior, e o profissional conta-o na proposta — indique o andar no pedido.",
  },
  {
    question: "Fazem esvaziamento de garagens, arrecadações e caves?",
    answer: "Sim. Serviço específico para espaços de arrumação, a partir de 250 € para arrecadações pequenas. Ideal para libertar espaço em condomínios ou preparar venda de imóvel.",
  },
  {
    question: "Fazem esvaziamento urgente?",
    answer: `${NO_MESMO_DIA} ${AO_FIM_DE_SEMANA}`,
  },
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Esvaziamento de Casas",
  description: "Serviço de esvaziamento de casas, apartamentos, garagens e arrecadações em Lisboa, Margem Sul e Setúbal.",
  // O prestador é o LocalBusiness do layout, por @id — e não uma cópia
  // sem morada (ou com uma morada inventada) em cada página (29-09-2026).
  provider: PRESTADOR,
  areaServed: {
    "@type": "GeoCircle",
    geoMidpoint: { "@type": "GeoCoordinates", latitude: 38.7223, longitude: -9.1393 },
    geoRadius: "50000",
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
  ],
};

const whatWeRemove = [
  "Móveis de todos os tipos (sofás, camas, armários, mesas, cadeiras)",
  "Eletrodomésticos (frigoríficos, máquinas de lavar, fogões, micro-ondas)",
  "Monos e objetos volumosos (colchões, carpetes, espelhos, quadros)",
  "Recheios completos de apartamentos e moradias",
  "Objetos de garagem, arrecadação e cave",
  "Restos de mudança e objetos acumulados",
];

const forWhom = [
  { icon: Home, title: "Heranças", desc: "Esvaziamento de imóveis herdados com remoção de recheio completo." },
  { icon: Users, title: "Venda de imóvel", desc: "Preparar casa ou apartamento para venda, visitas ou escritura." },
  { icon: Package, title: "Fim de arrendamento", desc: "Libertar o imóvel para devolução ao senhorio ou nova ocupação." },
  { icon: Sparkles, title: "Remodelação", desc: "Esvaziar divisões ou imóvel completo antes de obras." },
  { icon: Trash2, title: "Casas acumuladas", desc: "Remoção de objetos e móveis em imóveis com excesso de coisas." },
  { icon: Truck, title: "Mudança incompleta", desc: "Retirar o que ficou para trás após uma mudança." },
];

const zones = [
  { name: "Lisboa", cities: ["Benfica", "Lumiar", "Alvalade", "Areeiro", "Olivais", "Parque das Nações"] },
  { name: "Amadora", cities: ["Reboleira", "Damaia", "Alfragide", "Venteira", "Mina de Água"] },
  { name: "Margem Sul", cities: ["Almada", "Seixal", "Barreiro", "Montijo", "Moita"] },
  { name: "Setúbal", cities: ["Setúbal", "Palmela", "Sesimbra"] },
  { name: "Linha de Cascais", cities: ["Cascais", "Oeiras", "Estoril", "Carcavelos"] },
  { name: "Sintra", cities: ["Sintra", "Queluz", "Cacém", "Agualva"] },
];

export default function EsvaziamentoDeCasasPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }}
      />

      <main className="bg-slate-50">
        {/* Hero */}
        <section className="bg-gradient-to-b from-white to-slate-50 pb-12 pt-8">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mt-8 grid items-start gap-10 lg:grid-cols-2">
              <div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
                  Esvaziar casa ou apartamento em Lisboa, Amadora e Setúbal
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Esvaziamento completo de casas, apartamentos, moradias, garagens e arrecadações, por
                  profissionais verificados da sua zona: retiram móveis, eletrodomésticos, roupa e recheio,
                  carregam, transportam e levam para destino licenciado. Tem peças em bom estado?{" "}
                  <Link href="/recolha-gratuita-de-moveis-usados" className="font-semibold text-acao hover:underline">
                    Veja quem as recebe de graça
                  </Link>{" "}
                  antes de esvaziar.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/simulador"
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-acao px-6 text-sm font-semibold text-white transition hover:bg-acao-hover"
                  >
                    Simular orçamento
                  </Link>
                  <a
                    href="https://wa.me/351931632622?text=Olá! Preciso de esvaziamento de casa. Podem dar-me um orçamento?"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#25D366] px-6 text-sm font-semibold text-whatsapp-tinta transition hover:bg-[#20bd5a]"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </a>
                  <a
                    href="tel:+351931632622"
                    className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 text-sm font-semibold transition hover:bg-slate-50"
                    style={{ color: '#334155' }}
                  >
                    <Phone className="h-4 w-4" />
                    Ligar agora
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mt-4 space-y-3">
                  {[
                    { type: "Apartamento T0/T1", price: "260 – 350 €" },
                    { type: "Apartamento T2", price: "320 – 420 €" },
                    { type: "Apartamento T3/T4", price: "380 – 450 €" },
                    { type: "Moradia completa", price: "desde 450 €" },
                    { type: "Garagem / arrecadação", price: PRECO_CASA },
                    { type: "Loja / escritório", price: "orçamento personalizado" },
                  ].map((item) => (
                    <div key={item.type} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-700">{item.type}</span>
                      <span className="font-semibold text-emerald-600">{item.price}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  {NOTA_DE_PRECO.curta} Depende do volume, acessos e andar.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Para quem */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Quando pedir esvaziamento de casa
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {forWhom.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5">
                  <item.icon className="h-6 w-6 text-emerald-600" />
                  <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* O que retiramos */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              O que o profissional retira no esvaziamento
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

        {/* Como funciona */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Como funciona o esvaziamento
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {[
                { step: "01", title: "Envie o pedido", desc: "Fotos do imóvel, localização e acesso. WhatsApp ou formulário." },
                { step: "02", title: "Receba propostas", desc: `Profissionais da zona respondem ${PROPOSTAS_EM_ATE}, com o valor e a data que propõem.` },
                { step: "03", title: "Execução no local", desc: "O profissional que escolher chega, carrega tudo e leva para destino licenciado." },
                { step: "04", title: "Confirma e avalia", desc: "Com o imóvel vazio, confirma o trabalho feito e deixa a sua avaliação." },
              ].map((item) => (
                <div key={item.step} className="rounded-xl border border-slate-200 bg-white p-5">
                  <span className="text-2xl font-bold text-emerald-600">{item.step}</span>
                  <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Diferença entre recolha e esvaziamento */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Recolha de móveis vs esvaziamento completo
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-6">
                <h3 className="font-semibold text-slate-900">Recolha de móveis</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Ideal quando precisa de retirar alguns móveis específicos: um sofá, uma cama, um armário. 
                  O profissional retira os itens indicados, carrega e transporta.
                </p>
                <Link href="/recolha-de-moveis" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-acao hover:underline">
                  Ver serviço de recolha de móveis
                </Link>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-6">
                <h3 className="font-semibold text-slate-900">Esvaziamento completo</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Indicado quando precisa de libertar o imóvel por completo: todos os móveis, eletrodomésticos, 
                  monos e objetos. Inclui a remoção de tudo o que indicar.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                  Está nesta página
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Zonas atendidas */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Zonas com profissionais de esvaziamento
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {zones.map((zone) => (
                <div key={zone.name} className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold text-slate-900">{zone.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">{zone.cities.join(", ")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Links internos */}
        <section className="bg-slate-50/50 py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Outros serviços da CLYON
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: "/esvaziamento-de-casas-amadora", label: "Esvaziamento na Amadora", desc: "Serviço local" },
                { href: "/recolha-de-moveis", label: "Recolha de móveis", desc: "Sofás, camas, armários" },
                { href: "/recolha-de-monos-amadora", label: "Recolha de monos", desc: "Volumosos e sucata" },
                { href: "/retirar-moveis-velhos", label: "Retirar móveis velhos", desc: "Desmontagem a pedido" },
                { href: "/recolha-moveis-lisboa", label: "Móveis em Lisboa", desc: "Lisboa e bairros" },
                { href: "/recolha-moveis-almada", label: "Móveis em Almada", desc: "Margem Sul" },
                { href: "/simulador", label: "Simular orçamento", desc: "Cálculo online" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-cyan-200 hover:shadow-md"
                >
                  <div>
                    <span className="font-semibold text-slate-900 group-hover:text-acao-hover">{link.label}</span>
                    <p className="mt-0.5 text-sm text-slate-500">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-acao-hover" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Perguntas sobre esvaziamento de casas
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-xl border border-slate-200 bg-white p-5">
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
              title="Precisa de esvaziar uma casa ou apartamento?"
              description={`Descreva o imóvel e peça orçamento grátis. ${RECEBE_PROPOSTAS}`}
              whatsappMessage="Olá! Preciso de esvaziamento de casa. Podem dar-me um orçamento?"
            />
          </div>
        </section>
      </main>
    </>
  );
}
