"use client";

// Carrega o SDK JavaScript do Google Maps uma única vez e devolve uma promise
// que resolve quando `window.google.maps` está disponível.

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps só pode ser carregado no browser"));
  }

  // Já carregado
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY não configurada"));
  }

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&language=pt-PT&region=PT`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps carregou mas window.google.maps não existe"));
      }
    };
    script.onerror = () => reject(new Error("Falha ao carregar o script do Google Maps"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}
