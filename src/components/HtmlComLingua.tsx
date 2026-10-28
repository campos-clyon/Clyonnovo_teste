"use client";

import { useSelectedLayoutSegment } from "next/navigation";

/**
 * O <html> DO SITE, COM A LÍNGUA DA PÁGINA — 28-10-2026 (d1).
 *
 * As páginas /en declaravam lang="pt-PT" (o <html> do layout raiz era fixo) e
 * só o conteúdo ia marcado com lang="en". O leitor de ecrã lia o inglês com a
 * pronúncia portuguesa, e o Google via uma página inglesa a dizer que era
 * portuguesa, ao lado de um hreflang «en».
 *
 * O layout raiz não sabe em que endereço está sem `headers()`, e `headers()`
 * tornava dinâmicas TODAS as páginas do site. O segmento seleccionado logo
 * abaixo da raiz sabe — e lê-se no servidor, na renderização estática, sem
 * mexer na estrutura das pastas: «en» é inglês, tudo o resto é português.
 *
 * `suppressHydrationWarning`: o script do tema pode pôr `data-tema` no <html>
 * antes de o React acordar (ver layout.tsx). Vale só para este elemento.
 */
export const LINGUA_DAS_PAGINAS_EM_INGLES = "en";
export const LINGUA_DO_SITE = "pt-PT";

export function linguaDoSegmento(segmento: string | null): string {
  return segmento === "en" ? LINGUA_DAS_PAGINAS_EM_INGLES : LINGUA_DO_SITE;
}

export default function HtmlComLingua({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  const segmento = useSelectedLayoutSegment();
  return (
    <html lang={linguaDoSegmento(segmento)} className={className} suppressHydrationWarning>
      {children}
    </html>
  );
}
