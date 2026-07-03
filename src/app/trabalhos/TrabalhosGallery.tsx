"use client";

import { useState } from "react";
import Image from "next/image";
import type { TrabalhoRealizadoData } from "@/lib/db";
import { tService } from "@/lib/translations";

const SERVICE_TYPES = [
  { value: "recolha_moveis",           label: "Recolha de móveis" },
  { value: "recolha_monos",            label: "Recolha de monos" },
  { value: "recolha_entulho",          label: "Recolha de entulho" },
  { value: "esvaziamento_casa",        label: "Esvaziamento de casa" },
  { value: "esvaziamento_apartamento", label: "Esvaziamento de apartamento" },
  { value: "mudanca",                  label: "Mudança" },
  { value: "outro",                    label: "Outro serviço" },
];

interface Props {
  trabalhos: TrabalhoRealizadoData[];
}

export default function TrabalhosGallery({ trabalhos }: Props) {
  const [filtro, setFiltro]         = useState<string>("todos");
  const [lightbox, setLightbox]     = useState<{ fotos: string[]; idx: number } | null>(null);

  // Tipos com pelo menos 1 trabalho
  const tiposPresentes = SERVICE_TYPES.filter((st) =>
    trabalhos.some((t) => t.tipoServico === st.value)
  );

  const filtered = filtro === "todos"
    ? trabalhos
    : trabalhos.filter((t) => t.tipoServico === filtro);

  // Lightbox navigation
  function openLightbox(fotos: string[], idx: number) {
    setLightbox({ fotos, idx });
  }
  function closeLightbox() { setLightbox(null); }
  function prevPhoto() {
    if (!lightbox) return;
    setLightbox({ fotos: lightbox.fotos, idx: (lightbox.idx - 1 + lightbox.fotos.length) % lightbox.fotos.length });
  }
  function nextPhoto() {
    if (!lightbox) return;
    setLightbox({ fotos: lightbox.fotos, idx: (lightbox.idx + 1) % lightbox.fotos.length });
  }

  return (
    <>
      {/* Filtros */}
      {tiposPresentes.length > 1 && (
        <div className="mb-10 flex flex-wrap gap-2">
          <button
            onClick={() => setFiltro("todos")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              filtro === "todos"
                ? "bg-[#00B4D8] text-white shadow-[0_4px_14px_rgba(0,180,216,0.35)]"
                : "border border-cyan-200/50 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
            }`}
          >
            Todos ({trabalhos.length})
          </button>
          {tiposPresentes.map((st) => {
            const count = trabalhos.filter((t) => t.tipoServico === st.value).length;
            return (
              <button
                key={st.value}
                onClick={() => setFiltro(st.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  filtro === st.value
                    ? "bg-[#00B4D8] text-white shadow-[0_4px_14px_rgba(0,180,216,0.35)]"
                    : "border border-cyan-200/50 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                }`}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-500">
          Ainda não há trabalhos nesta categoria.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((trabalho) => {
            const thumb = trabalho.fotos[0];
            return (
              <article
                key={trabalho.id}
                className="group overflow-hidden rounded-[28px] border border-cyan-100 bg-white shadow-[0_12px_40px_-20px_rgba(14,116,144,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-20px_rgba(14,116,144,0.24)]"
              >
                {/* Foto */}
                <button
                  className="relative block h-56 w-full overflow-hidden bg-slate-100"
                  onClick={() => thumb && openLightbox(trabalho.fotos, 0)}
                  aria-label={`Ver fotos — ${tService(trabalho.tipoServico)}`}
                >
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt={`${tService(trabalho.tipoServico)} — ${trabalho.localidade}`}
                      fill
                      className="object-cover transition-transform group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Contador */}
                  {trabalho.fotos.length > 1 && (
                    <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl bg-black/50 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM5 7h14v10H5V7z" />
                      </svg>
                      {trabalho.fotos.length}
                    </span>
                  )}
                </button>

                {/* Info */}
                <div className="p-5">
                  <div className="mb-2 inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#0077B6]">
                    {tService(trabalho.tipoServico)}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {trabalho.localidade}
                  </div>
                  {trabalho.descricao && (
                    <p className="mt-3 text-sm leading-6 text-slate-600 line-clamp-2">{trabalho.descricao}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div
            className="relative mx-4 max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[24px]">
              <Image
                src={lightbox.fotos[lightbox.idx]}
                alt="Foto ampliada"
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>
            {/* Controls */}
            <button
              onClick={closeLightbox}
              className="absolute -top-4 -right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              aria-label="Fechar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {lightbox.fotos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                  aria-label="Foto anterior"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                  aria-label="Próxima foto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <p className="mt-3 text-center text-sm text-white/60">
                  {lightbox.idx + 1} / {lightbox.fotos.length}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
