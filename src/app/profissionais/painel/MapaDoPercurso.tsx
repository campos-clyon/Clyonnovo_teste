"use client";

import { useState } from "react";
import { Navigation } from "lucide-react";
import type { PercursoParaOParceiro } from "@/lib/mapa-do-percurso";

/**
 * O MAPA DO PERCURSO DE UMA MUDANÇA, NO PAINEL — 11-11-2026.
 *
 * Uma imagem estática servida pelo site (a chave da Google não sai do
 * servidor), «X km · cerca de Y min» e «Abrir no Google Maps». Antes de ser
 * contratado só as localidades; depois, porta a porta. Ver mapa-do-percurso.ts.
 */
export function MapaDoPercurso({ percurso }: { percurso: PercursoParaOParceiro }) {
  const [semMapa, setSemMapa] = useState(false);
  return (
    <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-cyan-200">
      {!semMapa && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={percurso.mapa}
          alt=""
          className="h-40 w-full bg-cyan-100/50 object-cover"
          loading="lazy"
          onError={() => setSemMapa(true)}
        />
      )}
      <div className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-sm">
        <span className="font-semibold text-slate-800">
          {percurso.deOndeParaOnde ? `${percurso.deOndeParaOnde} · ` : ""}
          {percurso.texto}
        </span>
        {percurso.direccoes && (
          <a
            href={percurso.direccoes}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 font-bold text-cyan-900"
          >
            <Navigation className="h-4 w-4" aria-hidden="true" />
            Abrir no Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
