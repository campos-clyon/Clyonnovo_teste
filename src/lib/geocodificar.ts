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

/**
 * A ZONA ONDE A CLYON TRABALHA — Grande Lisboa, Margem Sul e Setúbal, com
 * folga — d100 (23-11-2026).
 *
 * Pedia-se ao Nominatim só o PRIMEIRO resultado de um nome, e há nomes que o
 * país tem duas vezes. «Alvalade» é um bairro de Lisboa e é uma vila do
 * Alentejo, a mais de 100 km: a base de um parceiro de Lisboa ficou no
 * Alentejo, e o aviso de uma recolha em Lisboa disse-lhe «a cerca de 146 km da
 * sua base». Agora pedem-se vários resultados e, quando um deles cai nesta
 * zona, é esse que fica; quando nenhum cai (uma terra do Porto, por exemplo),
 * fica o primeiro, como antes.
 */
export const ZONA_DA_CLYON = { latMin: 38.35, latMax: 39.1, lngMin: -9.6, lngMax: -8.45 } as const;

/** Quantos resultados se pedem ao Nominatim, para poder escolher o da zona. */
export const RESULTADOS_POR_NOME = 10;

export function naZonaDaClyon(c: Coordenadas): boolean {
  return (
    c.lat >= ZONA_DA_CLYON.latMin &&
    c.lat <= ZONA_DA_CLYON.latMax &&
    c.lng >= ZONA_DA_CLYON.lngMin &&
    c.lng <= ZONA_DA_CLYON.lngMax
  );
}

/**
 * De vários resultados do mesmo nome, o que fica: o primeiro dentro da zona
 * da CLYON, ou — sem nenhum lá — o primeiro de todos. Pura.
 */
export function escolherResultado(
  dados: ReadonlyArray<{ lat?: string | number; lon?: string | number }> | null | undefined,
): Coordenadas | null {
  if (!Array.isArray(dados)) return null;
  const validos: Coordenadas[] = [];
  for (const d of dados) {
    if (d?.lat == null || d?.lon == null || d.lat === "" || d.lon === "") continue;
    const lat = Number(d.lat);
    const lng = Number(d.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    validos.push({ lat, lng });
  }
  return validos.find(naZonaDaClyon) ?? validos[0] ?? null;
}

export async function geocodificarLocalidade(
  localidade: string,
): Promise<Coordenadas | null> {
  const termo = localidade.trim();
  if (termo.length < 2) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", termo);
  url.searchParams.set("format", "json");
  // Vários, para escolher o da zona da CLYON quando o nome se repete (d100).
  url.searchParams.set("limit", String(RESULTADOS_POR_NOME));
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
    return escolherResultado(dados);
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
/**
 * O mesmo que `geocodificarMorada`, mas devolve TAMBÉM o estado do Google.
 *
 * "ZERO_RESULTS" e "REQUEST_DENIED" não são a mesma história: o primeiro é a
 * morada, o segundo é a CHAVE — restrita à API errada, ou por activar. O
 * painel do backoffice mostrava os dois como "não localizada", e quem
 * registava pedidos corrigia moradas certas enquanto o problema era a
 * configuração no Google Cloud.
 */
export async function geocodificarMoradaDetalhado(
  morada: string | null | undefined,
  codigoPostal?: string | null,
  localidade?: string | null,
): Promise<{
  coords: (Coordenadas & { moradaNormalizada: string | null }) | null;
  estado: "OK" | "SEM_CHAVE" | "SEM_TEXTO" | "FALHA_DE_REDE" | string;
}> {
  const { getMapsApiKey } = await import("./maps-config");
  const chave = getMapsApiKey();
  if (!chave) return { coords: null, estado: "SEM_CHAVE" };

  /*
   * A LOCALIDADE ENTRA NA CONSULTA.
   *
   * O formulário do backoffice tem três campos — morada, código postal,
   * localidade — e esta função só recebia dois. "Rua das Andorinhas Pretas 29,
   * 1900-321" ia ao Google sem o "Lisboa" que estava escrito mesmo ao lado,
   * no campo próprio. Quem preenchia bem os três campos dava ao Google menos
   * informação do que quem despejava tudo na morada — o contrário do que o
   * desenho do formulário promete.
   */
  const texto = [morada, codigoPostal, localidade].filter(Boolean).join(", ").trim();
  if (texto.length < 4) return { coords: null, estado: "SEM_TEXTO" };

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
    if (!resposta.ok) return { coords: null, estado: 'HTTP_' + resposta.status };

    let dados = (await resposta.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };
    /*
     * Segunda tentativa sem o código postal.
     *
     * Um CP ditado ao telefone é o campo mais fácil de ouvir mal — um dígito
     * trocado e o Google devolve ZERO_RESULTS para uma rua que conhece
     * perfeitamente. Rua e localidade chegam quase sempre; o CP errado não
     * pode valer mais do que a morada certa.
     */
    if (dados.status !== "OK" && codigoPostal && (morada || localidade)) {
      const semCP = [morada, localidade].filter(Boolean).join(", ").trim();
      const params2 = new URLSearchParams({
        address: semCP,
        key: chave,
        components: "country:PT",
        language: "pt",
      });
      const r2 = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params2.toString()}`,
        { signal: abortar.signal },
      );
      if (r2.ok) dados = (await r2.json()) as typeof dados;
    }

    if (dados.status !== "OK") {
      // O estado fica no registo: "REQUEST_DENIED" no log é a diferença entre
      // diagnosticar em um minuto e andar a reescrever moradas certas.
      console.warn("[geocodificarMorada]", dados.status, "para", texto.slice(0, 80));
      return { coords: null, estado: dados.status ?? "SEM_ESTADO" };
    }

    const loc = dados.results?.[0]?.geometry?.location;
    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") {
      return { coords: null, estado: "SEM_GEOMETRIA" };
    }

    return {
      coords: {
        lat: loc.lat,
        lng: loc.lng,
        moradaNormalizada: dados.results?.[0]?.formatted_address ?? null,
      },
      estado: "OK",
    };
  } catch (err) {
    console.warn("[geocodificarMorada] falhou —", String(err).slice(0, 120));
    return { coords: null, estado: "FALHA_DE_REDE" };
  } finally {
    clearTimeout(relogio);
  }
}

/** A forma antiga: só as coordenadas, ou null. Os chamadores que não precisam
 *  do estado continuam como estavam. */
export async function geocodificarMorada(
  morada: string | null | undefined,
  codigoPostal?: string | null,
  localidade?: string | null,
): Promise<(Coordenadas & { moradaNormalizada: string | null }) | null> {
  return (await geocodificarMoradaDetalhado(morada, codigoPostal, localidade)).coords;
}
