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

/**
 * Coordenadas a partir de uma morada completa, escrita à mão.
 *
 * PORQUE É QUE ISTO DECIDE QUEM RECEBE O TRABALHO
 *
 * A regra de elegibilidade tem dois critérios, e não são equivalentes. Havendo
 * coordenadas, compara-se a distância real com o RAIO que o profissional
 * declarou. Não havendo, cai-se na lista de ZONAS que ele escreveu à mão, que
 * costuma ter cinco ou seis nomes.
 *
 * A diferença é enorme e viu-se no pedido #205: uma recolha em Lisboa,
 * registada ao telefone e portanto sem coordenadas, comparada contra
 * "palmela, montijo, seixal, amora, setubal" — fora de alcance, zero
 * profissionais. Com coordenadas seriam 35 km contra um raio de 125, e ele era
 * elegível à primeira. O pedido não chegou a ninguém por lhe faltar isto.
 *
 * PORQUE É QUE NÃO USA O NOMINATIM COMO A FUNÇÃO ACIMA
 *
 * A de cima resolve o nome de uma localidade, uma vez por inscrição — o
 * Nominatim chega e não custa nada. Esta resolve uma morada com rua, número e
 * código postal, escrita por quem estava ao telefone, muitas vezes com abreviaturas
 * e gralhas. É aí que o Google é claramente melhor, e a chave já cá está para
 * o mapa e para o simulador.
 *
 * Nunca lança. Sem chave, com a rede em baixo ou com uma morada que ninguém
 * reconhece, devolve null e a regra cai nas zonas como caía antes. É
 * degradação, não avaria.
 */
export async function geocodificarMorada(
  morada: string | null | undefined,
  codigoPostal?: string | null,
): Promise<(Coordenadas & { moradaNormalizada: string | null }) | null> {
  const { getMapsApiKey } = await import("./maps-config");
  const chave = getMapsApiKey();
  if (!chave) return null;

  const texto = [morada, codigoPostal].filter(Boolean).join(", ").trim();
  if (texto.length < 4) return null;

  const abortar = new AbortController();
  const relogio = setTimeout(() => abortar.abort(), TEMPO_LIMITE_MS);

  try {
    const params = new URLSearchParams({
      address: texto,
      key: chave,
      // Só Portugal. Sem isto, "Rua da Estação" devolve resultados no Brasil
      // com a mesma confiança — e um pedido do Seixal ia parar a São Paulo.
      components: "country:PT",
      language: "pt",
    });

    const resposta = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      { signal: abortar.signal },
    );
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };
    if (dados.status !== "OK") return null;

    const loc = dados.results?.[0]?.geometry?.location;
    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") return null;

    return {
      lat: loc.lat,
      lng: loc.lng,
      moradaNormalizada: dados.results?.[0]?.formatted_address ?? null,
    };
  } catch (err) {
    console.warn("[geocodificarMorada] falhou —", String(err).slice(0, 120));
    return null;
  } finally {
    clearTimeout(relogio);
  }
}
