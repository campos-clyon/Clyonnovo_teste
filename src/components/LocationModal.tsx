'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, MapPin, Loader2, Navigation, Search, Pencil } from 'lucide-react';
import { useLocation, CustomerLocation } from '@/contexts/LocationContext';
import { checkCoverage } from '@/lib/coverage';
import { useGooglePlaces, type PlacePrediction } from '@/hooks/useGooglePlaces';

interface LocationModalProps {
  onClose: () => void;
}

// O dropdown trabalha diretamente com as predictions do hook useGooglePlaces.
type Suggestion = PlacePrediction;

export default function LocationModal({ onClose }: LocationModalProps) {
  const { location: savedLocation, setLocation } = useLocation();
  const places = useGooglePlaces();

  // ── Estados SEPARADOS ──────────────────────────────────────────────────
  // Texto que o utilizador está a escrever (independente da seleção)
  const [searchQuery, setSearchQuery] = useState('');
  // Localização escolhida no modal (arranca com a guardada)
  const [selectedLocation, setSelectedLocation] = useState<CustomerLocation | null>(
    savedLocation ?? null,
  );
  const [predictions, setPredictions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noResults, setNoResults] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cobertura calculada a partir da localização SELECIONADA
  const coverage = selectedLocation
    ? checkCoverage({ city: selectedLocation.city, countryCode: selectedLocation.countryCode })
    : null;

  // O utilizador está a pesquisar algo novo?
  const isSearchingNew = searchQuery.trim().length > 0;

  // Aviso "fora de cobertura" só quando: há seleção confirmada, não aproximada,
  // fora de cobertura, sem pesquisa ativa e sem sugestões abertas.
  const showOutOfArea = Boolean(
    selectedLocation &&
      !selectedLocation.isApproximate &&
      coverage &&
      !coverage.covered &&
      !isSearchingNew &&
      predictions.length === 0 &&
      !searching,
  );

  // ── Pesquisa: SDK Google no cliente (modo Oscar) ou proxy servidor ─────
  const fetchPredictions = useCallback(
    async (input: string) => {
      if (input.trim().length < 3) {
        setPredictions([]);
        setNoResults(false);
        return;
      }
      setSearching(true);
      setNoResults(false);

      try {
        const results = await places.search(input);
        setPredictions(results);
        setNoResults(results.length === 0);
      } catch (err) {
        console.error('[LocationModal] Erro na pesquisa:', err);
        setPredictions([]);
        setNoResults(true);
      } finally {
        setSearching(false);
      }
    },
    [places],
  );

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(value), 300);
  };

  // ── Selecionar sugestão ────────────────────────────────────────────────
  const handleSelectPrediction = async (s: Suggestion) => {
    setError(null);
    setSelecting(true);
    setPredictions([]);
    try {
      const resolved = await places.resolve(s);
      if (resolved) {
        setSelectedLocation({
          formattedAddress: resolved.formattedAddress || s.description,
          city: resolved.city,
          postalCode: resolved.postalCode,
          countryCode: resolved.countryCode || undefined,
          lat: resolved.lat ?? undefined,
          lng: resolved.lng ?? undefined,
          label: resolved.city || s.mainText,
          source: 'manual',
          isApproximate: false,
        });
        setSearchQuery('');
        setNoResults(false);
      } else {
        setError('Não foi possível obter os detalhes desta morada.');
      }
    } catch (err) {
      console.error('[LocationModal] Erro nos detalhes:', err);
      setError('Não foi possível obter os detalhes desta morada.');
    } finally {
      setSelecting(false);
    }
  };

  // ── GPS ────────────────────────────────────────────────────────────────
  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada no seu navegador');
      return;
    }
    setGpsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch('/api/address/reverse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
          const data = await res.json();
          if (data.ok) {
            localStorage.removeItem('clyon_location_permission_denied');
            setSelectedLocation({
              formattedAddress: data.formattedAddress,
              city: data.city,
              postalCode: data.postalCode,
              lat: data.lat,
              lng: data.lng,
              label: data.city,
              source: 'gps',
              isApproximate: false,
            });
            setSearchQuery('');
            setPredictions([]);
            setNoResults(false);
          } else {
            setError(data.message || 'Erro ao obter endereço');
          }
        } catch (err) {
          console.error('[LocationModal] GPS erro:', err);
          setError('Erro ao processar localização');
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          const blockedByPolicy =
            typeof err.message === 'string' &&
            err.message.toLowerCase().includes('permissions policy');
          setError(
            blockedByPolicy
              ? 'A localização está bloqueada neste contexto. Abre o site diretamente em clyon.pt e tenta de novo, ou escreve a tua morada acima.'
              : 'Permissão de localização negada. Ativa a localização nas definições do navegador ou escreve a tua morada acima.',
          );
        } else if (err.code === err.TIMEOUT) {
          setError('Tempo esgotado ao obter localização');
        } else {
          setError('Erro ao obter localização');
        }
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  };

  // ── Limpar apenas o campo de pesquisa (não apaga a seleção) ────────────
  const handleClearInput = () => {
    setSearchQuery('');
    setPredictions([]);
    setNoResults(false);
    setError(null);
    inputRef.current?.focus();
  };

  // ── "Alterar localização" ──────────────────────────────────────────────
  const handleChangeLocation = () => {
    setSearchQuery('');
    setPredictions([]);
    setNoResults(false);
    setError(null);
    inputRef.current?.focus();
  };

  // ── Guardar ────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!selectedLocation) {
      setError('Escolhe uma sugestão ou usa a tua localização atual.');
      return;
    }
    setLocation(selectedLocation);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const showSelectedCard =
    selectedLocation && !isSearchingNew && predictions.length === 0 && !searching;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <MapPin className="h-5 w-5 text-cyan-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">A tua localização</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Insere o teu endereço para veres serviços e preços na tua área.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex flex-col p-6">
          {/* Input + dropdown de sugestões */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Endereço, cidade ou código postal..."
              className="w-full rounded-xl border-2 border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 shadow-sm transition focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={handleClearInput}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                aria-label="Limpar pesquisa"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Dropdown sobreposto (z alto para não ficar escondido) */}
            {(searching || predictions.length > 0 || (noResults && isSearchingNew)) && (
              <div className="absolute left-0 right-0 top-full z-[9999] mt-2 max-h-[280px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                {searching && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A procurar moradas...
                  </div>
                )}

                {!searching &&
                  predictions.map((p, idx) => (
                    <button
                      key={p.placeId || `nominatim-${idx}`}
                      onClick={() => handleSelectPrediction(p)}
                      className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {p.mainText}
                        </span>
                        {p.secondaryText && (
                          <span className="block truncate text-xs text-slate-500">
                            {p.secondaryText}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}

                {!searching && noResults && isSearchingNew && (
                  <p className="px-4 py-3 text-sm text-slate-400">
                    Nenhuma morada encontrada para &quot;{searchQuery}&quot;.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Localização selecionada */}
          {selecting && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              A obter detalhes da morada...
            </div>
          )}

          {showSelectedCard && !selecting && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">Localização selecionada</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
                    {selectedLocation?.formattedAddress ||
                      selectedLocation?.label ||
                      selectedLocation?.city}
                  </p>
                  {selectedLocation?.isApproximate && (
                    <p className="mt-1 text-xs text-slate-400">
                      Localização aproximada — escolhe uma morada exata para um orçamento preciso.
                    </p>
                  )}
                </div>
                <button
                  onClick={handleChangeLocation}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-cyan-700 transition hover:bg-cyan-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Alterar
                </button>
              </div>
            </div>
          )}

          {/* Botão GPS */}
          <button
            onClick={handleUseGPS}
            disabled={gpsLoading || selecting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {gpsLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A obter localização...
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4 text-cyan-600" />
                Usar localização atual
              </>
            )}
          </button>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {showOutOfArea && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Ainda não estamos na tua área… mas em breve!
              </p>
              <p className="mt-1.5 text-sm text-amber-800">
                Estamos a crescer rapidamente. Enquanto isso, experimenta procurar noutra
                localização acima.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {showOutOfArea ? 'Continuar a explorar' : 'Cancelar'}
          </button>
          <button
            onClick={handleSave}
            disabled={selecting || !selectedLocation}
            className="rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
