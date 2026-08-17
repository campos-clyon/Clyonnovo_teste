"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import {
  lerConsentimentoGuardado,
  EVENTO_CONSENTIMENTO,
  type CookiePreferences,
} from "@/lib/cookie-consent";

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

  return (
    <>
      {/* Google Ads e Tag Manager — marketing. */}
      {consentimento.marketing && (
        <>
          <Script
            id="gtag-src"
            strategy="lazyOnload"
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          />
          <Script id="gtag-init" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ADS_ID}');
            `}
          </Script>
        </>
      )}

      {/* O Vercel Analytics não usa cookies nem segue entre sites, mas é
          medição de audiência e o banner pede autorização para isso — fica
          debaixo da mesma escolha, para o que se diz e o que se faz baterem
          certo. */}
      {consentimento.analytics && <Analytics />}
    </>
  );
}
