"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { loadGoogleMaps } from "@/lib/google-maps-loader";

interface LocationMapProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  className?: string;
}

// Centro por defeito: área metropolitana de Lisboa
const DEFAULT_CENTER = { lat: 38.7223, lng: -9.1393 };

export default function LocationMap({ lat, lng, className = "" }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState(false);

  const hasPin = typeof lat === "number" && typeof lng === "number";

  // Inicializar o mapa uma vez
  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const center = hasPin ? { lat: lat as number, lng: lng as number } : DEFAULT_CENTER;

        mapRef.current = new google.maps.Map(containerRef.current, {
          center,
          zoom: hasPin ? 15 : 11,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });

        if (hasPin) {
          markerRef.current = new google.maps.Marker({
            position: center,
            map: mapRef.current,
          });
        }
      })
      .catch((err) => {
        console.error("[LocationMap]", err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualizar centro/pin quando a localização muda
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    if (hasPin) {
      const position = { lat: lat as number, lng: lng as number };
      mapRef.current.panTo(position);
      mapRef.current.setZoom(15);

      if (markerRef.current) {
        markerRef.current.setPosition(position);
      } else {
        markerRef.current = new window.google.maps.Marker({
          position,
          map: mapRef.current,
        });
      }
    }
  }, [lat, lng, hasPin]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400 ${className}`}
      >
        <MapPin className="h-6 w-6" />
        <span className="text-xs">Mapa indisponível</span>
      </div>
    );
  }

  return <div ref={containerRef} className={className} aria-label="Mapa da localização" />;
}
