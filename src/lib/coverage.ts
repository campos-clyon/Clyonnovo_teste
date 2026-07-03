// Zonas cobertas pela CLYON (região de Lisboa e Península de Setúbal)
export const COVERED_ZONES = [
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
] as const;

/** Normaliza texto: remove acentos, minúsculas, trim */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const NORMALIZED_ZONES = COVERED_ZONES.map(normalize);

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

  const normalizedCity = normalize(city);
  const covered = NORMALIZED_ZONES.some(
    (zone) => normalizedCity.includes(zone) || zone.includes(normalizedCity),
  );

  return { inPortugal, covered };
}
