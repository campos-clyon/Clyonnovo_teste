import { CITIES } from "@/lib/seo-data";

/**
 * As zonas cobertas — a lista escrita à mão, e a que o site já publica.
 *
 * ERA SÓ A LISTA À MÃO, e esquecia metade das terras que têm página: quem
 * abria /recolha-moveis-odivelas, com a localização em Odivelas, levava com
 * «Ainda não estamos na sua área» por cima de uma página que dizia o
 * contrário. O mesmo em Montijo, Alcochete, Queluz, Monte Abraão, Carnaxide,
 * Corroios, Costa da Caparica e Azeitão — 30-09-2026.
 *
 * Passa a juntar três fontes, sem repetir: as que já cá estavam (Belverde e
 * Fernão Ferro não têm página e continuam cobertas), todas as `CITIES` de
 * seo-data.ts, e as terras vizinhas que cada uma nomeia. Uma cidade nova com
 * página entra aqui sozinha — é essa a razão de não ser outra lista à mão.
 */
const ESCRITAS_A_MAO = [
  "Lisboa",
  "Almada",
  "Seixal",
  "Amora",
  "Belverde",
  "Fernão Ferro",
  "Barreiro",
  "Moita",
  "Setúbal",
  "Sesimbra",
  "Palmela",
  "Oeiras",
  "Cascais",
  "Sintra",
  "Loures",
  "Amadora",
];

export const COVERED_ZONES: readonly string[] = [
  ...new Set([
    ...ESCRITAS_A_MAO,
    ...CITIES.map((c) => c.name),
    ...CITIES.flatMap((c) => c.nearby),
  ]),
];

/** Normaliza texto: remove acentos, minúsculas, trim */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const NORMALIZED_ZONES = COVERED_ZONES.map(normalize);

/*
 * A CIDADE DO IP VEM EM INGLÊS — 14-10-2026.
 *
 * A Vercel diz «Lisbon», não «Lisboa». A lista acima só conhece «Lisboa», e
 * quem estava em Lisboa lia «Ainda não estamos na sua área» com «Lisbon» no
 * cabeçalho. Das terras que servimos só Lisboa muda de nome em inglês; o
 * Porto vai junto por causa do «Oporto».
 */
const NOMES_EM_INGLES: Record<string, string> = {
  lisbon: "Lisboa",
  oporto: "Porto",
};

/** O nome português de uma cidade que o IP deu em inglês; as outras ficam como vieram. */
export function nomeEmPortugues(cidade: string): string {
  return NOMES_EM_INGLES[normalize(cidade)] ?? cidade;
}

export interface CoverageResult {
  /** true se a localização está dentro de Portugal */
  inPortugal: boolean;
  /** true se a cidade/localidade está numa zona coberta pela CLYON */
  covered: boolean;
}

/**
 * Verifica cobertura a partir de cidade e código de país.
 * - covered: cidade está na lista de zonas cobertas
 * - inPortugal: país é Portugal (PT) ou não foi possível determinar (assume PT)
 */
export function checkCoverage(params: {
  city?: string;
  countryCode?: string;
}): CoverageResult {
  const { city, countryCode } = params;

  // Se temos countryCode e NÃO é PT, está fora de Portugal
  const inPortugal = !countryCode || countryCode.toUpperCase() === "PT";

  if (!city) {
    return { inPortugal, covered: false };
  }

  const normalizedCity = normalize(nomeEmPortugues(city));
  const covered = NORMALIZED_ZONES.some(
    (zone) => normalizedCity.includes(zone) || zone.includes(normalizedCity),
  );

  return { inPortugal, covered };
}
