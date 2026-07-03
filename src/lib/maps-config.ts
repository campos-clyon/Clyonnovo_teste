export const BASE_ADDRESS =
  "Centro Municipal de Higiene Urbana de Fernão Ferro, Av. Q.ta das Laranjeiras, 2865-688 Fernão Ferro, Portugal";

export function getMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_KEY ||
    ""
  );
}
