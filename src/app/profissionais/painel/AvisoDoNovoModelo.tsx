"use client";

import { useEffect, useState } from "react";

/**
 * A FAIXA DO AVISO DO NOVO MODELO — d11 (15-11-2026).
 *
 * Uma linha no topo do painel, com «Saber mais» (a página fixa) e «Completar o
 * perfil» (o IBAN e o MB WAY). Só aparece com «Mostrar o aviso do novo modelo»
 * ligado nas Configs — desligado por omissão.
 */
export default function AvisoDoNovoModelo({ onCompletarPerfil }: { onCompletarPerfil: () => void }) {
  const [aviso, setAviso] = useState<{ faixa: string; saberMais: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/profissionais/aviso-do-novo-modelo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { mostrar?: boolean; faixa?: string; saberMais?: string } | null) => {
        if (vivo && d?.mostrar && d.faixa && d.saberMais) setAviso({ faixa: d.faixa, saberMais: d.saberMais });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!aviso) return null;
  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
      <p>{aviso.faixa}</p>
      <div className="mt-2 flex flex-wrap gap-4 font-semibold">
        <a href={aviso.saberMais} className="underline">
          Saber mais
        </a>
        <button type="button" onClick={onCompletarPerfil} className="underline">
          Completar o perfil
        </button>
      </div>
    </div>
  );
}
