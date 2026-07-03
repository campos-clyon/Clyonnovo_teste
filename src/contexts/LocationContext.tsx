'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AddressData } from '@/app/simulador/types';
import { checkCoverage, type CoverageResult } from '@/lib/coverage';

export type LocationSource = 'manual' | 'gps' | 'account' | 'ip';

export type LocationStatus =
  | 'loading'
  | 'detected'
  | 'manual'
  | 'gps'
  | 'account'
  | 'unknown';

// CustomerLocation estende AddressData com informação de origem e aproximação
export interface CustomerLocation extends AddressData {
  source?: LocationSource;
  /** Texto para mostrar no header (ex: "Lisboa" ou "Portugal") */
  label?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  /** true quando a localização é aproximada (ex: por IP) e não uma morada exata */
  isApproximate?: boolean;
}

interface LocationContextType {
  location: CustomerLocation | null;
  setLocation: (location: CustomerLocation | null) => void;
  isLoading: boolean;
  locationStatus: LocationStatus;
  coverage: CoverageResult | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const STORAGE_KEY = 'clyon_customer_location';

function isDev() {
  return process.env.NODE_ENV !== 'production';
}

/** Deriva o label a mostrar no header a partir da localização */
function deriveLabel(loc: CustomerLocation): string {
  if (loc.label) return loc.label;
  if (loc.city) return loc.city;
  if (loc.formattedAddress) return loc.formattedAddress.split(',')[0] || 'Localização';
  if (loc.country) return loc.country;
  return 'Localização';
}

/** Deriva o status a partir da origem da localização */
function statusFromLocation(loc: CustomerLocation | null): LocationStatus {
  if (!loc) return 'unknown';
  switch (loc.source) {
    case 'manual':
      return 'manual';
    case 'gps':
      return 'gps';
    case 'account':
      return 'account';
    case 'ip':
      return 'detected';
    default:
      return loc.isApproximate ? 'detected' : 'manual';
  }
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<CustomerLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initializeLocation() {
      if (isDev()) console.log('[Location] provider mounted');

      try {
        // 1. localStorage (morada manual / gps / conta / aproximada guardada)
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isDev()) {
          console.log('[Location] localStorage location:', stored ? JSON.parse(stored) : null);
        }

        if (stored) {
          const parsed = JSON.parse(stored) as CustomerLocation;
          if (!cancelled) {
            setLocationState(parsed);
            setLocationStatus(statusFromLocation(parsed));
            setIsLoading(false);
          }
          return;
        }

        // 2. Conta do utilizador (best-effort, só se logado)
        try {
          const meRes = await fetch('/api/users/me', { cache: 'no-store' });
          if (meRes.ok) {
            const me = await meRes.json();
            const addr = me?.user?.address || me?.address;
            if (addr && (addr.formattedAddress || addr.city)) {
              const accountLoc: CustomerLocation = {
                ...addr,
                source: 'account',
                label: addr.city || addr.formattedAddress,
                isApproximate: false,
              };
              if (isDev()) console.log('[Location] account location:', accountLoc);
              if (!cancelled) {
                setLocationState(accountLoc);
                setLocationStatus('account');
                setIsLoading(false);
              }
              return;
            }
          }
        } catch {
          // sem conta / endpoint indisponível — continua para IP guess
        }

        // 3. Localização aproximada por IP
        if (isDev()) console.log('[Location] requesting IP guess');
        const guessRes = await fetch('/api/location/guess', { cache: 'no-store' });
        const guess = await guessRes.json();
        if (isDev()) console.log('[Location] IP guess result:', guess);

        if (guess?.ok && !cancelled) {
          const ipLoc: CustomerLocation = {
            city: guess.city,
            country: guess.country,
            countryCode: guess.countryCode,
            region: guess.region,
            label: guess.label,
            source: 'ip',
            isApproximate: true,
          };
          setLocationState(ipLoc);
          setLocationStatus('detected');
          // Guardar a aproximação para carregamentos futuros
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ipLoc));
          } catch {
            /* ignore */
          }
          setIsLoading(false);
          return;
        }

        // 4. Nada encontrado
        if (!cancelled) {
          setLocationStatus('unknown');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[Location] initialization error:', err);
        if (!cancelled) {
          setLocationStatus('unknown');
          setIsLoading(false);
        }
      }
    }

    initializeLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  // Guardar no localStorage quando mudar (via ação do utilizador)
  const setLocation = (newLocation: CustomerLocation | null) => {
    setLocationState(newLocation);
    setLocationStatus(statusFromLocation(newLocation));
    try {
      if (newLocation) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.error('[Location] erro ao guardar no localStorage:', err);
    }
  };

  const coverage = location
    ? checkCoverage({ city: location.city, countryCode: location.countryCode })
    : null;

  return (
    <LocationContext.Provider
      value={{ location, setLocation, isLoading, locationStatus, coverage }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation deve ser usado dentro de LocationProvider');
  }
  return context;
}

export { deriveLabel };
