import { ENTIDADE_QUE_FACTURA, TAXA_IVA } from "@/lib/identificacao-legal";
import { GERADAS_COM_PAGINA_ESTATICA } from "@/lib/paginas-consolidadas";

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
export const BUSINESS_EMAIL = "geral@clyon.pt";
export const BUSINESS_ADDRESS = "Belverde, Amora, 2845-513 Portugal";
export const CONTACT_PATH = "/contactos";

export const REGIONS: RegionData[] = [
  {
    slug: "lisboa",
    name: "Lisboa",
    shortLabel: "Lisboa",
    intro:
      "Profissionais de recolha, limpeza e mudanças na cidade de Lisboa e nas freguesias à volta.",
    metaTitle: "Recolha de Entulho, Móveis e Monos em Lisboa",
    // Sem a limpeza pós-obra, que deixou de ser serviço activo (29-09-2026).
    metaDescription:
      "Recolha de entulho, móveis e monos, esvaziamentos e mudanças em Lisboa. Profissionais verificados, orçamento gratuito e propostas em menos de 6 horas.",
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
      "Profissionais na Margem Sul para entulho, móveis, monos, esvaziamentos e mudanças, de Almada ao Montijo.",
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
      "Profissionais em Setúbal, Palmela e Sesimbra para recolhas, esvaziamentos e mudanças.",
    metaTitle: "Recolha de Entulho, Móveis e Monos em Setúbal",
    // Sem a limpeza pós-obra, que deixou de ser serviço activo (29-09-2026).
    metaDescription:
      "Recolha de entulho, móveis e monos, esvaziamentos e mudanças em Setúbal. Profissionais verificados, orçamento gratuito e propostas em menos de 6 horas.",
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
      "Os profissionais retiram sofás, camas, armários, eletrodomésticos e recheios completos com cuidado no acesso, transporte profissional e destino licenciado. É a solução ideal para libertar espaço sem complicações.",
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
      "Os profissionais da CLYON recolhem monos, equipamentos antigos, sucata e objetos que ocupam espaço, com triagem simples e trabalho organizado no local. Ideal para garagens, arrecadações, caves e quintais.",
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
      "Na CLYON, a recolha de entulho é feita por profissionais verificados da zona, com transporte responsável e triagem simples. Recolhem restos de obra, sacos, materiais mistos e resíduos de remodelação, em casas e em espaços comerciais.",
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
      "Na CLYON, as mudanças são feitas por profissionais verificados: transporte, carga, descarga e organização, com as pessoas e a viatura ajustadas ao volume. O preço de cada proposta fica escrito antes de começar.",
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
      "Os profissionais da CLYON esvaziam casas: retiram móveis, objetos, resíduos e volumes grandes. É um serviço indicado para heranças, vendas, arrendamentos, mudanças de casa e libertação total do imóvel.",
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

/*
 * E, desde 29-09-2026, também ficam de fora as combinações que têm uma
 * página estática a dizer o mesmo (`paginas-consolidadas.ts`): a gerada faz
 * 301 para a estática, e gerá-la no build era voltar a pôr no ar o duplicado
 * que o redirect veio tirar. Esta lista é a que alimenta o build da rota e o
 * sitemap — sair daqui é sair dos dois.
 */
export function getAllCityServiceSlugs() {
  return CITIES.flatMap((city) =>
    SERVICES
      .filter((service) => !SERVICOS_COM_PAGINA_PROPRIA.has(service.slug))
      .filter((service) => !(`${service.slug}-${city.slug}` in GERADAS_COM_PAGINA_ESTATICA))
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

// Para onde deve ir um LINK para um serviço numa cidade não é isto — é
// `caminhoDoServicoNaCidade`, em caminho-da-cidade.ts (29-09-2026).

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
 * Quando subirem, atualizam-se aqui e mudam em todo o lado.
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

/** «23 %», tirado da constante — o imposto não se escreve à mão num texto. */
const IVA_EM_PALAVRAS = `${Math.round(TAXA_IVA * 100)} %`;

/**
 * A nota que acompanha qualquer preço mostrado ao público.
 *
 * OS VALORES SÃO SEM IVA, E ISSO DIZ-SE
 *
 * Em Portugal o preço mostrado ao consumidor tem de incluir os impostos. O que
 * torna isto legítimo aqui é a natureza do número: o que está na grelha é uma
 * ESTIMATIVA, não um preço de venda. O preço a sério é a proposta que o
 * profissional faz.
 *
 * REESCRITA A 30-09-2026, porque a razão que aqui estava deixou de ser verdade
 * duas vezes. Dizia que o site não podia falar de IVA por cada profissional
 * facturar no seu regime; desde 22-09-2026 a factura é uma só, da
 * `ENTIDADE_QUE_FACTURA`, sempre a 23 %. E desde 29-09-2026 o preço de cada
 * proposta já vem com a taxa da plataforma (ver `preco-do-cliente.ts`): a nota
 * antiga deixava o cliente a perguntar se a taxa ainda acrescia. Não acresce,
 * e diz-se.
 *
 * Escrita uma vez para não divergir. Já foi por não estar.
 *
 * E DESDE 01-10-2026, OS PREÇOS DAS PROPOSTAS SÃO COM IVA INCLUÍDO. "Preços de
 * referência do site: FICAM COM OS MESMOS NÚMEROS e a etiqueta «sem IVA», com
 * uma nota curta: «Na proposta, o preço já vem com IVA incluído.»" — decisão
 * do dono. A grelha continua a ser uma estimativa sem imposto; a proposta é o
 * preço final, e é isso que a nota diz. Há factura em todas as vendas.
 */
export const NA_PROPOSTA_COM_IVA = "Na proposta, o preço já vem com IVA incluído.";

export const NOTA_DE_PRECO = {
  /** Uma linha, para pôr junto de uma grelha. */
  curta:
    "Valores orientativos, sem IVA. O preço de cada proposta já inclui a taxa da plataforma. " +
    NA_PROPOSTA_COM_IVA,
  /** Com a explicação de quem factura, para páginas de preços. */
  completa:
    "Valores orientativos, sem IVA. O preço a sério é a proposta que recebe, fechada " +
    `antes de o trabalho começar, e já inclui a taxa da plataforma. ${NA_PROPOSTA_COM_IVA} ` +
    `Há factura em todas as vendas, emitida pela ${ENTIDADE_QUE_FACTURA.nomeCurto}, nossa parceira.`,
} as const;

/**
 * QUEM PASSA A FACTURA, dito ao público — 30-09-2026.
 *
 * O site dizia três coisas diferentes: «emitimos fatura sempre» (/servicos),
 * «a fatura é emitida pelo profissional que escolher» (/faq) e «nem todos os
 * profissionais emitem fatura» (/contactos). Nenhuma é verdade desde
 * 22-09-2026: quem factura ao cliente é a parceira, e o imposto soma-se ao
 * preço da proposta. Uma frase, para as páginas deixarem de discordar.
 */
/*
 * COM IVA INCLUÍDO DESDE 01-10-2026 — o preço da proposta já leva os 23 %, e
 * há factura em todas as vendas. Dizia «os valores são apresentados sem IVA;
 * se pedir factura, acrescem 23 %».
 */
export const FACTURA_EM_PALAVRAS =
  `O preço de cada proposta vem com IVA incluído (${IVA_EM_PALAVRAS}) e já inclui a taxa da ` +
  "plataforma. Há factura em todas as vendas, com o seu NIF se o quiser na factura, emitida " +
  `pela ${ENTIDADE_QUE_FACTURA.nomeCurto}, empresa parceira da CLYON.`;

/**
 * COMO SE PAGA, quando ainda não se sabe a forma que o cliente vai escolher.
 *
 * As páginas públicas diziam «MB Way, Revolut e Novo Banco, após o serviço»
 * (/faq) e «MB WAY, transferência ou numerário» (/servicos) — nenhuma das duas
 * é o que a plataforma faz. As formas são as de `forma-de-pagamento.ts`, e é
 * lá que se escolhe; isto é só a explicação de antes da escolha.
 *
 * EM DINHEIRO, DESDE 01-10-2026: o cliente paga ao profissional o preço com
 * IVA e não paga nada à parte; o IVA e a comissão é o profissional que os
 * entrega à CLYON (`divida-do-profissional.ts`). Dizia «paga à parte, por
 * referência, a comissão da CLYON» — o modelo de antes do corte.
 *
 * ⚠️ SÃO DUAS FORMAS porque `PAGAR_DEPOIS_LIGADO` está desligado. No dia em que
 * o pós-recolha abrir, esta frase tem de ganhar a terceira.
 */
export const COMO_SE_PAGA =
  "No pedido escolhe como prefere pagar: pela plataforma — depois de aceitar a proposta " +
  "recebe uma referência MB WAY ou Multibanco, e o valor fica com a CLYON até confirmar " +
  "que o trabalho está feito; só então é entregue ao profissional — ou em dinheiro, ao " +
  "profissional, no fim do trabalho: o mesmo preço, com IVA incluído, sem nada a pagar à parte.";

/**
 * O prazo de resposta, num sítio só.
 *
 * Estava escrito à mão em 104 sítios de 41 ficheiros, e por isso divergiu: a
 * homepage prometia 6 horas no hero e, dois ecrãs abaixo, anunciava "<48h" em
 * letra gigante — na secção cujo título é "Construída para inspirar
 * confiança". O cartão dos 48h chegava a contradizer-se a si próprio, com a
 * descrição a dizer "confirmação de data no próprio dia".
 *
 * Quem compara os dois números não conclui que um deles está errado. Conclui
 * que a casa não sabe quanto tempo demora a responder — e é isso que custa o
 * pedido.
 *
 * Todo o resto do site já dizia 6 horas; o 48 era o caso isolado. Fica aqui
 * para a próxima mudança ser uma linha e não uma caça. (O comentário estava
 * por cima da `NOTA_DE_PRECO`, a descrever a constante errada; desceu para
 * aqui a 30-09-2026.)
 */
export const PRAZO_DE_RESPOSTA = {
  /** Para texto corrido: "Orçamento gratuito em 6 horas." */
  porExtenso: "6 horas",
  /** Para selos e números em destaque. */
  curto: "<6h",
  /** Para frases como "Resposta em menos de 6 horas". */
  frase: "Resposta em menos de 6 horas",
} as const;
