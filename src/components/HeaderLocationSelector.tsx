'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocation, deriveLabel } from '@/contexts/LocationContext';
import LocationModal from './LocationModal';

export default function HeaderLocationSelector() {
  const { location, isLoading, locationStatus } = useLocation();
  const [showModal, setShowModal] = useState(false);

  // Texto principal a mostrar
  let display: string;
  if (isLoading || locationStatus === 'loading') {
    display = 'A carregar...';
  } else if (location) {
    display = deriveLabel(location);
  } else {
    display = 'Definir localização';
  }

  // Desktop trunca a 25, mobile trunca a 18
  const desktopText = display.length > 25 ? display.substring(0, 22) + '...' : display;
  const mobileText = display.length > 18 ? display.substring(0, 15) + '...' : display;

  return (
    <>
      {/* Desktop: cartão estilo Oscar */}
      <button
        onClick={() => setShowModal(true)}
        className="group hidden lg:flex h-14 w-[210px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-left transition hover:bg-slate-50"
        title="Alterar localização"
      >
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">Localização</div>
          <div className="truncate text-sm font-bold text-slate-900">{desktopText}</div>
        </div>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-700" />
      </button>

      {/* Mobile: compacto de uma linha */}
      <button
        onClick={() => setShowModal(true)}
        className="lg:hidden inline-flex max-w-[130px] items-center gap-1 truncate text-sm font-semibold text-slate-800 transition hover:text-cyan-600"
        title="Alterar localização"
      >
        <span className="truncate">{mobileText}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {showModal && <LocationModal onClose={() => setShowModal(false)} />}
    </>
  );
}
