"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { cliqueJaMedido, trackPhoneCall, trackWhatsAppClick } from "@/lib/analytics";
import { codigoDeOrigem, comCodigoDeOrigem } from "@/lib/codigo-de-origem";
import { guardarOrigemDaVisita, origemDaVisita } from "@/lib/origem-da-visita";
import { registarPagina } from "@/lib/pagina-anterior";
import { TELEFONE_DA_CLYON_DIGITOS } from "@/lib/telefone-da-clyon";

/** O WhatsApp da CLYON. Só as conversas connosco levam o código de origem. */
const NOSSO_WHATSAPP = TELEFONE_DA_CLYON_DIGITOS;

/*
 * O código de origem na mensagem — ver codigo-de-origem.ts (22-10-2026).
 * Mexe-se no endereço no próprio clique, antes de o browser o seguir, para
 * valer em todos os botões do site sem tocar em nenhum.
 */
function juntarCodigoDeOrigem(ligacao: Element) {
  const href = ligacao.getAttribute("href") ?? "";
  if (!href.includes(NOSSO_WHATSAPP)) return;
  try {
    const url = new URL(href, window.location.href);
    const texto = url.searchParams.get("text") ?? "Olá! Gostava de pedir um orçamento à CLYON.";
    url.searchParams.set("text", comCodigoDeOrigem(texto, codigoDeOrigem(origemDaVisita(), window.location.pathname)));
    ligacao.setAttribute("href", url.toString());
  } catch {
    /* endereço estranho: segue como estava */
  }
}

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
  /*
   * 3. Regista a página anterior, para a candidatura dizer de onde veio quem a
   *    envia (31-10-2026, d6 de 28-10) — ver pagina-anterior.ts.
   */
  const caminho = usePathname();
  useEffect(() => {
    if (caminho) registarPagina(caminho);
  }, [caminho]);

  useEffect(() => {
    guardarOrigemDaVisita();

    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target as Element | null;
      const ligacao = alvo?.closest?.('a[href^="tel:"], a[href*="wa.me/"], a[href*="api.whatsapp.com/"]');
      if (!ligacao) return;
      if (!ligacao.getAttribute("href")?.startsWith("tel:")) juntarCodigoDeOrigem(ligacao);
      if (cliqueJaMedido()) return;
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
