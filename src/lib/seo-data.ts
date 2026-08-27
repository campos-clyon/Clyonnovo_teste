export type RegionKey = "lisboa" | "margem-sul" | "setubal";

export interface RegionData {
  slug: RegionKey;
  name: string;
  shortLabel: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

export interface CityData {
  slug: string;
  name: string;
  region: RegionKey;
  regionLabel: string;
  nearby: string[];
}

export interface ServiceData {
  slug: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  longDescription: string;
  primaryKeyword: string;
  keywords: string[];
}

export const SITE_URL = "https://clyon.pt";
export const BUSINESS_NAME = "CLYON";
export const BUSINESS_PHONE = "+351931632622";

/**
 * O mesmo número no formato que o wa.me exige: E.164 sem o '+'.
 *
 * Derivado de `BUSINESS_PHONE` para o número existir uma única vez no código.
 * Estava escrito à mão em 65 sítios espalhados por 20 ficheiros — mudar de
 * número era uma caça ao tesouro em que bastava falhar um para ficarem links
 * a apontar para um telefone que já não é nosso.
 */
export const BUSINESS_PHONE_E164 = BUSINESS_PHONE.replace(/\D/g, "");

/**
 * Link de conversa no WhatsApp com a CLYON, com mensagem já preenchida.
 *
 * A mensagem vai em texto normal — a codificação para URL acontece aqui, e não
 * escrita à mão em `%C3%A1`, que era como estava e ninguém conseguia ler.
 */
export function linkWhatsApp(mensagem?: string): string {
  const base = `https://wa.me/${BUSINESS_PHONE_E164}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

/** Link de chamada telefónica para o número da empresa. */
export function linkTelefone(): string {
  return `tel:${BUSINESS_PHONE}`;
}
export const BUSINESS_EMAIL = "geral@clyon.pt";
export const BUSINESS_ADDRESS = "Belverde, Amora, 2845-513 Portugal";
export const CONTACT_PATH = "/contactos";

export const REGIONS: RegionData[] = [
  {
    slug: "lisboa",
    name: "Lisboa",
    shortLabel: "Lisboa",
    intro:
      "Cobertura local para pedidos de recolha, limpeza e mudanças na cidade de Lisboa e nas zonas com maior procura.",
    metaTitle: "Recolha de Entulho, Móveis e Monos em Lisboa",
    metaDescription:
      "Recolha de entulho, móveis, monos, limpeza pós-obra e mudanças em Lisboa. Orçamento rápido, equipas locais e resposta no mesmo dia.",
    keywords: [
      "recolha de entulho lisboa",
      "recolha de móveis lisboa",
      "recolha de monos lisboa",
      "mudanças lisboa",
    ],
  },
  {
    slug: "margem-sul",
    name: "Margem Sul",
    shortLabel: "Margem Sul",
    intro:
      "Serviços rápidos na Margem Sul para entulho, móveis, monos, limpezas pós-obra e mudanças com apoio local.",
    metaTitle: "Recolha de Entulho, Móveis e Monos na Margem Sul",
    metaDescription:
      "Recolha de entulho, móveis, monos e mudanças na Margem Sul. Atendimento rápido em Almada, Seixal, Barreiro, Moita, Montijo e arredores.",
    keywords: [
      "recolha de entulho margem sul",
      "recolha de móveis margem sul",
      "recolha de monos margem sul",
      "mudanças margem sul",
    ],
  },
  {
    slug: "setubal",
    name: "Setúbal",
    shortLabel: "Setúbal",
    intro:
      "Intervenção rápida em Setúbal, Palmela e Sesimbra para recolha, limpeza pós-obra, esvaziamentos e mudanças.",
    metaTitle: "Recolha de Entulho, Móveis e Monos em Setúbal",
    metaDescription:
      "Recolha de entulho, móveis, monos, mudanças e limpeza pós-obra em Setúbal. Equipa profissional, orçamento rápido e apoio local.",
    keywords: [
      "recolha de entulho setúbal",
      "recolha de móveis setúbal",
      "recolha de monos setúbal",
      "mudanças setúbal",
    ],
  },
];

export const CITIES: CityData[] = [
  {
    slug: "lisboa",
    name: "Lisboa",
    region: "lisboa",
    regionLabel: "Lisboa",
    nearby: ["Benfica", "Lumiar", "Alvalade", "Olivais"],
  },
  {
    slug: "benfica",
    name: "Benfica",
    region: "lisboa",
    regionLabel: "Lisboa",
    nearby: ["Lisboa", "Amadora", "Carnaxide"],
  },
  {
    slug: "lumiar",
    name: "Lumiar",
    region: "lisboa",
    regionLabel: "Lisboa",
    nearby: ["Lisboa", "Odivelas", "Loures"],
  },
  {
    slug: "alvalade",
    name: "Alvalade",
    region: "lisboa",
    regionLabel: "Lisboa",
    nearby: ["Lisboa", "Olivais", "Lumiar"],
  },
  {
    slug: "olivais",
    name: "Olivais",
    region: "lisboa",
    regionLabel: "Lisboa",
    nearby: ["Lisboa", "Alvalade", "Loures"],
  },
  {
    slug: "sintra",
    name: "Sintra",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Amadora", "Oeiras", "Cascais"],
  },
  {
    slug: "cascais",
    name: "Cascais",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Oeiras", "Sintra", "Carnaxide"],
  },
  {
    slug: "oeiras",
    name: "Oeiras",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Carnaxide", "Cascais", "Amadora"],
  },
  {
    slug: "amadora",
    name: "Amadora",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Benfica", "Lisboa", "Sintra"],
  },
  {
    slug: "loures",
    name: "Loures",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Odivelas", "Lumiar", "Lisboa"],
  },
  {
    slug: "odivelas",
    name: "Odivelas",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Loures", "Lumiar", "Lisboa"],
  },
  {
    slug: "carnaxide",
    name: "Carnaxide",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Oeiras", "Benfica", "Cascais"],
  },
  {
    slug: "monte-abraao",
    name: "Monte Abraão",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Queluz", "Massamá", "Sintra", "Amadora"],
  },
  {
    slug: "queluz",
    name: "Queluz",
    region: "lisboa",
    regionLabel: "Grande Lisboa",
    nearby: ["Monte Abraão", "Massamá", "Sintra", "Amadora"],
  },
  {
    slug: "almada",
    name: "Almada",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Costa da Caparica", "Corroios", "Seixal"],
  },
  {
    slug: "costa-da-caparica",
    name: "Costa da Caparica",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Almada", "Corroios", "Seixal"],
  },
  {
    slug: "seixal",
    name: "Seixal",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Amora", "Corroios", "Almada"],
  },
  {
    slug: "amora",
    name: "Amora",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Seixal", "Corroios", "Almada"],
  },
  {
    slug: "corroios",
    name: "Corroios",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Seixal", "Amora", "Almada"],
  },
  {
    slug: "barreiro",
    name: "Barreiro",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Moita", "Montijo", "Seixal"],
  },
  {
    slug: "moita",
    name: "Moita",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Barreiro", "Montijo", "Alcochete"],
  },
  {
    slug: "montijo",
    name: "Montijo",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Moita", "Alcochete", "Barreiro"],
  },
  {
    slug: "alcochete",
    name: "Alcochete",
    region: "margem-sul",
    regionLabel: "Margem Sul",
    nearby: ["Montijo", "Moita", "Palmela"],
  },
  {
    slug: "setubal",
    name: "Setúbal",
    region: "setubal",
    regionLabel: "Setúbal",
    nearby: ["Palmela", "Sesimbra", "Azeitão"],
  },
  {
    slug: "palmela",
    name: "Palmela",
    region: "setubal",
    regionLabel: "Setúbal",
    nearby: ["Setúbal", "Sesimbra", "Montijo"],
  },
  {
    slug: "sesimbra",
    name: "Sesimbra",
    region: "setubal",
    regionLabel: "Setúbal",
    nearby: ["Setúbal", "Palmela", "Seixal"],
  },
];

export const SERVICES: ServiceData[] = [
  {
    slug: "recolha-moveis",
    name: "Recolha de Móveis",
    shortName: "móveis",
    category: "recolha de móveis",
    description:
      "Recolha profissional de móveis velhos, recheios e volumes grandes com destino responsável.",
    longDescription:
      "Retiramos sofás, camas, armários, eletrodomésticos e recheios completos com cuidado no acesso, transporte profissional e encaminhamento adequado. É a solução ideal para libertar espaço sem complicações.",
    primaryKeyword: "recolha de móveis",
    keywords: [
      "recolha de móveis",
      "remoção de móveis",
      "levar móveis velhos",
      "recolha de recheio",
    ],
  },
  {
    slug: "recolha-monos",
    name: "Recolha de Monos",
    shortName: "monos",
    category: "recolha de monos",
    description:
      "Recolha de monos, sucata e objetos volumosos com resposta rápida e processo responsável.",
    longDescription:
      "A CLYON recolhe monos, equipamentos antigos, sucata e objetos que ocupam espaço com triagem simples, resposta rápida e execução organizada no local. Ideal para garagens, arrecadações, caves e quintais.",
    primaryKeyword: "recolha de monos",
    keywords: [
      "recolha de monos",
      "remoção de monos",
      "retirar monos",
      "recolha de sucata",
    ],
  },
  {
    slug: "recolha-entulho",
    name: "Recolha de Entulho",
    shortName: "entulho",
    category: "recolha de entulho",
    description:
      "Recolha rápida e organizada de entulho para obras, remodelações e limpezas pesadas.",
    longDescription:
      "A CLYON trata da recolha de entulho com equipas rápidas, transporte responsável e triagem simples. Recolhemos restos de obra, sacos, materiais mistos e resíduos de remodelação em contexto residencial e comercial.",
    primaryKeyword: "recolha de entulho",
    keywords: [
      "recolha de entulho",
      "remoção de entulho",
      "limpeza de obra",
      "recolha de restos de obra",
    ],
  },
  {
    slug: "mudancas",
    name: "Mudanças",
    shortName: "mudanças",
    category: "mudanças",
    description:
      "Serviço de mudanças residenciais e comerciais com transporte, apoio e organização.",
    longDescription:
      "A CLYON apoia mudanças com transporte, carga, descarga, organização e equipas ajustadas ao tipo de imóvel. Trabalhamos com foco em rapidez, clareza no orçamento e cuidado no manuseamento.",
    primaryKeyword: "mudanças",
    keywords: [
      "mudanças",
      "empresa de mudanças",
      "mudanças residenciais",
      "transporte de móveis",
    ],
  },
  {
    slug: "esvaziamento-casas",
    name: "Esvaziamento de Casas",
    shortName: "esvaziamento de casas",
    category: "esvaziamento de casas",
    description:
      "Esvaziamento completo de casas, apartamentos, lojas e imóveis com apoio profissional.",
    longDescription:
      "Fazemos esvaziamento de casas com remoção de móveis, objetos, resíduos e volumes grandes. É um serviço indicado para heranças, vendas, arrendamentos, mudanças de casa e libertação total do imóvel.",
    primaryKeyword: "esvaziamento de casas",
    keywords: [
      "esvaziamento de casas",
      "esvaziar apartamento",
      "limpeza de imóvel",
      "desocupação de casa",
    ],
  },
];

export function getRegion(slug: string) {
  return REGIONS.find((region) => region.slug === slug);
}

export function getRegionCities(regionSlug: RegionKey) {
  return CITIES.filter((city) => city.region === regionSlug);
}

export function getCity(slug: string) {
  return CITIES.find((city) => city.slug === slug);
}

export function getService(slug: string) {
  return SERVICES.find((service) => service.slug === slug);
}

/**
 * Combinações cidade×serviço que geram página própria.
 *
 * `mudancas-<cidade>` fica de fora: essas URLs são apanhadas por redirects
 * no next.config e nunca chegam a servir esta rota. Estavam a gerar 18
 * páginas HTML que ninguém podia ver — e que, se um redirect falhasse,
 * apareceriam como conteúdo duplicado de /mudancas/<cidade>, que é a página
 * a sério, com conteúdo próprio por cidade.
 */
const SERVICOS_COM_PAGINA_PROPRIA = new Set(["mudancas"]);

export function getAllCityServiceSlugs() {
  return CITIES.flatMap((city) =>
    SERVICES
      .filter((service) => !SERVICOS_COM_PAGINA_PROPRIA.has(service.slug))
      .map((service) => ({
        slug: [`${service.slug}-${city.slug}`],
        city,
        service,
      })),
  );
}

export function getCityServiceSlug(serviceSlug: string, citySlug: string) {
  return `${serviceSlug}-${citySlug}`;
}

export function parseCityServiceSlug(fullSlug: string[]) {
  const slug = fullSlug.join("/");

  for (const service of SERVICES) {
    for (const city of CITIES) {
      if (slug === getCityServiceSlug(service.slug, city.slug)) {
        return { city, service };
      }
    }
  }

  return null;
}

export function getRelatedCities(citySlug: string, limit = 4) {
  const current = getCity(citySlug);
  if (!current) return [];

  const preferred = current.nearby
    .map((name) => CITIES.find((city) => city.name === name))
    .filter((city): city is CityData => Boolean(city));

  if (preferred.length >= limit) return preferred.slice(0, limit);

  const extra = CITIES.filter(
    (city) => city.region === current.region && city.slug !== current.slug,
  );

  const merged = [...preferred];
  for (const city of extra) {
    if (!merged.some((item) => item.slug === city.slug)) {
      merged.push(city);
    }
  }

  return merged.slice(0, limit);
}

/**
 * As avaliações reais, e onde se confirmam.
 *
 * Estavam espalhadas pelas páginas como números escritos à mão — "163", "Mais
 * de 160" — e nenhum correspondia a nada que se pudesse contar. O schema
 * declarava 163 sobre trinta visíveis, que é o caminho mais curto para o
 * Google retirar as estrelas ao domínio inteiro.
 *
 * Estes vêm dos perfis, conferidos a 22-08-2026. São menos redondos e têm uma
 * vantagem que o outro não tinha: qualquer pessoa os pode abrir e confirmar.
 * Quando subirem, actualizam-se aqui e mudam em todo o lado.
 */
export const AVALIACOES = {
  google: 37,
  fixando: 118,
  /** Contratações registadas na Fixando. */
  contratacoes: 158,
  media: "5,0",
  googleUrl: "https://www.google.com/search?q=CLYON+recolha+de+m%C3%B3veis",
  fixandoUrl: "https://www.fixando.pt/",
} as const;

/** O total verificável, somado e não arredondado. */
export const AVALIACOES_TOTAL = AVALIACOES.google + AVALIACOES.fixando;

/**
 * O prazo de resposta, num sítio só.
 *
 * Estava escrito à mão em 104 sítios de 41 ficheiros, e por isso divergiu: a
 * homepage prometia 24 horas no hero e, dois ecrãs abaixo, anunciava "<48h" em
 * letra gigante — na secção cujo título é "Construída para inspirar
 * confiança". O cartão dos 48h chegava a contradizer-se a si próprio, com a
 * descrição a dizer "confirmação de data no próprio dia".
 *
 * Quem compara os dois números não conclui que um deles está errado. Conclui
 * que a casa não sabe quanto tempo demora a responder — e é isso que custa o
 * pedido.
 *
 * Todo o resto do site já dizia 24 horas; o 48 era o caso isolado. Fica aqui
 * para a próxima mudança ser uma linha e não uma caça.
 */
export const PRAZO_DE_RESPOSTA = {
  /** Para texto corrido: "Orçamento gratuito em 24 horas." */
  porExtenso: "24 horas",
  /** Para selos e números em destaque. */
  curto: "<24h",
  /** Para frases como "Resposta em menos de 24 horas". */
  frase: "Resposta em menos de 24 horas",
} as const;
