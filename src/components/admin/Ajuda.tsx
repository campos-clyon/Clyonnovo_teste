"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * O «?» AO LADO DE UM TÍTULO — d81, 21-11-2026.
 *
 * «Demasiados textos longos»: as explicações saem do ecrã e ficam atrás de um
 * «?» pequeno, que abre o texto ao tocar. É um botão a sério (Tab, Enter,
 * Espaço); o texto fecha com Esc (o foco volta ao «?»), com outro toque no
 * «?» ou com um toque fora. No telemóvel ocupa a largura do bloco à volta —
 * o pai tem de ser `relative` —, para nunca sair do ecrã.
 */
export default function Ajuda({ sobre, children }: { sobre: string; children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (botao.current?.contains(alvo) || caixa.current?.contains(alvo)) return;
      setAberta(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberta(false);
      botao.current?.focus();
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberta]);

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        aria-controls={id}
        aria-label={`O que é: ${sobre}`}
        title={`O que é: ${sobre}`}
        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-600 text-[11px] font-bold leading-none text-slate-400 before:absolute before:-inset-2 before:content-[''] hover:border-cyan-500/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 aria-expanded:border-cyan-500/60 aria-expanded:text-white"
      >
        ?
      </button>
      {aberta && (
        <div
          ref={caixa}
          id={id}
          role="note"
          aria-label={sobre}
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-w-xl rounded-xl border border-slate-600 bg-slate-950 p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-300 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {children}
        </div>
      )}
    </>
  );
}
