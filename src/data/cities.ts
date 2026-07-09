export interface CityData {
  slug: string;
  name: string;
  region: string;
}

export interface ServiceData {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  keywords: string[];
}

export const CITIES: CityData[] = [
  { slug: "lisboa", name: "Lisboa", region: "Lisboa" },
  { slug: "setubal", name: "Setúbal", region: "Setúbal" },
  { slug: "almada", name: "Almada", region: "Setúbal" },
  { slug: "cascais", name: "Cascais", region: "Lisboa" },
  { slug: "sintra", name: "Sintra", region: "Lisboa" },
  { slug: "oeiras", name: "Oeiras", region: "Lisboa" },
  { slug: "amadora", name: "Amadora", region: "Lisboa" },
  { slug: "loures", name: "Loures", region: "Lisboa" },
  { slug: "odivelas", name: "Odivelas", region: "Lisboa" },
  { slug: "seixal", name: "Seixal", region: "Setúbal" },
  { slug: "barreiro", name: "Barreiro", region: "Setúbal" },
  { slug: "moita", name: "Moita", region: "Setúbal" },
  { slug: "montijo", name: "Montijo", region: "Setúbal" },
  { slug: "palmela", name: "Palmela", region: "Setúbal" },
  { slug: "sesimbra", name: "Sesimbra", region: "Setúbal" },
  { slug: "alcochete", name: "Alcochete", region: "Setúbal" },
  { slug: "amora", name: "Amora", region: "Setúbal" },
  { slug: "corroios", name: "Corroios", region: "Setúbal" },
  { slug: "carnaxide", name: "Carnaxide", region: "Lisboa" },
  { slug: "costa-da-caparica", name: "Costa da Caparica", region: "Setúbal" },
];

export const SERVICES: ServiceData[] = [
  {
    slug: "recolha-moveis",
    name: "Recolha de Móveis",
    description: "Recolha segura e rápida de móveis velhos, danificados ou indesejados.",
    longDescription:
      "A CLYON oferece um serviço profissional de recolha de móveis em toda a região de Lisboa e Setúbal. Retiramos sofás, camas, armários, mesas, cadeiras e qualquer outro tipo de mobiliário. Transporte direto para reciclagem ou doação.",
    keywords: ["recolha de móveis", "remoção de móveis", "retirar móveis velhos", "transporte de móveis"],
  },
  {
    slug: "recolha-entulho",
    name: "Recolha de Entulho",
    description: "Remoção rápida e organizada de entulho de obras, remodelações e construções.",
    longDescription:
      "Serviço especializado em recolha de entulho de obras, remodelações e demolições. A CLYON remove todo o tipo de resíduos de construção: tijolos, cimento, azulejos, madeiras e outros materiais. Transporte e disposição adequada em centros de reciclagem certificados.",
    keywords: ["recolha de entulho", "remoção de entulho", "limpeza de obra", "entulho de construção"],
  },
  {
    slug: "recolha-monos",
    name: "Recolha de Monos",
    description: "Recolha profissional de monos, sucata e materiais diversos.",
    longDescription:
      "A CLYON realiza a recolha de monos e objetos volumosos que já não são necessários. Eletrodomésticos, equipamentos velhos, sucata e outros materiais são recolhidos de forma rápida e responsável. Limpeza completa do espaço após a recolha.",
    keywords: ["recolha de monos", "remoção de monos", "retirar objetos velhos", "sucata"],
  },
  {
    slug: "esvaziamento-casas",
    name: "Esvaziamento de Casas",
    description: "Esvaziamento completo de casas, apartamentos e escritórios.",
    longDescription:
      "Serviço completo de esvaziamento de imóveis. A CLYON trata de tudo: móveis, eletrodomésticos, objetos pessoais e resíduos. Ideal para heranças, mudanças de casa, desocupação de imóveis para venda ou arrendamento.",
    keywords: ["esvaziamento de casas", "esvaziar casa", "desocupação de imóvel", "limpeza de casa"],
  },
  {
    slug: "mudancas",
    name: "Mudanças",
    description: "Serviço de mudanças residenciais e comerciais.",
    longDescription:
      "A CLYON oferece um serviço completo de mudanças para particulares e empresas. Tratamos do transporte de todos os seus bens com cuidado e profissionalismo. Disponível em Lisboa, Setúbal e toda a Margem Sul.",
    keywords: ["mudanças", "serviço de mudanças", "transporte de mudanças", "empresa de mudanças"],
  },
];

// Gera todas as combinações de cidade + serviço
export function getAllCityServiceCombinations() {
  const combinations: { city: CityData; service: ServiceData }[] = [];
  for (const city of CITIES) {
    for (const service of SERVICES) {
      combinations.push({ city, service });
    }
  }
  return combinations;
}

// Gera o slug para uma combinação cidade + serviço
export function getCityServiceSlug(serviceSlug: string, citySlug: string): string {
  return `${serviceSlug}-${citySlug}`;
}

// Encontra cidade pelo slug
export function findCity(slug: string): CityData | undefined {
  return CITIES.find((c) => c.slug === slug);
}

// Encontra serviço pelo slug
export function findService(slug: string): ServiceData | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
