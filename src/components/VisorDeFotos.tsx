"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnexoGrande } from "./Anexo";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

/**
 * Ver a fotografia inteira.
 *
 * Nas listas as fotos aparecem cortadas — `object-cover` num quadrado, que é o
 * que faz uma grelha parecer arrumada. Só que é sobre a fotografia que se
 * decide o preço de uma recolha, e uma foto cortada esconde metade do que há
 * para levar: o sofá que está fora do enquadramento é o que faz a viagem
 * render menos do que devia.
 *
 * Aqui não se corta nada. `object-contain` sobre fundo escuro, o ecrã todo, e
 * setas para passar às seguintes sem ter de fechar e abrir outra vez.
 */

export default function VisorDeFotos({
  fotos,
  nomes,
  indiceInicial = 0,
  onFechar,
}: {
  fotos: string[];
  /** O nome de cada ficheiro, pela mesma ordem — diz a espécie quando a url não diz. */
  nomes?: string[];
  indiceInicial?: number;
  onFechar: () => void;
}) {
  const [i, setI] = useState(indiceInicial);
  const [montado, setMontado] = useState(false);
  /*
   * DESLIZAR NO TELEMÓVEL — d37, 15-11-2026. As setas são pequenas para um
   * polegar, e quem vê fotos num telemóvel passa-as com o dedo. Conta só um
   * gesto mais largo do que alto (senão é quem quer fazer zoom ou rolar) e
   * com pelo menos 50 px, para um toque não mudar de fotografia.
   */
  const inicioDoToque = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setMontado(true), []);

  const anterior = useCallback(
    () => setI((n) => (n - 1 + fotos.length) % fotos.length),
    [fotos.length],
  );
  const seguinte = useCallback(() => setI((n) => (n + 1) % fotos.length), [fotos.length]);

  // Escape fecha, setas navegam. Quem abre uma foto em ecrã inteiro espera
  // que o teclado funcione — e sem Escape a única saída é procurar o X.
  useEffect(() => {
    /*
     * NA CAPTURA, E SÓ PARA O VISOR — d37. O visor abre por cima de janelas
     * que também fecham com Escape (o pedido, o formulário de editar). Sem
     * isto, o Escape fechava a fotografia E a janela de trás, e perdia-se o
     * que se estava a editar.
     */
    function tecla(e: KeyboardEvent) {
      if (e.key !== "Escape" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.stopPropagation();
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") seguinte();
    }
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [onFechar, anterior, seguinte]);

  // A página por trás não deve rolar enquanto isto está aberto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  if (!montado || fotos.length === 0) return null;

  const url = fotos[i];
  const nome = nomes?.[i];
  /*
   * A ESPECIE DECIDE-SE NUM SITIO SO — ver `Anexo.tsx`.
   *
   * Aqui vivia uma expressao regular propria para os videos, e nao conhecia
   * PDFs: um PDF caia no `<img>` e dava o icone de imagem partida.
   */

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        inicioDoToque.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const ini = inicioDoToque.current;
        inicioDoToque.current = null;
        const t = e.changedTouches[0];
        if (!ini || !t || fotos.length < 2) return;
        const dx = t.clientX - ini.x;
        const dy = t.clientY - ini.y;
        if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
        if (dx < 0) seguinte();
        else anterior();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Fotografia em ecrã inteiro"
    >
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar"
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </button>

      {/*
        A ORIGINAL NUM SEPARADOR NOVO — para a ver com o zoom do browser, ou
        guardá-la. É o ficheiro tal como subiu, sem passar pelo optimizador.
      */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute left-3 top-3 z-10 flex h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        Abrir original
      </a>

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={anterior}
            aria-label="Anterior"
            className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="h-7 w-7" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={seguinte}
            aria-label="Seguinte"
            className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="h-7 w-7" aria-hidden="true" />
          </button>

          <span className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
            {i + 1} de {fotos.length}
          </span>
        </>
      )}

      <AnexoGrande key={url} url={url} nome={nome} />
    </div>,
    document.body,
  );
}
