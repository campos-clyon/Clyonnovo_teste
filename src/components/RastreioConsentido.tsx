"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  lerConsentimentoGuardado,
  EVENTO_CONSENTIMENTO,
  type CookiePreferences,
} from "@/lib/cookie-consent";
import { enderecoSemSegredos, temSegredoNoEndereco } from "@/lib/endereco-sem-segredos";

/**
 * Os scripts de terceiros, e só depois de a pessoa dizer que sim.
 *
 * PORQUE ISTO EXISTE
 *
 * O `gtag` do Google Ads e o Vercel Analytics estavam no layout a carregar
 * incondicionalmente. Ao mesmo tempo, o site mostrava um banner a pedir
 * autorização para "analítica e marketing", com um botão de recusar.
 *
 * A recusa não fazia nada. Os scripts carregavam na mesma — antes de a pessoa
 * responder, e depois de ela dizer que não. Um banner que não trava nada é
 * pior do que não ter banner nenhum: promete uma escolha que não existe, e é
 * uma promessa feita por escrito a quem tem o direito de a exigir.
 *
 * COMO FUNCIONA
 *
 * Lê o que ficou guardado, e volta a ler quando o banner dispara o evento —
 * assim a decisão vale no momento em que é tomada, sem obrigar a recarregar.
 * Enquanto não houver decisão, não carrega nada: quem não respondeu não
 * consentiu.
 *
 * O `PageViewTracker` continua fora daqui de propósito: é contagem nossa, na
 * nossa base, sem terceiros e sem seguir ninguém entre sites.
 */

const GOOGLE_ADS_ID = "AW-18221538324";

/*
 * O Google Analytics 4 — medição, e por isso debaixo da escolha "analytics".
 *
 * Entrou pela porta MANUAL, e não pela que o assistente do GA4 oferecia
 * ("usar a tag do seu site"). Essa avisava, a vermelho, que as definições da
 * tag do Google Ads seriam SUBSTITUÍDAS — e do outro lado dessa tag está uma
 * acção de conversão a funcionar. Trocar conversões que já correm por um
 * atalho de configuração não é troca que se faça.
 *
 * O ID de medição não é segredo nenhum: viaja no HTML de todas as páginas,
 * como o do Ads. Fica aqui à vista, ao lado dele.
 */
const GA4_ID = "G-Q76WK4NFZL";

export default function RastreioConsentido() {
  // Começa sempre a falso, mesmo que já haja consentimento guardado: no
  // servidor não há localStorage, e devolver outra coisa aqui dava uma
  // hidratação diferente do HTML que foi enviado.
  const [consentimento, setConsentimento] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    setConsentimento(lerConsentimentoGuardado());

    function aoDecidir() {
      setConsentimento(lerConsentimentoGuardado());
    }
    window.addEventListener(EVENTO_CONSENTIMENTO, aoDecidir);
    // Outro separador do mesmo site também conta como decisão.
    window.addEventListener("storage", aoDecidir);
    return () => {
      window.removeEventListener(EVENTO_CONSENTIMENTO, aoDecidir);
      window.removeEventListener("storage", aoDecidir);
    };
  }, []);

  if (!consentimento) return null;

  /*
   * NESTAS PÁGINAS NÃO ENTRA MEDIÇÃO NENHUMA.
   *
   * Seis rotas do site trazem o token dentro do endereço — é a credencial
   * que abre o pedido. Tentou-se primeiro redigir o `page_location` que se
   * dá ao gtag, e para o GA4 isso chega; para o Google Ads NÃO chega. Está
   * visto no browser: o tag dele faz o pedido dele, lê o `location` do
   * browser e manda o endereço verdadeiro na mesma.
   *
   * Por isso a regra aqui é a mais simples de todas — nestas páginas não se
   * carrega o gtag. Perde-se a contagem de quem abre pedidos; não se perde a
   * chave de nenhum.
   */
  const paginaComSegredo = temSegredoNoEndereco(window.location.pathname);

  const querAds = consentimento.marketing && !paginaComSegredo;
  const querGa4 = consentimento.analytics && !paginaComSegredo;

  /*
   * E MESMO NAS OUTRAS PÁGINAS, O QUE SE DIZ VAI LIMPO.
   *
   * Quem vem de um pedido para o site traz esse endereço no `referrer`, e o
   * gtag manda-o. Aqui vai já sem o token. Ver `endereco-sem-segredos.ts`.
   */
  const daPagina = {
    page_location: enderecoSemSegredos(window.location.href),
    ...(document.referrer
      ? { page_referrer: enderecoSemSegredos(document.referrer) }
      : {}),
  };
  const oQueSeDiz = JSON.stringify(daPagina);

  // A biblioteca é a mesma para os dois destinos: pede-se uma vez, com o id
  // de quem estiver consentido, e depois configura-se cada um.
  const idDeArranque = querAds ? GOOGLE_ADS_ID : GA4_ID;

  return (
    <>
      {/*
        Google Ads (marketing) e Google Analytics 4 (analytics).

        Os `id` dos <Script> mudam com o que está consentido de propósito: se
        a pessoa alargar a escolha depois de já ter respondido, o React monta
        um elemento novo e o destino que faltava entra. Com um id fixo, o
        script não voltava a correr e a segunda escolha não valia nada.
      */}
      {(querAds || querGa4) && (
        <>
          <Script
            id={`gtag-src-${idDeArranque}`}
            strategy="lazyOnload"
            src={`https://www.googletagmanager.com/gtag/js?id=${idDeArranque}`}
          />
          <Script
            id={`gtag-init-${querAds ? "ads" : ""}${querGa4 ? "ga4" : ""}`}
            strategy="lazyOnload"
          >
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${querAds ? `gtag('config', '${GOOGLE_ADS_ID}', ${oQueSeDiz});` : ""}
              ${querGa4 ? `gtag('config', '${GA4_ID}', ${oQueSeDiz});` : ""}
            `}
          </Script>
        </>
      )}

      {/* O Vercel Analytics não usa cookies nem segue entre sites, mas é
          medição de audiência e o banner pede autorização para isso — fica
          debaixo da mesma escolha, para o que se diz e o que se faz baterem
          certo. */}
      {consentimento.analytics && <Analytics />}

      {/* O Speed Insights mede o tempo de carregamento das páginas — Core Web
          Vitals. Não põe cookies e não segue ninguém entre sites, mas mede a
          navegação de uma pessoa real e o banner pede autorização para
          medição. Fica debaixo da mesma escolha que o Analytics, pela mesma
          razão: o que se promete no banner e o que se faz têm de bater certo.

          Os DADOS vão para /_vercel/speed-insights, no nosso domínio — mas o
          SCRIPT vem de va.vercel-scripts.com, e isso a CSP tem mesmo de o
          dizer. Estava aqui escrito que não precisava de excepção nenhuma, e
          durante todo esse tempo o browser recusou os dois scripts em
          silêncio. Ver a nota no next.config.ts. */}
      {consentimento.analytics && <SpeedInsights />}
    </>
  );
}
