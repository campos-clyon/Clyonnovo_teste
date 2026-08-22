'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocation, deriveLabel } from '@/contexts/LocationContext';
import LocationModal from './LocationModal';

/**
 * O selector de localidade do cabeçalho.
 *
 * PORQUE É QUE ISTO DEIXOU DE ESCREVER "A CARREGAR…"
 *
 * Escrevia literalmente `'A carregar...'` enquanto o LocationContext
 * resolvia. Como é um Client Component dentro de um cabeçalho fixo, esse
 * texto entrava no HTML servido e ficava visível até à hidratação — em 4G
 * lenta, um segundo ou mais.
 *
 * Ou seja: a primeira palavra que alguém lia depois de clicar no resultado do
 * Google era "A carregar", antes de o logótipo ter sequer sentido. Andaimes à
 * vista são o sinal mais barato de site inacabado, e este estava no primeiro
 * elemento acima da dobra.
 *
 * Em vez de texto sobre o carregamento, uma barra cinzenta com a largura do
 * texto final e `aria-hidden` — o leitor de ecrã não anuncia nada, e o
 * conteúdo real substitui-a sem empurrar o resto do cabeçalho para o lado.
 * A largura fixa dos dois botões existe pela mesma razão: sem ela, o texto a
 * chegar mudava a largura e o cabeçalho saltava.
 */

/** A barra que ocupa o lugar do texto enquanto ele não existe. */
function Esqueleto({ largura }: { largura: string }) {
  return (
    <span
      aria-hidden="true"
      className="block h-3.5 animate-pulse rounded bg-[#E3EAEF]"
      style={{ width: largura }}
    />
  );
}

export default function HeaderLocationSelector() {
  const { location, isLoading, locationStatus } = useLocation();
  const [showModal, setShowModal] = useState(false);

  const aCarregar = isLoading || locationStatus === 'loading';

  // Texto principal a mostrar. Nunca uma palavra sobre o carregamento: quando
  // ainda não há resposta, quem decide o que aparece é o <Esqueleto/>.
  const display = location ? deriveLabel(location) : 'Definir localização';

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
        aria-label={aCarregar ? 'A determinar a localização' : `Localização: ${display}`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-[#5A6B78]">Localização</div>
          {aCarregar ? (
            <Esqueleto largura="96px" />
          ) : (
            <div className="truncate text-sm font-bold text-slate-900">{desktopText}</div>
          )}
        </div>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-700" />
      </button>

      {/* Mobile: compacto de uma linha.
          `min-w` e não só `max-w`: a largura tem de estar reservada antes de o
          texto chegar, senão o cabeçalho salta na hidratação. */}
      <button
        onClick={() => setShowModal(true)}
        className="lg:hidden inline-flex min-h-[44px] w-[130px] items-center gap-1 truncate text-sm font-semibold text-slate-800 transition hover:text-[#007A8C]"
        title="Alterar localização"
        aria-label={aCarregar ? 'A determinar a localização' : `Localização: ${display}`}
      >
        {aCarregar ? (
          <Esqueleto largura="82px" />
        ) : (
          <span className="truncate">{mobileText}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {showModal && <LocationModal onClose={() => setShowModal(false)} />}
    </>
  );
}
