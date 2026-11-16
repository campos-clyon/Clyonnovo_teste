"use client";

import { useEffect, useRef } from "react";

/**
 * OS CAMPOS COMPACTOS DA FOLHA — d49 (dono, 16-11-2026).
 *
 * *«O ecrã tem de ser compacto.»* Os números (horas, preço da hora, km,
 * deslocação, valor do material) cabem em 7 algarismos: um campo estreito, com
 * a unidade à direita, posto lado a lado com os outros. O texto livre (o
 * motivo) começa numa linha e cresce sozinho conforme se escreve.
 *
 * Usados na «Folha final da mudança» e no «Preencher a folha» da Mesa (d26).
 */

/** Até 7 algarismos («1234,50», «6h30»). */
export const MAXIMO_DO_NUMERO = 7;
/** Cabem 7 algarismos e um pouco de folga: ~9 caracteres. */
export const LARGURA_DO_NUMERO = "w-[9ch]";

const BASE =
  "rounded border border-slate-600 bg-slate-950 px-1.5 py-1 text-right text-xs tabular-nums text-white placeholder:text-slate-600";

export function CampoNumerico({
  valor,
  muda,
  unidade,
  placeholder,
  rotulo,
  decimal = true,
}: {
  valor: string;
  muda: (v: string) => void;
  /** «€», «h», «km»… à direita do campo. */
  unidade?: string;
  placeholder?: string;
  /** Para leitores de ecrã, quando o rótulo visível está noutro sítio. */
  rotulo?: string;
  /** Teclado numérico no telemóvel; falso nas horas, que aceitam «6h30». */
  decimal?: boolean;
}) {
  return (
    <span className="mt-1 inline-flex items-center gap-1">
      <input
        value={valor}
        onChange={(e) => muda(e.target.value)}
        maxLength={MAXIMO_DO_NUMERO}
        inputMode={decimal ? "decimal" : undefined}
        placeholder={placeholder}
        aria-label={rotulo}
        className={`${LARGURA_DO_NUMERO} ${BASE}`}
      />
      {unidade ? <span className="text-slate-400">{unidade}</span> : null}
    </span>
  );
}

/** Uma linha ao início; cresce sozinha com o que se escreve. */
export function TextoQueCresce({
  valor,
  muda,
  placeholder,
  maxLength,
}: {
  valor: string;
  muda: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valor]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={valor}
      onChange={(e) => muda(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="mt-1 block w-full resize-none overflow-hidden rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs leading-5 text-white"
    />
  );
}
