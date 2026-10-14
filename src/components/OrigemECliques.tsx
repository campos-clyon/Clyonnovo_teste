"use client";

import { useEffect } from "react";

import { cliqueJaMedido, trackPhoneCall, trackWhatsAppClick } from "@/lib/analytics";
import { guardarOrigemDaVisita } from "@/lib/origem-da-visita";

/*
 * DE ONDE VEIO A VISITA, E OS CLIQUES DE CONTACTO — 14-10-2026.
 *
 * Duas coisas que valem para o site inteiro, por isso vivem aqui, uma vez:
 *
 * 1. Guarda a origem da visita (campanha, gclid, site que a mandou), para ir
 *    com o pedido. Ver origem-da-visita.ts.
 *
 * 2. Mede os cliques em «Ligar» e em WhatsApp que nenhum botão mede. Só a
 *    barra do telemóvel, o cabeçalho, os contactos e a página dos anúncios
 *    contavam os seus; as 102 páginas de cidade, o rodapé e a página inicial
 *    não contavam nada. Quem já mediu o seu (o onClick do próprio botão corre
 *    antes deste ouvinte) não conta duas vezes — ver `cliqueJaMedido`.
 */
export default function OrigemECliques() {
  useEffect(() => {
    guardarOrigemDaVisita();

    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target as Element | null;
      const ligacao = alvo?.closest?.('a[href^="tel:"], a[href*="wa.me/"], a[href*="api.whatsapp.com/"]');
      if (!ligacao || cliqueJaMedido()) return;
      const href = ligacao.getAttribute("href") ?? "";
      const onde = `pagina:${window.location.pathname}`;
      if (href.startsWith("tel:")) trackPhoneCall(onde, href.slice(4));
      else trackWhatsAppClick(onde);
    }

    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, []);

  return null;
}
