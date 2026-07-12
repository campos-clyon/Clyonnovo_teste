"use client";

/**
 * useGooglePlaces — pesquisa de moradas no modelo Oscar.
 *
 * O Oscar carrega o SDK Google Maps (`maps.googleapis.com/maps/api/js?libraries=places`)
 * diretamente no browser e usa `AutocompleteService` + `PlacesService` com session
 * tokens. As predictions dentro de uma sessão são gratuitas; só o `getDetails` final
 * é faturado. Isto reduz drasticamente o custo e a latência face ao proxy servidor.
 *
 * Este hook replica esse comportamento MAS degrada graciosamente:
 *
 *   • modo "sdk"   → há `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: usa o SDK no cliente
 *                    (paridade total com o Oscar, com session tokens).
 *   • modo "proxy" → chave cliente ausente: usa os endpoints servidor existentes
 *                    (`/api/maps/autocomplete`, `/api/maps/place-details`) com
 *                    fallback Nominatim (`/api/address/search`). É o comportamento
 *                    atual do Clyon — garante que nada regride enquanto a chave
 *                    `NEXT_PUBLIC` não estiver configurada no Vercel.
 *
 * Assim que a chave `NEXT_PUBLIC` for definida (e restringida por HTTP referrer no
 * Google Cloud Console), o hook passa automaticamente para o modo "sdk" sem
 * qualquer alteração de código.
 */

import { useEffect, useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface PlacePrediction {
  /** ID Google para resolver depois via getDetails. Vazio no fallback Nominatim. */
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  /**
   * Preenchido apenas no fallback Nominatim, onde as coordenadas já vêm com a
   * prediction. No modo SDK/proxy-Google fica indefinido (resolve-se on select).
   */
  resolved?: ResolvedPlace;
}

export interface ResolvedPlace {
  formattedAddress: string;
  city: string;
  postalCode: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
  placeId?: string;
}

export type PlacesMode = "sdk" | "proxy";

export interface UseGooglePlaces {
  /** true quando o SDK está pronto (modo sdk) ou sempre (modo proxy). */
  ready: boolean;
  mode: PlacesMode;
  /** Erro de carregamento do SDK (ex: chave inválida). Cai para proxy se acontecer. */
  loadError: boolean;
  /** Pesquisa predições para o texto dado (>= 3 chars). */
  search: (input: string) => Promise<PlacePrediction[]>;
  /** Resolve uma prediction em morada com lat/lng. Fecha a sessão de faturação. */
  resolve: (prediction: PlacePrediction) => Promise<ResolvedPlace | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_KEY = (
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_KEY ||
  ""
).trim();

/** Restringimos a Portugal (o Clyon só opera em PT). */
const COUNTRY = "pt";
/** "geocode" = ruas + localidades/cidades, sem estabelecimentos (hotéis, bares…). */
const AUTOCOMPLETE_TYPES: string[] = ["geocode"];

// ─────────────────────────────────────────────────────────────────────────────
// Loader singleton do SDK (injeta o <script> uma única vez)
// ─────────────────────────────────────────────────────────────────────────────

interface GmapsServices {
  google: typeof google;
  autocomplete: google.maps.places.AutocompleteService;
  places: google.maps.places.PlacesService;
}

let scriptPromise: Promise<typeof google> | null = null;
let servicesPromise: Promise<GmapsServices> | null = null;
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

function loadSdk(key: string): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no_window"));
  }
  // Já carregado (ex: outra parte da app carregou o SDK)
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const callbackName = "__clyonGmapsReady";
    // callback global que o Google invoca quando o SDK termina de carregar
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      if (window.google?.maps?.places) resolve(window.google);
      else reject(new Error("gmaps_places_missing"));
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };

    const params = new URLSearchParams({
      key,
      libraries: "places",
      language: "pt-PT",
      region: "PT",
      loading: "async",
      callback: callbackName,
    });

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      scriptPromise = null; // permite nova tentativa
      reject(new Error("gmaps_load_failed"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function getServices(key: string): Promise<GmapsServices> {
  if (!servicesPromise) {
    servicesPromise = loadSdk(key).then((g) => ({
      google: g,
      autocomplete: new g.maps.places.AutocompleteService(),
      // PlacesService precisa de um nó DOM (não precisa de estar montado)
      places: new g.maps.places.PlacesService(document.createElement("div")),
    }));
  }
  return servicesPromise;
}

function currentToken(
  g: typeof google,
): google.maps.places.AutocompleteSessionToken {
  if (!sessionToken) {
    sessionToken = new g.maps.places.AutocompleteSessionToken();
  }
  return sessionToken;
}

/** Fecha a sessão atual — chamado após um getDetails (que é o pedido faturado). */
function renewToken() {
  sessionToken = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extração de componentes de morada (partilhado SDK + proxy)
// ─────────────────────────────────────────────────────────────────────────────

function pickComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
  useShort = false,
): string {
  const found = components?.find((c) => c.types.includes(type));
  if (!found) return "";
  return useShort ? found.short_name : found.long_name;
}

function placeResultToResolved(
  place: google.maps.places.PlaceResult,
  placeId: string,
): ResolvedPlace {
  const comps = place.address_components;
  const city =
    pickComponent(comps, "locality") ||
    pickComponent(comps, "postal_town") ||
    pickComponent(comps, "administrative_area_level_2") ||
    "";
  return {
    formattedAddress: place.formatted_address ?? place.name ?? "",
    city,
    postalCode: pickComponent(comps, "postal_code"),
    countryCode: pickComponent(comps, "country", true),
    lat: place.geometry?.location?.lat() ?? null,
    lng: place.geometry?.location?.lng() ?? null,
    placeId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementação SDK (modo Oscar)
// ─────────────────────────────────────────────────────────────────────────────

async function sdkSearch(
  key: string,
  input: string,
): Promise<PlacePrediction[]> {
  const { google: g, autocomplete } = await getServices(key);
  const response = await autocomplete.getPlacePredictions({
    input,
    sessionToken: currentToken(g),
    componentRestrictions: { country: COUNTRY },
    types: AUTOCOMPLETE_TYPES,
  });
  return (response.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? "",
  }));
}

function sdkResolve(
  key: string,
  placeId: string,
): Promise<ResolvedPlace | null> {
  return getServices(key).then(
    ({ google: g, places }) =>
      new Promise<ResolvedPlace | null>((resolve) => {
        places.getDetails(
          {
            placeId,
            sessionToken: currentToken(g),
            fields: [
              "geometry",
              "formatted_address",
              "address_components",
              "name",
            ],
          },
          (place, status) => {
            // O getDetails fecha/consome a sessão → renovar token
            renewToken();
            if (
              status === g.maps.places.PlacesServiceStatus.OK &&
              place
            ) {
              resolve(placeResultToResolved(place, placeId));
            } else {
              resolve(null);
            }
          },
        );
      }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementação proxy (fallback servidor — comportamento atual do Clyon)
// ─────────────────────────────────────────────────────────────────────────────

interface ProxyGooglePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface NominatimSuggestion {
  label: string;
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
}

async function proxySearch(input: string): Promise<PlacePrediction[]> {
  // 1) Google via proxy servidor
  try {
    const res = await fetch("/api/maps/autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });
    if (res.ok) {
      const data = await res.json();
      const preds: ProxyGooglePrediction[] = data.predictions ?? [];
      if (preds.length > 0) {
        return preds.map((p) => ({
          placeId: p.placeId,
          description: p.description,
          mainText: p.mainText || p.description,
          secondaryText: p.secondaryText || "",
        }));
      }
    }
  } catch {
    // ignora — cai no fallback Nominatim
  }

  // 2) Fallback Nominatim (já traz coordenadas resolvidas)
  try {
    const res = await fetch(
      `/api/address/search?q=${encodeURIComponent(input)}`,
    );
    if (res.ok) {
      const data = await res.json();
      const sugg: NominatimSuggestion[] = data.suggestions ?? [];
      return sugg.map((s, idx) => ({
        placeId: "",
        description: s.label,
        mainText: s.address || s.city || s.label,
        secondaryText: [s.city, s.postalCode].filter(Boolean).join(" • "),
        resolved: {
          formattedAddress: s.address || s.label,
          city: s.city,
          postalCode: s.postalCode,
          countryCode: "PT",
          lat: s.lat,
          lng: s.lng,
        },
      }));
    }
  } catch {
    // ignora
  }

  return [];
}

async function proxyResolve(placeId: string): Promise<ResolvedPlace | null> {
  try {
    const res = await fetch("/api/maps/place-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
    });
    const data = await res.json();
    if (!data.ok) return null;
    return {
      formattedAddress: data.formattedAddress ?? "",
      city: data.city ?? "",
      postalCode: data.postalCode ?? "",
      countryCode: data.countryCode ?? "",
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      placeId,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useGooglePlaces(): UseGooglePlaces {
  const mode: PlacesMode = CLIENT_KEY ? "sdk" : "proxy";
  const [ready, setReady] = useState(mode === "proxy");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (mode !== "sdk") return;
    let cancelled = false;
    getServices(CLIENT_KEY)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          // Falha a carregar o SDK → passa a usar o proxy servidor
          setLoadError(true);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return useMemo<UseGooglePlaces>(() => {
    // Se a chave existe mas o SDK falhou, usamos o proxy como rede de segurança.
    const useSdk = mode === "sdk" && !loadError;

    return {
      ready,
      mode: useSdk ? "sdk" : "proxy",
      loadError,
      search: async (input: string) => {
        const query = input.trim();
        if (query.length < 3) return [];
        if (useSdk) {
          try {
            return await sdkSearch(CLIENT_KEY, query);
          } catch {
            // Se o SDK falhar em runtime, tenta o proxy
            return proxySearch(query);
          }
        }
        return proxySearch(query);
      },
      resolve: async (prediction: PlacePrediction) => {
        // Nominatim já vem resolvido
        if (prediction.resolved) return prediction.resolved;
        if (!prediction.placeId) return null;
        if (useSdk) {
          try {
            const r = await sdkResolve(CLIENT_KEY, prediction.placeId);
            if (r) return r;
          } catch {
            // cai no proxy
          }
        }
        return proxyResolve(prediction.placeId);
      },
    };
  }, [ready, loadError, mode]);
}
