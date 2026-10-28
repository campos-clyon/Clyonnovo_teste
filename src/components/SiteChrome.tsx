"use client";

import { usePathname } from "next/navigation";

import DeferredCookieConsent from "@/components/DeferredCookieConsent";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import CabecalhoDoProfissional from "@/components/portal/CabecalhoDoProfissional";
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
/*
 * A ÁREA DE TRABALHO DO PROFISSIONAL leva o cabeçalho dela — sem o WhatsApp
 * nem o menu dos clientes (07-10-2026). Ver `CabecalhoDoProfissional`.
 */
const ROTAS_DO_PROFISSIONAL = ["/profissionais/painel", "/profissionais/pedidos"];

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
  anoEmLisboa,
}: {
  children: React.ReactNode;
  /** O ano do rodapé, contado pelo layout no servidor — ver layout.tsx. */
  anoEmLisboa: number;
}) {
  const pathname = usePathname();

  const isBare = BARE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const isDashboard = DASHBOARD_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const doProfissional = ROTAS_DO_PROFISSIONAL.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  /*
   * A FAIXA DE COOKIES TAMBÉM AQUI (14-10-2026) — na página dos anúncios, no
   * simulador e nas áreas do cliente. Sem resposta a ela, o Google Ads e o
   * Analytics funcionam sem cookies (modo avançado desde 20-10-2026, ver
   * RastreioConsentido). Fora ficam o backoffice e o painel
   * do profissional: são equipa, não visitantes.
   */
  const semFaixa = pathname === "/admin" || pathname.startsWith("/admin/") || doProfissional;

  if (isBare) {
    return (
      <>
        <main className="site-page-shell">{children}</main>
        {semFaixa ? null : <DeferredCookieConsent posicao="barraDaLanding" />}
      </>
    );
  }

  if (isDashboard) {
    return (
      <>
        {saltarParaOConteudo}
        {doProfissional ? <CabecalhoDoProfissional /> : <Header />}
        <main id="conteudo" className="site-page-shell pt-(--altura-do-menu)">{children}</main>
        {semFaixa ? null : <DeferredCookieConsent posicao="fundo" />}
      </>
    );
  }

  /*
   * SEM AVISO DE ZONA PELO IP (14-10-2026).
   *
   * Aqui abria-se, por cima da página inteira, «Ainda não estamos na sua
   * área… mas em breve!» sempre que a cidade adivinhada pelo IP não estava na
   * lista. E o IP engana: diz «Lisbon» em inglês, só «Portugal» em muitas
   * redes móveis, a cidade do servidor a quem usa VPN. Afastava clientes que
   * servimos. Quem ESCOLHE uma morada fora da zona continua a ser avisado, no
   * selector de localização (LocationModal).
   */
  /*
   * Nas páginas públicas o menu fica transparente no topo e o primeiro bloco
   * (com `sob-o-menu`) sobe para trás dele. Nos painéis não: lá o topo é a
   * barra da aplicação, e um menu sem fundo só fazia desaparecer a fronteira.
   */
  /*
   * NAS PÁGINAS /en o <html> diz lang="en" (HtmlComLingua, 28-10-2026), e o
   * cabeçalho, o rodapé, a barra de baixo e a faixa dos cookies continuam em
   * português: vão marcados com lang="pt-PT". Todos são `fixed` ou estão no
   * fim da página, e uma <div> sem estilo à volta não lhes muda o lugar.
   */
  const emIngles = pathname === "/en" || pathname.startsWith("/en/");
  const emPortugues = (n: React.ReactNode) => (emIngles ? <div lang="pt-PT">{n}</div> : n);

  return (
    <>
      {emPortugues(saltarParaOConteudo)}
      {emPortugues(<Header transparenteNoTopo />)}
      {/* pb no mobile para o conteúdo não ficar escondido atrás da barra de navegação */}
      <main id="conteudo" className="site-page-shell pt-(--altura-do-menu) pb-[72px] lg:pb-0">{children}</main>
      {emPortugues(
        <>
          <Footer ano={anoEmLisboa} />
          <MobileBottomNav />
          <DeferredCookieConsent />
        </>,
      )}
    </>
  );
}
