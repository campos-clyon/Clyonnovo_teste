export const BASE_ADDRESS =
  "Centro Municipal de Higiene Urbana de Fernão Ferro, Av. Q.ta das Laranjeiras, 2865-688 Fernão Ferro, Portugal";

export function getMapsApiKey() {
  return (
    // O nome que o painel do Vercel usa quando a chave é criada para o
    // servidor. Faltava nesta lista, e a chave existia sem nunca ser lida —
    // o mapa continuava vazio com tudo configurado do lado dele.
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_KEY ||
    ""
  );
}
