"use client";

import { usePathname } from "next/navigation";

import CoverageNotice from "@/components/CoverageNotice";
import DeferredCookieConsent from "@/components/DeferredCookieConsent";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";

// Rotas de landing de conversão (Google Ads) que não usam o chrome global
const BARE_ROUTES = ["/orcamento-recolha-lisboa"];

// Rotas internas (dashboard) que usam apenas o Header — sem Footer nem barra inferior
const DASHBOARD_ROUTES = ["/colaboradores", "/simulador", "/conta"];

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
        <Header />
        <main className="site-page-shell pt-[53px] sm:pt-[61px]">{children}</main>
      </>
    );
  }

  return (
    <>
      <Header />
      {/* pb no mobile para o conteúdo não ficar escondido atrás da barra de navegação */}
      <main className="site-page-shell pt-[53px] sm:pt-[61px] pb-[72px] md:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      <DeferredCookieConsent />
      <CoverageNotice />
    </>
  );
}
