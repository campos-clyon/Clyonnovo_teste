import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ExternalLink, Heart, Store, Truck } from "lucide-react";

import FurnitureSeoLinks from "@/components/FurnitureSeoLinks";
import { BUSINESS_NAME, SITE_URL } from "@/lib/seo-data";
import { PROPOSTAS_EM_ATE } from "@/lib/promessas-publicas";

/*
 * A PÁGINA PARA QUEM QUER DOAR — reescrita a 30-09-2026.
 *
 * Respondia a «recolha grátis ou privada?», e a pesquisa que a traz é outra:
 * «doar móveis usados», «quem recolhe móveis de graça», «remar recolha de
 * móveis». A descrição prometia um «guia completo com contactos» que a página
 * não tinha. Passa a responder a quem quer doar — com a CLYON no fim, dita
 * como é: um serviço pago, para quando ninguém aceita ou não dá para esperar.
 *
 * REGRA DESTA PÁGINA: cada entidade e cada condição foram lidas no site
 * OFICIAL dela a 30-09-2026, e o link aponta para essa página. Não se
 * escrevem telefones nem moradas — o link leva à fonte, que é quem os mantém.
 * Ficaram de fora, de propósito: a Comunidade Emaús (sem site oficial que
 * diga como doa), a Cáritas de Lisboa (só aceita donativos em dinheiro no
 * site), a Entrajuda (o site não diz que aceita mobiliário), a Comunidade
 * Vida e Paz e a Re-Food (não aceitam móveis), e Oeiras (a página oficial
 * diz «gratuito até 1 m³» e, noutro separador, «sujeito a pagamento»).
 *
 * A CLYON não encaminha peças para doação — não há nada na plataforma que o
 * faça —, e por isso a página não o promete.
 */

const DATA_DA_VERIFICACAO = "30 de setembro de 2026";

export const metadata: Metadata = {
  title: "Doar Móveis Usados em Lisboa: Quem Recolhe de Graça",
  description:
    "Onde doar móveis usados em Lisboa e na Margem Sul: instituições que os vão buscar, recolha de monos gratuita das câmaras, e OLX ou Marketplace.",
  keywords: [
    "doar móveis usados",
    "doar móveis Lisboa",
    "onde doar móveis usados",
    "recolha gratuita de móveis usados Lisboa",
    "associação recolha de móveis usados",
    "remar recolha de móveis",
    "quem recolhe móveis de graça",
    "recolha de monos gratuita",
  ],
  alternates: {
    canonical: `${SITE_URL}/recolha-gratuita-de-moveis-usados`,
  },
  openGraph: {
    title: "Doar Móveis Usados em Lisboa: Quem Recolhe de Graça",
    description:
      "Instituições que vão buscar móveis a casa, recolha de monos gratuita das câmaras e como dar móveis online — confirmado nos sites oficiais.",
    url: `${SITE_URL}/recolha-gratuita-de-moveis-usados`,
    locale: "pt_PT",
    type: "article",
  },
};

type Entidade = { nome: string; oQueDiz: string; fonte: string; rotuloDaFonte: string };

/** Instituições que dizem, no site oficial, que recebem ou recolhem móveis. */
const INSTITUICOES: Entidade[] = [
  {
    nome: "REMAR Portugal",
    oQueDiz:
      "Recolhe móveis, eletrodomésticos, vestuário e outros bens em condições de reutilização. Avalia cada pedido pelo tipo de bens, o estado de conservação, a localização e a disponibilidade das equipas — a recolha não é garantida. Pede-se num formulário no site.",
    fonte: "https://remar.pt/donativos/",
    rotuloDaFonte: "remar.pt — Donativos",
  },
  {
    nome: "Betel Portugal",
    oQueDiz:
      "Diz que recolhe gratuitamente tudo o que estiver aproveitável para um segundo uso: mobiliário, sofás, eletrodomésticos, roupa, livros e brinquedos. Pede-se por formulário ou pelos contactos do site.",
    fonte: "https://betelportugal.org/doar-moveis/",
    rotuloDaFonte: "betelportugal.org — Doar móveis",
  },
  {
    nome: "Cáritas Diocesana de Setúbal",
    oQueDiz:
      "Recebe donativos de mobiliário e de outros bens em espécie: o site pede que a contacte antes. Não diz se vai buscá-los a casa.",
    fonte: "https://www.caritassetubal.pt/campanhas-de-donativos/",
    rotuloDaFonte: "caritassetubal.pt — Campanhas de donativos",
  },
];

/** Recolha de monos das câmaras — para o que já não serve a ninguém. */
const CAMARAS: Entidade[] = [
  {
    nome: "Lisboa",
    oQueDiz:
      "Gratuita e reservada a pessoas em nome individual; empresas e associações recorrem a um coletor particular. O pedido faz-se na Na Minha Rua LX.",
    fonte: "https://www.lisboa.pt/temas/higiene-urbana/separacao-e-reciclagem",
    rotuloDaFonte: "lisboa.pt — Separação e reciclagem",
  },
  {
    nome: "Almada",
    oQueDiz:
      "Gratuita: agenda-se a recolha à porta com a junta de freguesia, por linha verde ou email. Sofás, colchões e móveis também podem ser entregues no Ecocentro de Almada.",
    fonte: "https://www.cm-almada.pt/o-que-e-um-mono-ou-monstro",
    rotuloDaFonte: "cm-almada.pt — O que é um mono",
  },
  {
    nome: "Seixal",
    oQueDiz:
      "Gratuita até 8 m³, com marcação prévia na Linha Seixal Limpo ou por email; a recolha é semanal, em dias definidos para cada freguesia.",
    fonte: "https://www.cm-seixal.pt/limpeza-urbana/residuos",
    rotuloDaFonte: "cm-seixal.pt — Resíduos",
  },
  {
    nome: "Barreiro",
    oQueDiz: "Gratuita, para objetos volumosos e fora de uso — mesas, sofás, camas, fogões, frigoríficos. Os contactos para marcar estão na página.",
    fonte: "https://www.cm-barreiro.pt/viver/aguas-e-higiene-urbana/residuos-e-higiene-urbana/recolha-de-monos/",
    rotuloDaFonte: "cm-barreiro.pt — Recolha de monos",
  },
  {
    nome: "Setúbal",
    oQueDiz:
      "Os Serviços Municipalizados recolhem gratuitamente mobiliário, equipamentos elétricos, colchões e outros objetos fora de uso, com agendamento por telefone.",
    fonte: "https://sms-setubal.pt/sms-residuos/recolha-de-monos-e-objetos-fora-de-uso/",
    rotuloDaFonte: "sms-setubal.pt — Recolha de monos",
  },
  {
    nome: "Cascais",
    oQueDiz:
      "Recolhe objetos fora de uso; marca-se com 48 horas de antecedência, pela Linha Cascais ou pelo FixCascais. A página não indica taxa.",
    fonte: "https://www.cascais.pt/servico/recolha-de-objetos-fora-de-uso",
    rotuloDaFonte: "cascais.pt — Recolha de objetos fora de uso",
  },
  {
    nome: "Amadora",
    oQueDiz:
      "Marca-se com a junta de freguesia (data, hora e local), e cabe a quem pede levar os objetos até esse local. A página não diz se é gratuita.",
    fonte: "https://www.cm-amadora.pt/pt/territorio/ambiente-novo/residuos-e-limpeza-urbana/8813-residuos-urbanos-indiferenciados-novo.html",
    rotuloDaFonte: "cm-amadora.pt — Recolha de monos",
  },
  {
    nome: "Sintra",
    oQueDiz:
      "Marca-se com a junta de freguesia, até 10 unidades por mês, e é quem pede que leva os objetos a um local acessível à viatura. A página não diz se é gratuita.",
    fonte: "https://www.smas-sintra.pt/residuos/rede-de-recolha-de-residuos-urbanos/monos/",
    rotuloDaFonte: "smas-sintra.pt — Monos",
  },
  {
    nome: "Odivelas",
    oQueDiz: "A recolha de monos é das juntas de freguesia: contacte a sua. A página não diz se é gratuita.",
    fonte: "https://www.cm-odivelas.pt/areas-de-intervencao/ambiente/monos-e-residuos-verdes",
    rotuloDaFonte: "cm-odivelas.pt — Monos e resíduos verdes",
  },
];

/** Dar ou vender online. */
const ONLINE: Entidade[] = [
  {
    nome: "OLX",
    oQueDiz:
      "Os termos de utilização preveem que um artigo seja anunciado como disponibilizado gratuitamente, e os anúncios dentro dos limites da categoria não se pagam.",
    fonte: "https://help.olx.pt/olxpthelp/s/article/termos-de-utilizao-V22",
    rotuloDaFonte: "help.olx.pt — Termos de utilização",
  },
  {
    nome: "Marketplace do Facebook",
    oQueDiz: "Para marcar um artigo como gratuito, põe-se 0 no preço. O levantamento combina-se com quem fica com a peça.",
    fonte: "https://www.facebook.com/help/561376580709359?locale=pt_PT",
    rotuloDaFonte: "facebook.com — Vender no Marketplace",
  },
];

/*
 * A FAQ visível e a do FAQPage saem desta lista, e só desta — nunca duas
 * versões da mesma resposta. Sem aggregateRating: esta página não mostra
 * avaliações (ver prova-social.test.ts).
 */
const faqs = [
  {
    q: "Quem recolhe móveis usados de graça em Lisboa?",
    a: "A REMAR e a Betel dizem nos seus sites que vão buscar móveis em condições de serem reaproveitados — a REMAR depois de avaliar cada pedido. Para o que já não serve, a Câmara de Lisboa remove monos gratuitamente a particulares, com pedido na Na Minha Rua LX.",
  },
  {
    q: "A recolha de monos da Câmara de Lisboa é gratuita?",
    a: "Sim, para pessoas em nome individual. Segundo o site da câmara, empresas e associações têm de recorrer a um coletor particular. O pedido faz-se na Na Minha Rua LX.",
  },
  {
    q: "A REMAR vai buscar móveis a casa?",
    a: "Diz que recolhe móveis, eletrodomésticos e outros bens em condições de reutilização, mas avalia cada pedido pelo tipo de bens, o estado, a localização e a disponibilidade das equipas. Pede-se no formulário do site remar.pt.",
  },
  {
    q: "Posso dar móveis de graça no OLX ou no Facebook?",
    a: "Sim. No OLX, os termos preveem anunciar um artigo como disponibilizado gratuitamente; no Marketplace do Facebook, marca-se como gratuito pondo 0 no preço. O levantamento combina-se com quem fica com a peça.",
  },
  {
    q: "E se os móveis estiverem estragados?",
    a: "As instituições pedem peças em condições de reutilização, por isso móveis partidos ou com humidade dificilmente são aceites. Aí fica a recolha de monos da câmara ou da junta, o ecocentro, ou uma recolha paga.",
  },
  {
    q: "A CLYON recolhe móveis de graça?",
    a: `Não. A CLYON liga-o a profissionais da sua zona que recolhem móveis — é um serviço pago, e recebe propostas ${PROPOSTAS_EM_ATE}. O que o profissional leva vai para destino licenciado; a CLYON não encaminha peças para doação.`,
  },
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: BUSINESS_NAME, item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Recolha de Móveis", item: `${SITE_URL}/recolha-de-moveis` },
    { "@type": "ListItem", position: 3, name: "Doar Móveis Usados", item: `${SITE_URL}/recolha-gratuita-de-moveis-usados` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

export const revalidate = 86400;

function CartaoDeEntidade({ e }: { e: Entidade }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-900">{e.nome}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{e.oQueDiz}</p>
      <a
        href={e.fonte}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-acao hover:underline"
      >
        {e.rotuloDaFonte}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}

export default function DoarMoveisUsadosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Herói */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-14 pt-10 lg:px-8 lg:pb-16 lg:pt-14">
          <div className="mt-8 max-w-4xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Doar móveis usados em Lisboa: quem recolhe de graça
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Se os móveis ainda servem, há instituições que os vão buscar sem cobrar. Se já não servem,
              as câmaras e as juntas recolhem monos — em muitos concelhos de graça, sempre com marcação.
              E há sempre a via de os dar a quem os quiser, online.
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Só está aqui o que confirmámos no site oficial de cada entidade, a {DATA_DA_VERIFICACAO}.
              As condições mudam: confirme no link de cada uma antes de marcar.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-200" />
      </section>

      {/* Instituições */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <Heart className="mt-1 h-6 w-6 shrink-0 text-acao" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Instituições que recebem móveis</h2>
          </div>
          <p className="mt-3 max-w-3xl text-base text-slate-600">
            Pedem peças em condições de serem reaproveitadas. Fotografias e uma descrição honesta do estado
            ajudam a que o pedido seja aceite.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {INSTITUICOES.map((e) => (
              <CartaoDeEntidade key={e.nome} e={e} />
            ))}
          </div>
        </div>
      </section>

      {/* Câmaras */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <Building2 className="mt-1 h-6 w-6 shrink-0 text-acao" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Recolha de monos das câmaras</h2>
          </div>
          <p className="mt-3 max-w-3xl text-base text-slate-600">
            Para o que já não serve a ninguém. Marca-se sempre antes, e deixar monos na rua fora do dia
            combinado pode dar coima.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAMARAS.map((e) => (
              <CartaoDeEntidade key={e.nome} e={e} />
            ))}
          </div>
        </div>
      </section>

      {/* Online */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <Store className="mt-1 h-6 w-6 shrink-0 text-acao" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Dar ou vender online</h2>
          </div>
          <p className="mt-3 max-w-3xl text-base text-slate-600">
            Funciona bem para peças em bom estado e com procura — desde que haja tempo para responder a
            mensagens e combinar o levantamento.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {ONLINE.map((e) => (
              <CartaoDeEntidade key={e.nome} e={e} />
            ))}
          </div>
        </div>
      </section>

      {/* Perguntas frequentes */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Perguntas frequentes sobre doar móveis</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">{faq.q}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quando ninguém aceita — a CLYON, dita como é */}
      <section className="bg-acao py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <Truck className="mx-auto h-8 w-8 text-white" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
            Quando ninguém aceita ou não pode esperar
          </h2>
          <p className="mt-4 text-lg text-cyan-100">
            A CLYON liga-o a profissionais da sua zona que recolhem — é um serviço pago; recebe propostas{" "}
            {PROPOSTAS_EM_ATE}. O profissional carrega dentro de casa, desmonta se o pedir e leva o que sai
            para destino licenciado.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/simulador"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-acao transition hover:bg-cyan-50"
            >
              Pedir propostas no simulador
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Ligações internas */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <FurnitureSeoLinks currentPage="/recolha-gratuita-de-moveis-usados" variant="grid" />
        </div>
      </section>
    </div>
  );
}
