import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Phone,
  Recycle,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { notFound } from "next/navigation";

import FurnitureSeoLinks from "@/components/FurnitureSeoLinks";
import ProfissionaisComPagina from "@/components/ProfissionaisComPagina";
import {
  getCityServiceContent,
  getCityBaseContent,
  hasPriorityContent,
} from "@/lib/city-content";
import {
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CONTACT_PATH,
  SITE_URL,
  getAllCityServiceSlugs,
  getCityServiceSlug,
  getRegion,
  getRelatedCities,
  parseCityServiceSlug,
  AVALIACOES_TOTAL,
  PRAZO_DE_RESPOSTA,
  NOTA_DE_PRECO,
} from "@/lib/seo-data";
import { caminhoDoServicoNaCidade } from "@/lib/caminho-da-cidade";
import { PRECOS } from "@/lib/precos-publicos";
import { PRESTADOR } from "@/lib/dados-estruturados";
import { descricaoDaCidade } from "@/lib/descricoes-seo";
import { tituloDaCidade } from "@/lib/titulos-seo";
import { PESO_MAXIMO_DO_SACO_KG } from "@/lib/sacos-de-entulho";
import { getCidadeLocal, type ServicoSlug } from "@/lib/cidades-local";
import { CONSULTADAS_EM, recolhaDaCamara } from "@/lib/recolha-da-camara";
import { NO_MESMO_DIA } from "@/lib/promessas-publicas";

/*
 * Os preços vêm todos de `precos-publicos`. São 70+ páginas geradas a partir
 * deste ficheiro: um número escrito à mão aqui multiplica-se por setenta e
 * nunca mais bate certo com a grelha. (Os dos monos e do entulho só eram
 * usados na description, que passou para `descricoes-seo.ts`.)
 */
const PRECO_MOVEIS = PRECOS.recolha_moveis.etiqueta; // "40 – 120 €"

type Props = {
  params: Promise<{ slug: string[] }>;
};

function isFurnitureService(serviceSlug: string) {
  return serviceSlug === "recolha-moveis";
}


/*
 * A description destas páginas sai de `descricaoDaCidade` (descricoes-seo.ts)
 * desde 29-09-2026. Aqui havia uma função com uma frase por serviço — e casos
 * à parte para Lisboa, Setúbal, Almada e Cascais — que dava 190 a 300
 * caracteres, e a meta juntava-lhe ainda as freguesias, cortando o conjunto
 * aos 320. O Google mostra uns 155: o que ficava à vista era meia frase.
 */

function getServiceIntro(serviceName: string, cityName: string, regionLabel: string, serviceSlug: string, citySlug: string) {
  // Primeiro, tentar conteúdo prioritário cidade+serviço
  const priorityContent = getCityServiceContent(citySlug, serviceSlug);
  if (priorityContent?.localIntro) {
    return priorityContent.localIntro;
  }
  
  // Fallback para conteúdo base da cidade
  const cityContent = getCityBaseContent(citySlug);
  if (cityContent?.localIntro) {
    if (isFurnitureService(serviceSlug)) {
      return `${cityContent.localIntro} Os profissionais retiram sofás, camas, armários, mesas, colchões e eletrodomésticos — e desmontam, se o pedir.`;
    }
    return `${cityContent.localIntro} ${serviceName} com propostas de profissionais da zona e preço fechado antes de começar.`;
  }

  // Fallback genérico
  if (isFurnitureService(serviceSlug)) {
    return `A CLYON liga o seu pedido de recolha de móveis em ${cityName} a profissionais verificados, para apartamentos, moradias, lojas e escritórios. Os profissionais retiram sofás, camas, armários, mesas, colchões e eletrodomésticos com carregamento porta a porta, desmontagem a pedido e destino licenciado em ${regionLabel}.`;
  }

  // 30-09-2026: dizia «Trabalhamos em contexto residencial e comercial». A
  // CLYON não vai a casa de ninguém — quem vai é o profissional que o cliente
  // escolher, e é isso que a frase tem de dizer.
  return `${serviceName} em ${cityName}: descreve o que precisa e recebe propostas de profissionais verificados da sua zona, com o preço fechado antes de começar. Para casas, lojas e escritórios em ${regionLabel}.`;
}

function getIncludedItems(serviceName: string, cityName: string, serviceSlug: string) {
  if (isFurnitureService(serviceSlug)) {
    return [
      `Sofás, chaise longues e cadeirões em ${cityName}`,
      "Camas, estrados, colchões e mesinhas",
      "Armários, roupeiros, cómodas e aparadores",
      "Mesas, cadeiras, secretárias e móveis de TV",
      "Frigoríficos, máquinas de lavar e fogões",
      "Recheios completos de apartamentos e moradias",
    ];
  }

  // 30-09-2026: «Equipa preparada», «Agendamento rápido» — promessas de quem
  // executa. O que a plataforma garante é o que está aqui: quem vai, como se
  // combina e quem atende quando alguma coisa corre mal.
  return [
    `${serviceName} feito por profissionais verificados`,
    "Carga e transporte pelo profissional que escolher",
    "Acessos difíceis indicados no pedido entram na proposta",
    "Apoio da CLYON por telefone e WhatsApp",
    "Profissionais da sua zona",
    "Data do trabalho combinada com o profissional",
  ];
}

function getExcludedItems(serviceSlug: string) {
  if (isFurnitureService(serviceSlug)) {
    return [
      "Resíduos perigosos, tintas e químicos",
      "Materiais contaminados ou infestados",
      "Demolição pesada de estruturas fixas",
      "Objetos não validados no orçamento",
    ];
  }

  return [
    "Resíduos perigosos ou químicos",
    "Pedidos fora da área de cobertura confirmada",
    "Intervenções não descritas no orçamento",
    "Serviços que exijam licenças externas não validadas",
  ];
}

function getPricingCopy(serviceName: string, cityName: string, serviceSlug: string) {
  if (isFurnitureService(serviceSlug)) {
    /*
     * Nenhuma destas referências pode abrir abaixo de 40 € nem fechar acima
     * de 120 €: são o interior da faixa publicada em `precos-publicos`. Uma
     * peça anunciada a 25 € numa página que promete 40 – 120 € é a mesma
     * divergência, escrita em letra mais pequena.
     */
    return [
      "Sofá de 2 a 3 lugares: 40 – 70 €",
      "Cama de casal com estrado: 40 – 65 €",
      "Armário grande: 55 – 95 €",
      "Mesa com cadeiras: 40 – 65 €",
      `Recolha de vários móveis em ${cityName}: ${PRECO_MOVEIS}`,
    ];
  }

  return [
    `O valor de ${serviceName.toLowerCase()} em ${cityName} depende do volume e dos acessos.`,
    "Escadas, pouca manobra ou urgência contam no valor — diga-o no pedido para vir na proposta.",
    "Quanto mais claro for o pedido, mais certas são as propostas.",
  ];
}

function getFaqs(serviceName: string, cityName: string, regionLabel: string, serviceSlug: string, citySlug: string, relatedCities: { name: string }[]) {
  // Tentar FAQs únicas do conteúdo prioritário
  const priorityContent = getCityServiceContent(citySlug, serviceSlug);
  if (priorityContent?.faqs && priorityContent.faqs.length > 0) {
    return priorityContent.faqs;
  }
  
  /*
   * Fallback para FAQs genéricas — 30-09-2026.
   *
   * Estas respostas repetem-se em dezenas de páginas e vão também para o
   * FAQPage que o Google lê. Diziam «orçamento imediato» e «conseguimos
   * responder no próprio dia»: o prazo que a plataforma cumpre é o das
   * propostas (PRAZO_DE_RESPOSTA), e a data do trabalho combina-se com o
   * profissional — a CLYON não a pode prometer por ele.
   */
  if (isFurnitureService(serviceSlug)) {
    const baseFaqs = [
      {
        q: `Quanto custa a recolha de móveis em ${cityName}?`,
        a: `O preço depende da quantidade de móveis, acessos, desmontagem e distância. Em ${cityName}, o mais rápido é descrever o pedido com fotos e morada: recebe propostas de profissionais da zona em menos de ${PRAZO_DE_RESPOSTA.porExtenso}, cada uma com o preço fechado.`,
      },
      {
        q: `Recolhem sofás, camas e armários em ${cityName}?`,
        a: `Sim. Os profissionais retiram sofás, colchões, camas, armários, cómodas, mesas, cadeiras e outros volumes grandes, desde que o pedido seja identificado no orçamento.`,
      },
      {
        q: `Também recolhem eletrodomésticos em ${cityName}?`,
        a: `Sim. Frigoríficos, máquinas de lavar, fogões, micro-ondas e equipamentos semelhantes podem ser recolhidos e encaminhados de forma responsável.`,
      },
      {
        q: `Dá para recolher móveis no mesmo dia em ${cityName}?`,
        a: NO_MESMO_DIA,
      },
      {
        q: `Que outras zonas próximas de ${cityName} também atendem?`,
        a: `Além de ${cityName}, pode pedir em ${relatedCities.map((item) => item.name).join(", ")} e noutras zonas de ${regionLabel}: o pedido chega aos profissionais que trabalham nessa zona.`,
      },
    ];

    if (cityName === "Costa da Caparica") {
      baseFaqs.splice(1, 0, {
        q: "Existe recolha gratuita de móveis na Costa da Caparica?",
        // 30-09-2026: a resposta passa a apontar para quem recebe doações —
        // a página /recolha-gratuita-de-moveis-usados — e diz sem rodeios que
        // a CLYON é paga. Antes falava de «cenários» sem dizer nenhum.
        a: "Há duas vias sem custo: a recolha de monos da Câmara de Almada, gratuita, que se agenda com a junta de freguesia e é feita à porta; e a doação de peças em bom estado a instituições que as recebem. A CLYON não faz recolha gratuita: é um serviço pago, para quando é preciso desmontar, carregar de dentro de casa ou libertar o espaço sem esperar.",
      });
    }

    return baseFaqs;
  }

  return [
    {
      q: `Quanto custa ${serviceName.toLowerCase()} em ${cityName}?`,
      a: `O valor depende do volume, acessibilidade, tipologia do serviço e recursos necessários. Descreva o pedido e recebe propostas de profissionais da zona para ${serviceName.toLowerCase()} em ${cityName} em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
    },
    {
      q: `Dá para fazer ${serviceName.toLowerCase()} no mesmo dia em ${cityName}?`,
      a: NO_MESMO_DIA,
    },
    {
      q: `Que zonas próximas de ${cityName} também atendem?`,
      a: `Além de ${cityName}, pode pedir em ${relatedCities.map((item) => item.name).join(", ")} e noutras zonas de ${regionLabel}: o pedido chega aos profissionais que trabalham nessa zona.`,
    },
    {
      q: `Como pedir ${serviceName.toLowerCase()} em ${cityName}?`,
      a: `Basta descrever o pedido no simulador, com fotos, morada, detalhes de acesso e o que pretende. Quanto mais informação der, mais certas são as propostas que recebe.`,
    },
  ];
}

/*
 * As páginas que esta rota gera são exactamente as de `getAllCityServiceSlugs`
 * — que já deixa de fora as mudanças (têm rota própria) e, desde 29-09-2026,
 * as combinações que se juntaram a uma página estática. Com
 * `dynamicParams = false`, o que não está aqui não existe.
 *
 * Havia aqui um filtro a mais para oito `mudancas-<cidade>` "fracas": nunca
 * apanhava nada, porque nenhuma combinação de mudanças chega a esta lista.
 */
export function generateStaticParams() {
  return getAllCityServiceSlugs().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseCityServiceSlug(slug);

  if (!parsed) {
    // Sem « | CLYON»: é o template do layout que o acrescenta (29-09-2026).
    return { title: "Página não encontrada" };
  }

  const { city, service } = parsed;
  const title = tituloDaCidade(service.name, city.name, service.slug, city.slug);
  // Até 155 caracteres, o essencial primeiro e sem cortar palavras: o
  // serviço, a terra, as propostas e o prazo; depois o preço, o que inclui e
  // as freguesias da zona, se couberem (29-09-2026, ver descricoes-seo.ts).
  const description = descricaoDaCidade(service.slug, service.name, city.name, city.slug);
  const canonical = `${SITE_URL}/${getCityServiceSlug(service.slug, city.slug)}`;

  return {
    title,
    description,
    keywords: [
      ...service.keywords,
      `${service.primaryKeyword} ${city.name.toLowerCase()}`,
      `${service.primaryKeyword} ${city.regionLabel.toLowerCase()}`,
      `${service.shortName} ${city.name.toLowerCase()}`,
      isFurnitureService(service.slug) ? "recolha de móveis" : "orçamento recolha",
      isFurnitureService(service.slug) ? "tirar móveis velhos" : "serviço no mesmo dia",
      BUSINESS_NAME,
    ],
    alternates: {
      canonical,
      languages: { "pt-PT": canonical },
    },
    openGraph: og({
      title,
      description,
      url: canonical,
    }),
  };
}

export const revalidate = 86400;
export const dynamicParams = false;

export default async function ServiceCityPage({ params }: Props) {
  const { slug } = await params;
  const parsed = parseCityServiceSlug(slug);

  if (!parsed) {
    notFound();
  }

  const { city, service } = parsed;
  const region = getRegion(city.region);
  const relatedCities = getRelatedCities(city.slug, 4);

  if (!region) {
    notFound();
  }

  const pageUrl = `${SITE_URL}/${getCityServiceSlug(service.slug, city.slug)}`;
  const title = tituloDaCidade(service.name, city.name, service.slug, city.slug);
  const description = descricaoDaCidade(service.slug, service.name, city.name, city.slug);
  const intro = getServiceIntro(service.name, city.name, city.regionLabel, service.slug, city.slug);
  
  // Obter conteúdo prioritário e base
  const priorityContent = getCityServiceContent(city.slug, service.slug);
  const cityBaseContent = getCityBaseContent(city.slug);
  const isPriorityPage = hasPriorityContent(city.slug, service.slug);
  
  // O que só é verdade nesta zona: freguesias, acessos, estacionamento e
  // destino dos resíduos. É isto que distingue esta página das outras 72.
  const local = getCidadeLocal(city.slug);
  const notaServico = local?.porServico?.[service.slug as ServicoSlug] ?? null;

  const includedItems = getIncludedItems(service.name, city.name, service.slug);
  const excludedItems = getExcludedItems(service.slug);
  const pricingCopy = getPricingCopy(service.name, city.name, service.slug);
  /*
   * A RECOLHA DO MUNICÍPIO — 07-10-2026, nas páginas de monos e de entulho.
   * Como se pede, o que leva e quanto custa, com as fontes oficiais; e, a
   * seguir, quando compensa um profissional. Ver `recolha-da-camara.ts`.
   */
  const camara =
    service.slug === "recolha-monos" || service.slug === "recolha-entulho"
      ? recolhaDaCamara(city.slug)
      : null;
  const eEntulho = service.slug === "recolha-entulho";
  const daCamara = camara ? ((eEntulho ? camara.entulho : camara.monos) ?? null) : null;
  const perguntaDaCamara =
    camara && daCamara
      ? {
          q: eEntulho
            ? `A Câmara de ${camara.concelho} recolhe entulho de obras?`
            : `Como funciona a recolha de monos da Câmara de ${camara.concelho}?`,
          a: daCamara.texto,
        }
      : null;

  const faqs = [
    ...getFaqs(
      service.name,
      city.name,
      city.regionLabel,
      service.slug,
      city.slug,
      relatedCities,
    ),
    ...(perguntaDaCamara ? [perguntaDaCamara] : []),
  ];
  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappMessage = `Olá! Preciso de ${service.shortName} em ${city.name}. Podem dar-me um orçamento?`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

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
        name: "Regiões",
        item: `${SITE_URL}/regioes`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: region.name,
        item: `${SITE_URL}/regioes/${region.slug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: `${service.name} em ${city.name}`,
        item: pageUrl,
      },
    ],
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: service.name,
    name: title,
    description,
    /*
     * O prestador é o `LocalBusiness` do layout, por `@id` (29-09-2026). Era
     * um `LocalBusiness` «CLYON» sem morada em cada uma das mais de cem
     * páginas de cidade — outras tantas empresas a meio de declarar, todas
     * com o mesmo telefone.
     * A cidade diz-se no `areaServed` do serviço, logo abaixo.
     */
    provider: PRESTADOR,
    areaServed: [
      {
        "@type": "City",
        name: city.name,
      },
      {
        "@type": "AdministrativeArea",
        name: city.regionLabel,
      },
    ],
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: pageUrl,
    },
  };

  const nearbyLinks = relatedCities.map((relatedCity) => ({
    href: caminhoDoServicoNaCidade(service.slug, relatedCity.slug),
    label: `${service.name} em ${relatedCity.name}`,
  }));
  const isLisbonFurniturePage = isFurnitureService(service.slug) && city.slug === "lisboa";
  const isCascaisFurniturePage = isFurnitureService(service.slug) && city.slug === "cascais";
  const isCostaFurniturePage =
    isFurnitureService(service.slug) && city.slug === "costa-da-caparica";

  // Determinar link para hub de serviço.
  // O do esvaziamento apontava para /esvaziamento-casas, que faz 308 para
  // /esvaziamento-de-casas: todas as páginas de cidade ligavam ao hub pelo
  // redirect. Vai directo desde 29-09-2026.
  const serviceHubMap: Record<string, { href: string; label: string }> = {
    "recolha-moveis": { href: "/recolha-de-moveis", label: "Ver todos os serviços de recolha de móveis" },
    "recolha-entulho": { href: "/recolha-de-entulho", label: "Ver todos os serviços de recolha de entulho" },
    "esvaziamento-casas": { href: "/esvaziamento-de-casas", label: "Ver todos os serviços de esvaziamento" },
  };
  const currentServiceHub = serviceHubMap[service.slug];

  // Definir links de clusters por região
  const clusterLinks: Record<string, Array<{ href: string; label: string }>> = {
    "lisboa": [
      { href: "/recolha-monos-lisboa", label: "Recolha de monos em Lisboa" },
      { href: "/recolha-moveis-lisboa", label: "Recolha de móveis em Lisboa" },
      { href: "/recolha-entulho-lisboa", label: "Recolha de entulho em Lisboa" },
      { href: "/blog/recolha-de-monos-o-que-inclui", label: "Guia: o que inclui a recolha de monos" },
      { href: "/blog/recolha-de-moveis-como-funciona", label: "Guia: como funciona a recolha de móveis" },
      { href: "/contactos", label: "Contactos" },
    ],
    "margem-sul": [
      { href: "/recolha-moveis-almada", label: "Recolha de móveis em Almada" },
      { href: "/recolha-moveis-seixal", label: "Recolha de móveis no Seixal" },
      { href: "/recolha-moveis-setubal", label: "Recolha de móveis em Setúbal" },
      { href: "/recolha-de-moveis", label: "Hub: Recolha de móveis" },
      { href: "/recolha-de-entulho", label: "Hub: Recolha de entulho" },
    ],
    "setubal": [
      { href: "/recolha-moveis-setubal", label: "Recolha de móveis em Setúbal" },
      { href: "/recolha-entulho-setubal", label: "Recolha de entulho em Setúbal" },
      { href: "/recolha-moveis-almada", label: "Recolha de móveis em Almada" },
      { href: "/recolha-de-moveis", label: "Hub: Recolha de móveis" },
      { href: "/blog/recolha-de-entulho-legal-e-organizada", label: "Guia: recolha de entulho" },
    ],
  };

  const supportLinks = isFurnitureService(service.slug)
    ? [
        ...(currentServiceHub ? [currentServiceHub] : []),
        { href: caminhoDoServicoNaCidade("recolha-monos", city.slug), label: `Recolha de monos em ${city.name}` },
        { href: caminhoDoServicoNaCidade("esvaziamento-casas", city.slug), label: `Esvaziamento de casas em ${city.name}` },
        { href: caminhoDoServicoNaCidade("recolha-entulho", city.slug), label: `Recolha de entulho em ${city.name}` },
        ...(city.slug === "costa-da-caparica"
          ? [
              {
                href: "/blog/recolha-gratuita-de-moveis-usados-costa-da-caparica",
                label: "Guia: recolha gratuita de móveis usados na Costa da Caparica",
              },
            ]
          : []),
        // Links do cluster regional
        ...(clusterLinks[city.region] || []).filter(link => !link.href.includes(city.slug)).slice(0, 2),
      ]
    : service.slug === "recolha-monos"
    ? [
        ...(currentServiceHub ? [currentServiceHub] : []),
        { href: caminhoDoServicoNaCidade("recolha-moveis", city.slug), label: `Recolha de móveis em ${city.name}` },
        { href: caminhoDoServicoNaCidade("esvaziamento-casas", city.slug), label: `Esvaziamento de casas em ${city.name}` },
        { href: "/blog/recolha-de-monos-o-que-inclui", label: "Guia: o que inclui a recolha de monos" },
        { href: "/contactos", label: "Contactos" },
        ...(clusterLinks[city.region] || []).filter(link => !link.href.includes(city.slug)).slice(0, 2),
      ]
    : service.slug === "recolha-entulho"
    ? [
        ...(currentServiceHub ? [currentServiceHub] : []),
        { href: caminhoDoServicoNaCidade("esvaziamento-casas", city.slug), label: `Esvaziamento de casas em ${city.name}` },
        { href: caminhoDoServicoNaCidade("recolha-moveis", city.slug), label: `Recolha de móveis em ${city.name}` },
        { href: "/blog/recolha-de-entulho-legal-e-organizada", label: "Guia: recolha de entulho" },
        { href: "/contactos", label: "Contactos" },
        ...(clusterLinks[city.region] || []).filter(link => !link.href.includes(city.slug)).slice(0, 2),
      ]
    : [
        ...(currentServiceHub ? [currentServiceHub] : []),
        { href: "/servicos", label: "Todos os serviços" },
        { href: "/simulador", label: "Pedir orçamento" },
        { href: caminhoDoServicoNaCidade("recolha-moveis", city.slug), label: `Recolha de móveis em ${city.name}` },
        ...(clusterLinks[city.region] || []).filter(link => !link.href.includes(city.slug)).slice(0, 2),
      ];

  return (
    <div className="min-h-screen bg-white">
      <section className="sob-o-menu relative overflow-hidden bg-gradient-to-br from-cyan-100 via-cyan-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.14),_transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div className="max-w-3xl">
              <h1 className="mt-5 max-w-[15ch] text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
                {isFurnitureService(service.slug)
                  ? `Recolha de Móveis em ${city.name}`
                  : `${service.name} em ${city.name}`}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{intro}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/simulador"
                  className="site-btn-primary min-w-[220px] px-6 py-3.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Pedir orçamento
                </Link>
                <Link
                  href={CONTACT_PATH}
                  className="site-btn-secondary min-w-[220px] border-slate-300 text-slate-900 hover:bg-slate-50"
                >
                  <Phone className="h-4 w-4" />
                  Falar connosco
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-cyan-100 bg-white p-6 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.18)]">
              <h2 className="mt-3 text-3xl font-bold text-slate-950">
                O que saber sobre {city.name}
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                {priorityContent?.accessNotes ?? cityBaseContent?.accessNotes ?? `Em ${city.name} e zonas próximas, o pedido chega a profissionais da zona, que respondem com propostas de preço fechado. O profissional que escolher retira os volumes combinados e protege os acessos.`}
              </p>
              {/* Highlight local se for página prioritária */}
              {priorityContent?.neighborhoodHighlight && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                  <strong>Destaque:</strong> {priorityContent.neighborhoodHighlight}
                </p>
              )}
              {cityBaseContent?.landmarks && cityBaseContent.landmarks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {cityBaseContent.landmarks.slice(0, 6).map((landmark) => (
                    <span key={landmark} className="rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
                      {landmark}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/80 p-4">
                  {/* "Tempo médio" admite, sem querer, que metade dos casos é pior do
                      que o número anunciado. Diz-se o que se promete. */}
                  <p className="text-sm font-semibold text-slate-950">Propostas em menos de</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{PRAZO_DE_RESPOSTA.porExtenso}</p>
                </div>
                <div className="rounded-[22px] border border-cyan-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Área servida</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {city.name} e {relatedCities.map((item) => item.name).join(", ")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* 30-09-2026: os três cartões falavam por uma equipa da CLYON
              («A equipa trata de carregar», «Confirmamos volume»). Quem
              carrega é o profissional; o que a plataforma faz é pôr tudo
              combinado por escrito antes de ele sair de casa. */}
          {[
            {
              icon: Clock3,
              title: `Propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`,
              desc: `Descreve o pedido de ${service.shortName} em ${city.name} e os profissionais da zona respondem com o preço fechado.`,
            },
            {
              icon: Truck,
              title: "Quem faz é o profissional",
              desc: "O profissional que escolher carrega, transporta e leva o que sai para destino licenciado.",
            },
            {
              icon: ShieldCheck,
              title: "Tudo combinado antes",
              desc: "Volume, acessos, data e preço ficam acordados na plataforma antes de o trabalho começar.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.18)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-acao">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              O que pode pedir em {city.name}
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {includedItems.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-7 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-[#F4F8FB] p-7">
            <h2 className="mt-3 text-3xl font-bold text-tinta">O que não entra neste serviço</h2>
            <div className="mt-6 space-y-3">
              {excludedItems.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-[#E2EEF3] bg-white px-4 py-4 text-sm font-medium text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── O que só é verdade nesta zona ──────────────────────────────
            Sem isto, esta página era o mesmo texto de outras 72 com o nome
            da terra trocado — e o Google tratava-a como tal. */}
        {local && (
          <div className="mt-8 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <h2 className="text-3xl font-bold text-slate-950">
              {service.shortName} em {city.name}: o que muda por ser aqui
            </h2>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* 30-09-2026: dizia «Da nossa base em Fernão Ferro são cerca de
                  X km». A CLYON não parte de base nenhuma para ir a casa do
                  cliente — quem vai é um profissional da zona, a partir da
                  base DELE — e as distâncias nem batiam certo entre páginas
                  (Montijo a 6 e a 16 km). Ver a-base-nao-e-da-clyon.test.ts. */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-acao">
                  Onde há profissionais
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Pode pedir em {local.zonas.slice(0, -1).join(", ")} e {local.zonas[local.zonas.length - 1]}.
                  O pedido chega aos profissionais da sua zona, e quem vai é o que escolher.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-acao">
                  Acessos
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{local.acesso}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-acao">
                  Estacionamento
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{local.estacionamento}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-acao">
                  Para onde vai
                </h3>
                {/* 30-09-2026: «Entregamos o comprovativo de destino sempre que o
                    pedir» era uma promessa sem nada por trás — não há campo nem
                    passo nenhum na plataforma que o garanta. Quem o pode emitir
                    é o profissional, e isso diz-se na proposta. */}
                {/* 07-10-2026: nas páginas de entulho dizia que ia para o
                    ecocentro — e os da Valorsul e da Amarsul não recebem
                    entulho. Quem o leva por profissão entrega-o a um operador
                    licenciado. */}
                {eEntulho ? (
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    O entulho que sai em {city.name} vai para um operador licenciado de
                    resíduos de construção e demolição. Se precisar de comprovativo de
                    destino — numa obra, por exemplo —, indique-o no pedido: o profissional
                    diz na proposta se o emite.
                  </p>
                ) : (
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  O que sai em {city.name} vai para o{" "}
                  <span className="font-semibold text-slate-800">{local.destinoResiduos.nome}</span>{" "}
                  ({local.destinoResiduos.entidade}) ou para operador licenciado, conforme o tipo de
                  resíduo. Se precisar de comprovativo de destino — numa obra, por exemplo —, indique-o
                  no pedido: o profissional diz na proposta se o emite.
                </p>
                )}
              </div>
            </div>

            {notaServico && (
              <div className="mt-6 rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-5">
                <p className="text-sm leading-7 text-slate-700">{notaServico}</p>
              </div>
            )}
          </div>
        )}

        {/* ── A recolha do município — 07-10-2026 ──────────────────────────
            O título promete a alternativa à câmara; isto diz o que a câmara
            faz, com a fonte, e quando compensa um profissional. Só aparece
            onde há fonte oficial confirmada (`recolha-da-camara.ts`). */}
        {camara && daCamara && (
          <div className="mt-8 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <h2 className="text-3xl font-bold text-slate-950">
              {eEntulho
                ? `O entulho de pequenas obras e a Câmara de ${camara.concelho}`
                : `A recolha de monos da Câmara de ${camara.concelho}`}
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">{daCamara.texto}</p>
            <p className="mt-4 rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-5 text-sm leading-7 text-slate-700">
              {eEntulho
                ? "Quando compensa pedir a um profissional: quando há mais entulho do que o serviço municipal leva, quando ainda está por ensacar ou por descer de um andar sem elevador, ou quando tem de sair num dia certo."
                : "Quando compensa pedir a um profissional: quando os monos estão dentro de casa ou num andar sem elevador — o serviço municipal recolhe no local combinado, e levá-los até lá é consigo —, quando precisa de um dia e de uma hora certos, ou quando é preciso desmontar antes."}
            </p>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              Fontes:{" "}
              {daCamara.fontes
                .filter((f, i, todas) => todas.findIndex((x) => x.nome === f.nome) === i)
                .map((f, i) => (
                  <span key={f.url}>
                    {i > 0 && " · "}
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-acao underline-offset-2 hover:underline">
                      {f.nome}
                    </a>
                  </span>
                ))}
              {" "}— lidas a {CONSULTADAS_EM.split("-").reverse().join("-")}. Os serviços municipais mudam:
              confirme os contactos antes de marcar.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Referências úteis para {city.name}
            </h2>
            <div className="mt-5 space-y-3">
              {pricingCopy.map((item) => (
                <div key={item} className="rounded-[22px] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-950">{item}</p>
                </div>
              ))}
            </div>
            {isFurnitureService(service.slug) && (
              <p className="mt-4 text-xs leading-6 text-slate-500">{NOTA_DE_PRECO.curta}</p>
            )}
          </div>

          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Da marcação à retirada final, sem complicações
            </h2>
            <div className="mt-6 space-y-5">
              {/* 30-09-2026: «A equipa chega» e «segue para triagem, doação»
                  — a CLYON não tem equipa, nem nenhum circuito de doação que
                  se possa prometer. Ficam os passos que a plataforma cumpre. */}
              {[
                "Descreva o pedido com fotos, morada e detalhes de acesso.",
                `Receba propostas de profissionais da zona em menos de ${PRAZO_DE_RESPOSTA.porExtenso} e escolha a que preferir.`,
                "O profissional chega na data combinada, protege o acesso, carrega e transporta.",
                "O que sai vai para ecocentro ou operador licenciado.",
              ].map((step, index) => (
                <div key={step} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acao text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-7 text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Um serviço pensado para resolver de forma rápida e segura
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Se precisa de retirar volumes, libertar espaço e evitar o esforço de
              carregar, desmontar e transportar sozinho, esta é a solução mais
              simples. O profissional organiza a recolha, trata do acesso e dá o
              destino licenciado para o que sai do imóvel.
            </p>
            {/* 30-09-2026: falava do «cliente» na terceira pessoa, como uma
                nota interna. Passa a dizer ao leitor as alternativas que
                existem — incluindo a de não pagar nada, quando os móveis
                ainda servem a alguém. */}
            {isFurnitureService(service.slug) && (
              <div className="mt-5 rounded-[22px] border border-cyan-100 bg-cyan-50/80 p-5">
                <div className="flex items-start gap-3">
                  <Recycle className="mt-1 h-5 w-5 text-acao" />
                  <p className="text-sm leading-7 text-slate-700">
                    A recolha de monos da câmara ou da junta de freguesia é gratuita
                    em muitos concelhos, mas marca-se com antecedência e os móveis
                    ficam à porta ou no local combinado. Pela CLYON, o profissional
                    vai buscá-los dentro de casa, desmonta se o pedir e leva tudo —
                    é um serviço pago. Se os móveis ainda estão em
                    bom estado,{" "}
                    <Link
                      href="/recolha-gratuita-de-moveis-usados"
                      className="font-semibold text-acao underline-offset-2 hover:underline"
                    >
                      veja quem os recebe de graça
                    </Link>
                    .
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Apoio adicional para pedidos maiores ou mistos
            </h2>
            <div className="mt-6 space-y-3">
              {[...supportLinks, ...nearbyLinks].slice(0, 6).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-medium shadow-sm transition hover:border-cyan-300 hover:shadow-md"
                  style={{ color: '#1e293b' }}
                >
                  <span style={{ color: '#1e293b' }}>{item.label}</span>
                  <ArrowRight className="h-4 w-4 text-acao" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {isLisbonFurniturePage && (
          <div className="mt-8 rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
            {/* 30-09-2026: o texto era uma nota de SEO publicada («esta
                pesquisa mistura…», «a parte comercial da intenção»). Fica o
                que o leitor precisa de saber para escolher. */}
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Recolha de móveis em Lisboa, bairro a bairro
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              Em Lisboa há três caminhos para móveis usados: a recolha de monos da Câmara, a
              doação de peças em bom estado e a recolha paga. Pela CLYON, um profissional
              verificado retira sofás, camas, colchões, armários e eletrodomésticos de dentro de
              casa, desmonta se o pedir e leva tudo, com o preço fechado antes de começar.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { slug: "benfica", label: "Recolha de móveis em Benfica" },
                { slug: "lumiar", label: "Recolha de móveis no Lumiar" },
                { slug: "alvalade", label: "Recolha de móveis em Alvalade" },
                { slug: "olivais", label: "Recolha de móveis nos Olivais" },
              ].map((item) => (
                <Link
                  key={item.slug}
                  href={caminhoDoServicoNaCidade("recolha-moveis", item.slug)}
                  className="rounded-[22px] border border-cyan-100 bg-white px-4 py-4 text-sm font-medium text-slate-800 transition hover:bg-cyan-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {isCascaisFurniturePage && (
          <div className="mt-8 rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
            {/* 30-09-2026: «Esta página precisa de deixar clara a intenção
                comercial» era uma instrução de SEO publicada tal e qual.
                Passa a descrever o que é diferente em Cascais. */}
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Recolha de móveis em Cascais e na linha
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              Em Cascais há muitas moradias com escadas exteriores e jardim, e condomínios onde
              a entrada se combina com a portaria. Pela CLYON, o profissional retira sofás, camas,
              colchões, armários, eletrodomésticos e recheios, carrega e transporta — e o preço
              fica fechado na proposta antes de começar.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { slug: "oeiras", label: "Recolha de móveis em Oeiras" },
                { slug: "sintra", label: "Recolha de móveis em Sintra" },
                { slug: "carnaxide", label: "Recolha de móveis em Carnaxide" },
                { slug: "amadora", label: "Recolha de móveis na Amadora" },
              ].map((item) => (
                <Link
                  key={item.slug}
                  href={caminhoDoServicoNaCidade("recolha-moveis", item.slug)}
                  className="rounded-[22px] border border-cyan-100 bg-white px-4 py-4 text-sm font-medium text-slate-800 transition hover:bg-cyan-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {isCostaFurniturePage && (
          <div className="mt-8 rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
            {/* 30-09-2026: falava do «utilizador» e de como a CLYON «se
                posiciona» — linguagem de plano de marketing. O leitor quer
                saber se há forma de não pagar, e a resposta honesta é que há:
                a página de doação diz quem recebe os móveis. */}
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Recolha gratuita de móveis na Costa da Caparica: o que existe
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              Móveis em bom estado podem ser doados a quem os aproveite, e a Câmara de Almada recolhe
              monos gratuitamente à porta, com marcação na junta de freguesia. A CLYON não faz recolha gratuita: é um serviço pago,
              para quando é preciso desmontar, carregar de dentro de casa ou libertar o espaço sem
              esperar.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/recolha-gratuita-de-moveis-usados"
                className="site-btn-secondary min-w-[260px] border-slate-300 text-slate-900 hover:bg-white"
              >
                Onde doar móveis usados
              </Link>
              <Link
                href="/simulador"
                className="site-btn-primary min-w-[220px] px-6 py-3.5"
              >
                Pedir orçamento privado
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-[22px] bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-950">{faq.q}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Links internos SEO para páginas de recolha de móveis */}
        {isFurnitureService(service.slug) && (
          <div className="mt-8">
            <FurnitureSeoLinks 
              currentPage={`/${getCityServiceSlug(service.slug, city.slug)}`}
              variant="grid"
            />
          </div>
        )}

        <div className="mt-8 rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
          <div className="flex items-start gap-3">
            <Star className="mt-1 h-5 w-5 text-acao" />
            <div>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">
                Precisa de {service.shortName} em {city.name}?
              </h2>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            Diga o que pretende retirar, quantos volumes tem e como é o acesso ao
            imóvel. Com essa informação, os profissionais da zona respondem com
            propostas mais certas — e a data combina-se com quem escolher.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {AVALIACOES_TOTAL} avaliações 5 estrelas no Google e na Fixando. Propostas em menos de {PRAZO_DE_RESPOSTA.porExtenso}.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contactos"
              className="site-btn-primary min-w-[220px] px-6 py-3.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Pedir Orçamento Grátis
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_-22px_rgba(37,211,102,0.75)] transition hover:-translate-y-0.5 hover:bg-emerald-400"
            >
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/*
        OS PROFISSIONAIS DESTA CIDADE.

        É o link que faltava às páginas deles: estas páginas de cidade já estão
        indexadas e já recebem visitas, e é daqui que a autoridade passa. Só
        aparece se houver mesmo alguém a trabalhar nesta zona — «Profissionais
        em Almada» com uma empresa de Setúbal é pior do que não haver secção.
      */}
      <ProfissionaisComPagina
        cidade={city.name}
        titulo={`Profissionais que trabalham em ${city.name}`}
        descricao={`Quem faz o trabalho são eles. A CLYON recebe o seu pedido e liga-o a profissionais independentes com actividade em ${city.name} — veja a nota de cada um antes de escolher.`}
        fundo="bg-[#F4F8FB]"
        limite={6}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(serviceSchema) }}
      />
    </div>
  );
}
