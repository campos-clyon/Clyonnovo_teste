"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackLeadEvent } from "@/lib/track-contact";

/**
 * Regista cada página vista na nossa própria base.
 *
 * O Google Analytics já recebia isto, mas o backoffice não: a análise de
 * tráfego dependia de uma conta externa, e não se podia cruzar uma visita com
 * o lead que dela nasceu — que é a pergunta que interessa ("de que página vêm
 * os pedidos?").
 *
 * Cuidados deliberados:
 *   · não regista o painel nem a área de conta do cliente. Saber que páginas
 *     um administrador abriu não é análise de tráfego, é vigilância;
 *   · a query string fica de fora do caminho. Só se guardam as UTM, que o
 *     trackLeadEvent já extrai — um `?email=` numa ligação partilhada não
 *     tem de ir parar à base;
 *   · não repete o mesmo caminho duas vezes seguidas. O Next volta a correr
 *     este efeito em navegações que não mudam de página, e sem isto a mesma
 *     visita contava várias vezes.
 */

/** Prefixos que nunca são registados. */
const PRIVADOS = ["/admin", "/conta", "/api"];

export default function PageViewTracker() {
  const pathname = usePathname();
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (PRIVADOS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    if (anterior.current === pathname) return;
    anterior.current = pathname;

    trackLeadEvent({
      type: "page_view",
      action: "Página vista",
      sourcePage: pathname,
      label: document.referrer || undefined,
    });
  }, [pathname]);

  return null;
}
