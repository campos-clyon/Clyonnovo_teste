"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AddressData, AddressStatus, DistanceFromBase, DistanceStatus } from "../types";
import { useLocation } from "@/contexts/LocationContext";

interface AddressSuggestion {
  id: string;
  address: string;
  city: string;
  postalCode: string;
  /** Google Places: precisa de /api/maps/place-details para obter lat/lng */
  placeId?: string;
  /** Nominatim (fallback): já vem com coordenadas resolvidas */
  resolved?: AddressData;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (data: AddressData) => void;
  onDistanceCalculated?: (distance: DistanceFromBase, status: DistanceStatus) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onDistanceCalculated,
  placeholder = "Escreva a rua, número e localidade...",
  className = "",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { setLocation } = useLocation();

  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addressStatus, setAddressStatus] = useState<AddressStatus>("empty");
  const [selectedAddress, setSelectedAddress] = useState<AddressData | null>(null);

  // ── Fechar dropdown ao clicar fora ──────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Buscar endereços no servidor: Google Places → fallback Nominatim ───
  const fetchAddresses = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);

    try {
      let results: AddressSuggestion[] = [];

      // 1) Google Places (cobre ruas e cidades isoladas)
      try {
        const res = await fetch("/api/maps/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: query }),
        });
        if (res.ok) {
          const data = await res.json();
          results = (data.predictions || []).map(
            (p: { placeId: string; description: string; mainText: string; secondaryText: string }) => ({
              id: p.placeId,
              address: p.mainText || p.description,
              city: p.secondaryText,
              postalCode: "",
              placeId: p.placeId,
            }),
          );
        }
      } catch {
        // ignora — cai no fallback
      }

      // 2) Fallback Nominatim se o Google não devolver nada (ex: chave em falta)
      if (results.length === 0) {
        const res = await fetch(`/api/address/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        results = (data.suggestions || []).map(
          (
            s: { label: string; address: string; city: string; postalCode: string; lat: number; lng: number },
            idx: number,
          ) => ({
            id: `nominatim-${idx}`,
            address: s.address || s.city || s.label,
            city: s.city,
            postalCode: s.postalCode,
            resolved: {
              formattedAddress: s.label,
              city: s.city,
              postalCode: s.postalCode,
              lat: s.lat,
              lng: s.lng,
            },
          }),
        );
      }

      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } catch (error) {
      console.error("[AddressAutocomplete] Erro ao buscar endereços:", error);
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Debounce da input ──────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);

    // Reset status
    if (addressStatus === "selected" || addressStatus === "manual_confirmed") {
      setAddressStatus("typing");
      setSelectedAddress(null);
    } else {
      setAddressStatus(v.length > 0 ? "typing" : "empty");
    }

    // Debounce fetch
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAddresses(v);
    }, 300);
  };

  // ── Selecionar sugestão e calcular distância da base ──────────────────────
  const handleSelectSuggestion = async (suggestion: AddressSuggestion) => {
    setSuggestions([]);
    setShowDropdown(false);

    let addressData: AddressData;

    if (suggestion.resolved) {
      // Nominatim: já vem com coordenadas
      addressData = suggestion.resolved;
    } else if (suggestion.placeId) {
      // Google: obter detalhes (lat/lng) antes de continuar
      setLoading(true);
      try {
        const res = await fetch("/api/maps/place-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId: suggestion.placeId }),
        });
        const data = await res.json();
        if (!data.ok) {
          console.error("[AddressAutocomplete] place-details falhou:", data.error);
          setLoading(false);
          return;
        }
        addressData = {
          formattedAddress: data.formattedAddress,
          city: data.city,
          postalCode: data.postalCode,
          lat: data.lat,
          lng: data.lng,
          placeId: suggestion.placeId,
        };
      } catch (error) {
        console.error("[AddressAutocomplete] Erro ao obter detalhes da morada:", error);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    } else {
      return;
    }

    const label = addressData.formattedAddress || suggestion.address;

    onChange(label);
    setSelectedAddress(addressData);
    setAddressStatus("selected");

    // Guardar localização no contexto global (para reutilização em header)
    setLocation(addressData);

    // Chamar callback do componente pai com os dados da morada
    onSelect(addressData);

    // Mostrar "A calcular distância..." no resumo lateral
    if (typeof onDistanceCalculated === "function") {
      onDistanceCalculated({}, "calculating");
    }

    // Calcular distância da base CLYON (assíncrono, não bloqueia)
    try {
      const res = await fetch("/api/maps/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: {
            formattedAddress: label,
            lat: addressData.lat,
            lng: addressData.lng,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        // Sucesso
        console.log("[v0] Distance calculated:", { distanceKm: data.distanceKm, duration: data.durationText });
        if (typeof onDistanceCalculated === "function") {
          onDistanceCalculated({
            distanceMeters: data.distanceMeters,
            distanceKm: data.distanceKm,
            durationSeconds: data.durationSeconds,
            durationText: data.durationText,
            calculatedAt: new Date().toISOString(),
          }, "calculated");
        }
      } else if (!data.ok) {
        // Erro estruturado (status 200 mas ok: false)
        console.error("[v0] Distance API error:", { 
          error: data.error, 
          details: data.details, 
          debugInfo: data.debugInfo,
          message: data.customerMessage 
        });
        if (typeof onDistanceCalculated === "function") {
          onDistanceCalculated({}, "error");
        }
      } else {
        // Erro de rede ou JSON parsing
        console.error("[v0] Distance fetch HTTP error:", res.status);
        if (typeof onDistanceCalculated === "function") {
          onDistanceCalculated({}, "error");
        }
      }
    } catch (err) {
      // Network error — marcar como erro
      console.error("[v0] Distance fetch failed:", err instanceof Error ? err.message : String(err));
      if (typeof onDistanceCalculated === "function") {
        onDistanceCalculated({}, "error");
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full px-4 py-2 border-2 border-gray-400 bg-white rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 shadow-sm"
      />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
          <div className="animate-spin">◐</div>
        </div>
      )}

      {/* Dropdown com sugestões */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseDown={(e) => e.preventDefault()}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="font-medium text-slate-900">{suggestion.address}</div>
              <div className="text-sm text-slate-500">
                {suggestion.city}
                {suggestion.postalCode && ` • ${suggestion.postalCode}`}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mensagem se não houver resultados */}
      {showDropdown && suggestions.length === 0 && !loading && value.trim().length >= 3 && (
        <div className="absolute z-[9999] left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-sm text-slate-500">
          Nenhuma morada encontrada para "{value}"
        </div>
      )}
    </div>
  );
}
