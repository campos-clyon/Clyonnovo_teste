'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLocation } from '@/contexts/LocationContext';
import LocationModal from './LocationModal';

const SESSION_KEY = 'clyon_coverage_notice_shown';

/**
 * Mostra automaticamente (uma vez por sessão) um aviso amigável quando a
 * localização detetada está fora da área de cobertura da CLYON.
 */
export default function CoverageNotice() {
  const { location, locationStatus, coverage, isLoading } = useLocation();
  const [showNotice, setShowNotice] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (locationStatus !== 'detected') return;
    if (!location || !coverage) return;
    if (coverage.covered) return;

    // Só mostrar uma vez por sessão
    try {
      if (sessionStorage.getItem(SESSION_KEY) === 'true') return;
      sessionStorage.setItem(SESSION_KEY, 'true');
    } catch {
      /* ignore */
    }

    setShowNotice(true);
  }, [isLoading, locationStatus, location, coverage]);

  if (showModal) {
    return <LocationModal onClose={() => setShowModal(false)} />;
  }

  if (!showNotice) return null;

  const areaLabel = location?.label || location?.city || location?.country || 'a tua área';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900 text-pretty">
            Ainda não estamos na tua área… mas em breve!
          </h2>
          <button
            onClick={() => setShowNotice(false)}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          Detetámos que estás em <span className="font-medium text-slate-800">{areaLabel}</span>.
          Estamos a crescer rapidamente e esperamos estar na tua área em breve. Enquanto isso,
          experimenta procurar noutra localização.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => setShowNotice(false)}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Continuar a explorar
          </button>
          <button
            onClick={() => {
              setShowNotice(false);
              setShowModal(true);
            }}
            className="flex-1 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-700"
          >
            Experimenta outra localização
          </button>
        </div>
      </div>
    </div>
  );
}
