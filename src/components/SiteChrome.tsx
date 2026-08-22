"use client";

import { usePathname } from "next/navigation";

import CoverageNotice from "@/components/CoverageNotice";
import DeferredCookieConsent from "@/components/DeferredCookieConsent";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";

// Rotas sem chrome global: landings de conversão (Google Ads) e o backoffice.
// O /admin tem cabeçalho próprio (BACKOFFICE CLYON, com os separadores e a
// conta) — sobrepor-lhe o header público roubava altura e duplicava navegação
// que o operador não usa.
const BARE_ROUTES = ["/orcamento-recolha-lisboa", "/admin"];

/**
 * Rotas internas (dashboard) que usam apenas o Header — sem Footer nem barra
 * inferior.
 *
 * O rodapé é da página de marketing: serviços, cobertura, "peça orçamento".
 * Numa conta já iniciada não serve para nada, e num painel a carregar era o que
 * se via — subia até ao meio do ecrã com o vazio por baixo, e parecia avaria.
 *
 * A entrada e a inscrição dos profissionais NÃO estão aqui: essas ainda são
 * páginas onde alguém chega de fora, e aí o rodapé faz o seu trabalho.
 */
const DASHBOARD_ROUTES = [
  "/admin",
  "/simulador",
  "/conta",
  "/plataforma",
  "/profissionais/painel",
  "/profissionais/pedidos",
  "/pedido",
];

/**
 * SALTAR PARA O CONTEÚDO.
 *
 * Primeiro elemento focável da página, e invisível até alguém carregar em Tab.
 * Sem ele, quem navega por teclado tinha de atravessar o selector de
 * localidade, o menu Soluções com as suas oito entradas, os quatro links de
 * navegação, o WhatsApp e o botão de conta — em TODAS as páginas, antes de
 * chegar ao texto.
 */
const saltarParaOConteudo = (
  <a
    href="#conteudo"
    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-acao focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
  >
    Saltar para o conteúdo
  </a>
);

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isBare = BARE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const isDashboard = DASHBOARD_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isBare) {
    return <main className="site-page-shell">{children}</main>;
  }

  if (isDashboard) {
    return (
      <>
        {saltarParaOConteudo}
        <Header />
        <main id="conteudo" className="site-page-shell pt-[53px] sm:pt-[61px]">{children}</main>
      </>
    );
  }

  return (
    <>
      {saltarParaOConteudo}
      <Header />
      {/* pb no mobile para o conteúdo não ficar escondido atrás da barra de navegação */}
      <main id="conteudo" className="site-page-shell pt-[53px] sm:pt-[61px] pb-[72px] lg:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      <DeferredCookieConsent />
      <CoverageNotice />
    </>
  );
}
