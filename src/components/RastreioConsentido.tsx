"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  lerConsentimentoGuardado,
  EVENTO_CONSENTIMENTO,
  CONSENTIMENTO_NEGADO,
  sinaisDoConsentimento,
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
 * Enquanto não houver decisão, vale o «não»: quem não respondeu não
 * consentiu. Desde 20-10-2026 (modo avançado, mais abaixo) isso já não quer
 * dizer que o Google não carrega — quer dizer que carrega sem cookies.
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

  /*
   * CONSENT MODE V2, NO MODO AVANÇADO — 20-10-2026.
   *
   * Era o modo básico (14-10-2026): as etiquetas do Google só carregavam
   * depois de a pessoa carregar em «Aceitar». Quase ninguém carrega, e a
   * conversão «pedido registado» do Google Ads não contou um único pedido
   * desde 24-06-2026 — o anúncio estava a ser julgado às cegas.
   *
   * O dono escolheu o modo avançado: o gtag carrega em todas as páginas
   * (menos nas que têm o token no endereço), SEMPRE com o «default» negado.
   * Enquanto a pessoa não aceitar, o Google não guarda cookies nem
   * identificadores — recebe só sinais anónimos (houve uma visita, houve um
   * pedido), com os dados do anúncio redigidos, e estima as conversões de
   * forma agregada. Quem aceitar manda o «update» e passa a ser medido com
   * cookies; quem recusar fica nos sinais anónimos.
   *
   * Quem muda de ideia depois de as etiquetas carregarem manda o «update» à
   * que já está na página: uma etiqueta carregada não se descarrega, mas
   * deixa de usar cookies.
   */
  useEffect(() => {
    if (!consentimento || typeof window.gtag !== "function") return;
    window.gtag("consent", "update", sinaisDoConsentimento(consentimento));
  }, [consentimento]);

  // Só depois de montado: no servidor não há window nem localStorage.
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
   * carrega o gtag, aceite-se ou não. Perde-se a contagem de quem abre
   * pedidos; não se perde a chave de nenhum.
   */
  const paginaComSegredo = temSegredoNoEndereco(window.location.pathname);

  // Modo avançado: os dois destinos carregam fora das páginas com segredo; o
  // que a pessoa escolheu decide só o que podem guardar (os sinais acima).
  const querAds = !paginaComSegredo;
  const querGa4 = !paginaComSegredo;

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
  // do Ads, e depois configura-se cada um.
  const idDeArranque = querAds ? GOOGLE_ADS_ID : GA4_ID;

  return (
    <>
      {/*
        Google Ads e Google Analytics 4, no modo avançado.

        Os `id` dos <Script> já não mudam com a escolha: as etiquetas estão
        sempre lá, e a escolha chega-lhes pelo «update» do efeito acima. Um id
        novo voltava a correr o arranque e contava a visita duas vezes.

        O arranque (o `gtag` e o «default» negado) corre logo depois de a
        página ficar interactiva, e a biblioteca vem no fim: um pedido feito
        antes de ela chegar fica na fila do `dataLayer` e não se perde.
      */}
      {(querAds || querGa4) && (
        <>
          <Script
            id={`gtag-src-${idDeArranque}`}
            strategy="lazyOnload"
            src={`https://www.googletagmanager.com/gtag/js?id=${idDeArranque}`}
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', ${JSON.stringify(CONSENTIMENTO_NEGADO)});
              gtag('set', 'ads_data_redaction', true);
              gtag('consent', 'update', ${JSON.stringify(sinaisDoConsentimento(consentimento))});
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
