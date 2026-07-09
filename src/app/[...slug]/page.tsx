import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  Recycle,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/Breadcrumb";
import FurnitureSeoLinks from "@/components/FurnitureSeoLinks";
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
} from "@/lib/seo-data";

type Props = {
  params: Promise<{ slug: string[] }>;
};

function isFurnitureService(serviceSlug: string) {
  return serviceSlug === "recolha-moveis";
}

function buildTitle(serviceName: string, cityName: string, serviceSlug: string, citySlug: string) {
  // Páginas de high-priority com titles mais comerciais e específicas
  // NOTA: Não incluir "| CLYON" aqui - o template do layout já adiciona
  if (isFurnitureService(serviceSlug)) {
    if (citySlug === "lisboa") {
      return `Recolha de Móveis em Lisboa — Sofás, Camas, Eletrodomésticos`;
    }
    if (citySlug === "setubal") {
      return `Recolha de Móveis em Setúbal — Preços Competitivos`;
    }
    if (citySlug === "almada") {
      return `Recolha de Móveis em Almada — Resposta Rápida`;
    }
    return `Recolha de Móveis em ${cityName} — Orçamento Grátis`;
  }

  if (serviceSlug === "recolha-entulho") {
    if (citySlug === "setubal") {
      return `Recolha de Entulho em Setúbal — Resposta em 24h`;
    }
    return `Recolha de Entulho em ${cityName} — Orçamento Grátis`;
  }

  return `${serviceName} em ${cityName} — Orçamento Grátis`;
}

function buildDescription(
  serviceName: string,
  cityName: string,
  regionLabel: string,
  serviceSlug: string,
  citySlug: string,
) {
  if (isFurnitureService(serviceSlug)) {
    if (citySlug === "lisboa") {
      return `Recolha de móveis em Lisboa: sofás, camas, armários, eletrodomésticos. Desmontagem, carga, transporte. Resposta rápida em 24h. 163 reviews 5⭐. Orçamento grátis!`;
    }
    if (citySlug === "setubal") {
      return `Recolha de móveis em Setúbal com preços mais competitivos — somos vizinhos! Sofás, camas, eletrodomésticos. Resposta em 24h. Orçamento grátis.`;
    }
    if (citySlug === "almada") {
      return `Recolha de móveis em Almada e zona de Caparica. Sofás, camas, armários, eletrodomésticos. Resposta rápida em 24h. Orçamento grátis!`;
    }
    return `Recolha de móveis em ${cityName}, ${regionLabel}. Desmontagem e transporte. Resposta rápida em 24h, 163 reviews 5⭐. Orçamento grátis!`;
  }

  if (serviceSlug === "recolha-entulho") {
    if (citySlug === "setubal") {
      return `Recolha de entulho em Setúbal: carregamento directo, resposta em 24h. Orçamento grátis!`;
    }
    return `Recolha de entulho em ${cityName}, ${regionLabel}. Carregamento directo, sacos big bag, limpeza fina. Resposta em 24h. Orçamento grátis!`;
  }

  return `${serviceName} em ${cityName}, ${regionLabel}. Resposta rápida em 24h, 32 reviews 5⭐. Orçamento grátis!`;
}

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
      return `${cityContent.localIntro} Retiramos sofás, camas, armários, mesas, colchões e eletrodomésticos com desmontagem quando necessária.`;
    }
    return `${cityContent.localIntro} ${serviceName} com resposta rápida e orçamento claro.`;
  }

  // Fallback genérico
  if (isFurnitureService(serviceSlug)) {
    return `Fazemos recolha de móveis em ${cityName} para apartamentos, moradias, lojas e escritórios. Retiramos sofás, camas, armários, mesas, colchões e eletrodomésticos com desmontagem quando necessária, carregamento porta a porta e encaminhamento responsável em ${regionLabel}.`;
  }

  return `${serviceName} em ${cityName} com resposta rápida, orçamento claro e execução cuidada. Trabalhamos em contexto residencial e comercial, com apoio local em ${regionLabel}.`;
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

  return [
    `${serviceName} com triagem e planeamento prévio`,
    "Carga e transporte profissional",
    "Equipa preparada para acessos difíceis",
    "Apoio por telefone e contacto direto",
    "Cobertura local e regional",
    "Agendamento rápido conforme disponibilidade",
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
    return [
      "Sofá de 2 a 3 lugares: 35 € a 55 €",
      "Cama de casal com estrado: 25 € a 45 €",
      "Armário grande: 45 € a 75 €",
      "Mesa com cadeiras: 35 € a 55 €",
      `Recolha de vários móveis em ${cityName}: 180 € a 350 €`,
    ];
  }

  return [
    `O valor de ${serviceName.toLowerCase()} em ${cityName} depende do volume e dos acessos.`,
    "Pedidos com escadas, pouca manobra ou urgência podem alterar o valor final.",
    "Quanto mais claro for o pedido, mais preciso será o orçamento.",
  ];
}

function getFaqs(serviceName: string, cityName: string, regionLabel: string, serviceSlug: string, citySlug: string, relatedCities: { name: string }[]) {
  // Tentar FAQs únicas do conteúdo prioritário
  const priorityContent = getCityServiceContent(citySlug, serviceSlug);
  if (priorityContent?.faqs && priorityContent.faqs.length > 0) {
    return priorityContent.faqs;
  }
  
  // Fallback para FAQs genéricas
  if (isFurnitureService(serviceSlug)) {
    const baseFaqs = [
      {
        q: `Quanto custa a recolha de móveis em ${cityName}?`,
        a: `O preço depende da quantidade de móveis, acessos, desmontagem e distância. Em ${cityName}, o mais rápido é enviar fotos e morada para receber um orçamento imediato e ajustado ao pedido.`,
      },
      {
        q: `Recolhem sofás, camas e armários em ${cityName}?`,
        a: `Sim. Retiramos sofás, colchões, camas, armários, cómodas, mesas, cadeiras e outros volumes grandes, desde que o pedido seja identificado no orçamento.`,
      },
      {
        q: `Também recolhem eletrodomésticos em ${cityName}?`,
        a: `Sim. Frigoríficos, máquinas de lavar, fogões, micro-ondas e equipamentos semelhantes podem ser recolhidos e encaminhados de forma responsável.`,
      },
      {
        q: `A CLYON faz recolha de móveis no mesmo dia em ${cityName}?`,
        a: `Quando existe disponibilidade operacional, sim. Em ${cityName} conseguimos muitas vezes responder no próprio dia ou no dia seguinte.`,
      },
      {
        q: `Que outrás zonas próximas de ${cityName} também atendem?`,
        a: `Além de ${cityName}, a CLYON trabalha regularmente em ${relatedCities.map((item) => item.name).join(", ")} e noutrás zonas da ${regionLabel}.`,
      },
    ];

    if (cityName === "Costa da Caparica") {
      baseFaqs.splice(1, 0, {
        q: "Existe recolha gratuita de móveis na Costa da Caparica?",
        a: "Existem cenários em que doação, reaproveitamento ou recolha municipal podem fazer sentido para móveis usados em bom estado. A CLYON opera como serviço privado: entra quando o cliente precisa de rapidez, desmontagem, carregamento no local e solução completa para o que não consegue resolver por vias gratuitas.",
      });
    }

    return baseFaqs;
  }

  return [
    {
      q: `Quanto custa ${serviceName.toLowerCase()} em ${cityName}?`,
      a: `O valor depende do volume, acessibilidade, tipologia do serviço e recursos necessários. A CLYON responde com orçamento rápido para ${serviceName.toLowerCase()} em ${cityName}.`,
    },
    {
      q: `A CLYON faz ${serviceName.toLowerCase()} no mesmo dia em ${cityName}?`,
      a: `Em muitos pedidos conseguimos responder e agendar no mesmo dia em ${cityName}, especialmente quando o acesso e o volume são claros desde o primeiro contacto.`,
    },
    {
      q: `Que zonas próximas de ${cityName} também atendem?`,
      a: `Além de ${cityName}, a CLYON trabalha regularmente em ${relatedCities.map((item) => item.name).join(", ")} e noutrás zonas da ${regionLabel}.`,
    },
    {
      q: `Como pedir ${serviceName.toLowerCase()} em ${cityName}?`,
      a: `Basta enviar fotos, morada, detalhes de acesso e objetivo do serviço. Quanto mais informação recebermos, mais rápido conseguimos fechar orçamento e disponibilidade.`,
    },
  ];
}

export function generateStaticParams() {
  const weakMudancasUrls = ["alcochete", "sintra", "montijo", "carnaxide", "oeiras", "corroios", "barreiro", "palmela"];
  
  return getAllCityServiceSlugs()
    .filter((item) => {
      // Excluir URLs fracas de mudanças (não têm conteúdo prioritário)
      const slugString = item.slug.join("/");
      if (slugString.startsWith("mudancas-") && weakMudancasUrls.some((city) => slugString === `mudancas-${city}`)) {
        return false;
      }
      return true;
    })
    .map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseCityServiceSlug(slug);

  if (!parsed) {
    return { title: "Página não encontrada | CLYON" };
  }

  const { city, service } = parsed;
  const title = buildTitle(service.name, city.name, service.slug, city.slug);
  const description = buildDescription(
    service.name,
    city.name,
    city.regionLabel,
    service.slug,
    city.slug,
  );
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
    openGraph: {
      title,
      description,
      url: canonical,
      locale: "pt_PT",
      type: "article",
    },
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
  const title = buildTitle(service.name, city.name, service.slug, city.slug);
  const description = buildDescription(
    service.name,
    city.name,
    city.regionLabel,
    service.slug,
    city.slug,
  );
  const intro = getServiceIntro(service.name, city.name, city.regionLabel, service.slug, city.slug);
  
  // Obter conteúdo prioritário e base
  const priorityContent = getCityServiceContent(city.slug, service.slug);
  const cityBaseContent = getCityBaseContent(city.slug);
  const isPriorityPage = hasPriorityContent(city.slug, service.slug);
  
  const includedItems = getIncludedItems(service.name, city.name, service.slug);
  const excludedItems = getExcludedItems(service.slug);
  const pricingCopy = getPricingCopy(service.name, city.name, service.slug);
  const faqs = getFaqs(
    service.name,
    city.name,
    city.regionLabel,
    service.slug,
    city.slug,
    relatedCities,
  );
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
    provider: {
      "@type": "LocalBusiness",
      name: BUSINESS_NAME,
      telephone: BUSINESS_PHONE,
      areaServed: {
        "@type": "City",
        name: city.name,
      },
    },
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
    href: `/${getCityServiceSlug(service.slug, relatedCity.slug)}`,
    label: `${service.name} em ${relatedCity.name}`,
  }));
  const isLisbonFurniturePage = isFurnitureService(service.slug) && city.slug === "lisboa";
  const isCascaisFurniturePage = isFurnitureService(service.slug) && city.slug === "cascais";
  const isCostaFurniturePage =
    isFurnitureService(service.slug) && city.slug === "costa-da-caparica";

  // Determinar link para hub de serviço
  const serviceHubMap: Record<string, { href: string; label: string }> = {
    "recolha-moveis": { href: "/recolha-de-moveis", label: "Ver todos os serviços de recolha de móveis" },
    "recolha-entulho": { href: "/recolha-de-entulho", label: "Ver todos os serviços de recolha de entulho" },
    "esvaziamento-casas": { href: "/esvaziamento-casas", label: "Ver todos os serviços de esvaziamento" },
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
        { href: `/${getCityServiceSlug("recolha-monos", city.slug)}`, label: `Recolha de monos em ${city.name}` },
        { href: `/${getCityServiceSlug("esvaziamento-casas", city.slug)}`, label: `Esvaziamento de casas em ${city.name}` },
        { href: `/${getCityServiceSlug("recolha-entulho", city.slug)}`, label: `Recolha de entulho em ${city.name}` },
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
        { href: `/${getCityServiceSlug("recolha-moveis", city.slug)}`, label: `Recolha de móveis em ${city.name}` },
        { href: `/${getCityServiceSlug("esvaziamento-casas", city.slug)}`, label: `Esvaziamento de casas em ${city.name}` },
        { href: "/blog/recolha-de-monos-o-que-inclui", label: "Guia: o que inclui a recolha de monos" },
        { href: "/contactos", label: "Contactos" },
        ...(clusterLinks[city.region] || []).filter(link => !link.href.includes(city.slug)).slice(0, 2),
      ]
    : service.slug === "recolha-entulho"
    ? [
        ...(currentServiceHub ? [currentServiceHub] : []),
        { href: `/${getCityServiceSlug("esvaziamento-casas", city.slug)}`, label: `Esvaziamento de casas em ${city.name}` },
        { href: `/${getCityServiceSlug("recolha-moveis", city.slug)}`, label: `Recolha de móveis em ${city.name}` },
        { href: "/blog/recolha-de-entulho-legal-e-organizada", label: "Guia: recolha de entulho" },
        { href: "/contactos", label: "Contactos" },
        ...(clusterLinks[city.region] || []).filter(link => !link.href.includes(city.slug)).slice(0, 2),
      ]
    : [
        ...(currentServiceHub ? [currentServiceHub] : []),
        { href: "/servicos", label: "Todos os serviços" },
        { href: "/simulador", label: "Pedir orçamento" },
        { href: `/${getCityServiceSlug("recolha-moveis", city.slug)}`, label: `Recolha de móveis em ${city.name}` },
        ...(clusterLinks[city.region] || []).filter(link => !link.href.includes(city.slug)).slice(0, 2),
      ];

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-cyan-100 via-cyan-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.14),_transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
          <Breadcrumb
            items={[
              { label: "Regiões", href: "/regioes" },
              { label: region.name, href: `/regioes/${region.slug}` },
              { label: `${service.shortName} em ${city.name}` },
            ]}
            className="mb-6"
          />
          <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
                <MapPin className="h-4 w-4" />
                {city.name}, {city.regionLabel}
              </div>
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Cobertura local
              </p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">
                Resposta reforçada em {city.name}
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                {priorityContent?.accessNotes ?? cityBaseContent?.accessNotes ?? `Trabalhamos em ${city.name} e zonas próximas com resposta rápida, orçamento claro e recolha cuidada. Retiramos os volumes validados, protegemos os acessos e deixamos o espaço pronto para a etapa seguinte.`}
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
                  <p className="text-sm font-semibold text-slate-950">Tempo médio</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">11 minutos</p>
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
          {[
            {
              icon: Clock3,
              title: "Orçamento rápido",
              desc: `Triagem rápida para ${service.shortName} em ${city.name} com resposta prática e comercial.`,
            },
            {
              icon: Truck,
              title: "Execução completa",
              desc: "A equipa trata de carregar, transportar e fechar o serviço com clareza.",
            },
            {
              icon: ShieldCheck,
              title: "Processo seguro",
              desc: "Confirmamos volume, acessos, horários e encaminhamento antes da marcação.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(14,116,144,0.18)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              O que está incluído
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Serviço completo para recolha em {city.name}
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

          <div className="rounded-[30px] border border-cyan-100 bg-slate-950 p-7 text-white shadow-[0_24px_60px_-34px_rgba(2,6,23,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
              O que não entra
            </p>
            <h2 className="mt-3 text-3xl font-bold">Evita ruído no orçamento</h2>
            <div className="mt-6 space-y-3">
              {excludedItems.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-slate-100"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Preços orientativos
            </p>
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
          </div>

          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Como funciona
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Da marcação à retirada final, sem complicações
            </h2>
            <div className="mt-6 space-y-5">
              {[
                "Envie fotos, morada e detalhes de acesso.",
                "Receba um orçamento rápido e confirme a melhor janela disponível.",
                "A equipa chega, protege o acesso, carrega e trata do transporte.",
                "O material segue para triagem, doação ou descarte responsável.",
              ].map((step, index) => (
                <div key={step} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-sm font-bold text-white">
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Porque a CLYON em {city.name}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Um serviço pensado para resolver de forma rápida e segura
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Se precisa de retirar volumes, libertar espaço e evitar o esforço de
              carregar, desmontar e transportar sozinho, esta é a solução mais
              simples. A nossa equipa organiza a recolha, trata do acesso e dá o
              encaminhamento adequado ao que sai do imóvel.
            </p>
            {isFurnitureService(service.slug) && (
              <div className="mt-5 rounded-[22px] border border-cyan-100 bg-cyan-50/80 p-5">
                <div className="flex items-start gap-3">
                  <Recycle className="mt-1 h-5 w-5 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-700">
                    Se o cliente em {city.name} estiver a comparar com recolha
                    municipal, a vantagem da CLYON está na rapidez, desmontagem,
                    carregamento completo e resolução total dentro do imóvel.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-cyan-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(14,116,144,0.14)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Serviços relacionados
            </p>
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
                  <ArrowRight className="h-4 w-4 text-cyan-600" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {isLisbonFurniturePage && (
          <div className="mt-8 rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Intenção local em Lisboa
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Recolha de móveis em Lisboa para quem precisa de uma solução privada, rápida e completa
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              Em Lisboa, esta pesquisa mistura recolha municipal, doação e serviços privados.
              A CLYON responde à parte comercial da intenção: desmontagem, carregamento dentro do
              imóvel, retirada de sofás, camas, colchões, armários e eletrodomésticos, com
              agendamento rápido e execução completa no local.
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
                  href={`/${getCityServiceSlug("recolha-moveis", item.slug)}`}
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Intenção local em Cascais
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Recolha de móveis em Cascais para quem procura uma recolha privada e completa
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              Em Cascais, o Google mostra muitos resultados informativos, municipais e de doação.
              Esta página precisa de deixar clara a intenção comercial: recolha privada de sofás,
              camas, colchões, armários, eletrodomésticos e recheios, com carregamento no local,
              transporte e resposta rápida.
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
                  href={`/${getCityServiceSlug("recolha-moveis", item.slug)}`}
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Intenção informativa e comercial
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Na Costa da Caparica, a pesquisa por "recolha gratuita de móveis" mistura doação, câmara e serviço privado
            </h2>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              Quando o utilizador escreve "gratuita", muitas vezes ainda está a tentar perceber
              se os móveis usados podem ser doados, reaproveitados ou recolhidos por via municipal.
              A CLYON não se posiciona como recolha gratuita: posiciona-se como solução privada para
              os casos em que é preciso desmontar, carregar, retirar de dentro do imóvel e libertar
              o espaço com rapidez.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/blog/recolha-gratuita-de-moveis-usados-costa-da-caparica"
                className="site-btn-secondary min-w-[260px] border-slate-300 text-slate-900 hover:bg-white"
              >
                Ler guia sobre recolha gratuita
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Perguntas frequentes locais
          </p>
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
            <Star className="mt-1 h-5 w-5 text-cyan-600" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                CTA local
              </p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">
                Precisa de {service.shortName} em {city.name}?
              </h2>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            Diga-nos o que pretende retirar, quantos volumes tem e como é o acesso ao
            imovel. Com essa informacao conseguimos responder mais depressa e marcar
            a recolha com maior precisao.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            163 avaliacoes 5 estrelas no Fixando. Tempo medio de resposta: 11 minutos.
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
    </div>
  );
}
