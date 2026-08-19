/**
 * Coordenadas a partir do nome de uma localidade portuguesa.
 *
 * Usado uma vez por profissional, no momento da inscrição, para guardar onde
 * fica a base dele. Sem isto o raio que ele indica não passa de um número
 * bonito no formulário — não há como medir distância nenhuma, e a regra de
 * elegibilidade fica reduzida a comparar nomes de cidades.
 *
 * Nominatim, como o resto do site (ver /api/address/search): não precisa de
 * chave, e a política de uso deles exige identificação no User-Agent e um
 * pedido por segundo. Uma inscrição não é um caso de volume.
 *
 * Nunca lança. Falhar a geocodificação não pode impedir alguém de se
 * inscrever — sem coordenadas a regra cai nas zonas, que continuam a
 * funcionar. É degradação, não avaria.
 */

export type Coordenadas = { lat: number; lng: number };

const TEMPO_LIMITE_MS = 5000;

export async function geocodificarLocalidade(
  localidade: string,
): Promise<Coordenadas | null> {
  const termo = localidade.trim();
  if (termo.length < 2) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", termo);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  // Sem isto, "Braga" tanto podia ser a portuguesa como uma povoação italiana
  // com o mesmo nome — e o profissional ficava com a base a 2000 km.
  url.searchParams.set("countrycodes", "pt");

  const abortar = new AbortController();
  const relogio = setTimeout(() => abortar.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(url.toString(), {
      headers: {
        "User-Agent": "CLYON/1.0 (+https://clyon.pt)",
        "Accept-Language": "pt",
      },
      signal: abortar.signal,
    });
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as Array<{ lat?: string; lon?: string }>;
    const primeiro = Array.isArray(dados) ? dados[0] : null;
    if (!primeiro?.lat || !primeiro?.lon) return null;

    const lat = Number(primeiro.lat);
    const lng = Number(primeiro.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch (err) {
    console.warn("[geocodificar] falhou para", termo, "—", String(err).slice(0, 120));
    return null;
  } finally {
    clearTimeout(relogio);
  }
}
