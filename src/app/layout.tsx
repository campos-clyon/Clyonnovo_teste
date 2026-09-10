import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import RastreioConsentido from "@/components/RastreioConsentido";
import PageViewTracker from "@/components/PageViewTracker";

import SiteChrome from "@/components/SiteChrome";
import AuthClientProvider from "@/components/AuthClientProvider";
import { LocationProvider } from "@/contexts/LocationContext";
import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  REGIONS,
  SITE_URL, AVALIACOES_TOTAL } from "@/lib/seo-data";
import { precoDe } from "@/lib/precos-publicos";

/**
 * O preço da recolha de móveis, para a meta description global.
 *
 * Estava escrito à mão, dizia "desde 70 €", e a tabela oficial diz
 * 40 – 120 € — ou seja, o snippet que o Google mostra em todas as páginas
 * do site anunciava um piso 30 € acima do que se pratica. Passa a vir da
 * fonte única; se o valor mudar lá, muda aqui.
 */
const PRECO_MOVEIS = precoDe("recolha_moveis") ?? "orçamento personalizado";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    /*
     * 55 caracteres, e eram 87.
     *
     * O Google corta o título por volta dos 60 e põe reticências. O que
     * estava aqui perdia "e Esvaziamento de Casas em Lisboa e Setúbal" — ou
     * seja, perdia as cidades, que é a parte pela qual as pessoas procuram.
     * Melhor escolher o que fica do que deixar a máquina escolher.
     */
    default: "CLYON — Recolha de Móveis e Entulho em Lisboa e Setúbal",
    template: "%s | CLYON",
  },
  description:
    `Recolha de entulho, móveis, monos e mudanças em Lisboa e Setúbal. Resposta em 6h, recolha de móveis ${PRECO_MOVEIS} e ${AVALIACOES_TOTAL} avaliações 5★ verificadas. Orçamento grátis!`,
  keywords: [
    "recolha de móveis lisboa",
    "recolha de monos margem sul",
    "recolha de entulho lisboa",
    "mudanças margem sul",
    "esvaziamento de casas lisboa",
  ],
  authors: [{ name: BUSINESS_NAME }],
  creator: BUSINESS_NAME,
  publisher: BUSINESS_NAME,
  category: "Serviços locais",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "pt-PT": SITE_URL,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: SITE_URL,
    siteName: BUSINESS_NAME,
    title: "Recolha de Entulho, Móveis e Monos em Lisboa e Margem Sul | CLYON",
    description:
      "Serviço rápido para recolha de entulho, móveis, monos e mudanças em Lisboa, Margem Sul e Setúbal.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CLYON - Recolha de Entulho, Móveis e Monos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Recolha de Entulho, Móveis e Monos em Lisboa e Margem Sul | CLYON",
    description:
      "Orçamento rápido para recolha de entulho, móveis, monos, esvaziamentos e mudanças.",
    images: ["/og-image.png"],
  },
  other: {
    "geo.region": "PT-11",
    "geo.placename": "Amora, Portugal",
    "geo.position": "38.6120;-9.1152",
    ICBM: "38.6120, -9.1152",
    language: "pt-PT",
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
  "@id": `${SITE_URL}/#localbusiness`,
  name: BUSINESS_NAME,
  url: SITE_URL,
  telephone: BUSINESS_PHONE,
  email: BUSINESS_EMAIL,
  image: `${SITE_URL}/og-image.png`,
  description:
    "Plataforma que liga clientes a profissionais verificados de recolha de entulho, móveis, monos, esvaziamento de casas e mudanças em Lisboa, Margem Sul e Setúbal.",
  /*
   * SEM `geo` E SEM `hasMap`, e é uma decisão e não um esquecimento.
   *
   * O plano pedia-os. Só que a base deixou de ser da CLYON: "a base passa a
   * ser dos profissionais, não da CLYON" (10-09-2026). Declarar coordenadas
   * e um ponto no mapa é dizer que se atende ali, e não se atende ali coisa
   * nenhuma — quem se desloca é o profissional, da base dele.
   *
   * A morada abaixo fica porque é a sede legal, a mesma que está na
   * identificação legal e nos termos, e uma empresa tem de a declarar. O que
   * não se declara é um balcão que não existe.
   *
   * Isto fecha a porta ao Map Pack do Google. Já estava fechada: segundo a
   * auditoria, o perfil de negócio foi recusado sete vezes por falta de
   * morada física. Abri-la é a decisão da morada comercial, que é do dono.
   */
  sameAs: [
    // TODO (Wanderson): pôr aqui os endereços dos perfis reais quando
    // existirem — Google Business Profile, Instagram, Facebook. Um `sameAs`
    // com um endereço errado é pior do que não ter nenhum: diz ao Google que
    // aquela página é a CLYON, e ela não é.
  ],
  address: {
    "@type": "PostalAddress",
    streetAddress: "Belverde",
    addressLocality: "Amora",
    addressRegion: "Setúbal",
    postalCode: "2845-513",
    addressCountry: "PT",
  },
  areaServed: [
    { "@type": "City", name: "Lisboa" },
    { "@type": "City", name: "Almada" },
    { "@type": "City", name: "Seixal" },
    { "@type": "City", name: "Barreiro" },
    { "@type": "City", name: "Setúbal" },
    { "@type": "City", name: "Cascais" },
    { "@type": "City", name: "Oeiras" },
    { "@type": "City", name: "Sintra" },
    { "@type": "City", name: "Amadora" },
    { "@type": "City", name: "Loures" },
    { "@type": "City", name: "Odivelas" },
    { "@type": "City", name: "Montijo" },
    { "@type": "City", name: "Moita" },
    { "@type": "City", name: "Palmela" },
    { "@type": "City", name: "Sesimbra" },
    { "@type": "City", name: "Carnaxide" },
    { "@type": "City", name: "Monte Abraão" },
    { "@type": "City", name: "Queluz" },
  ],
  /*
   * NÃO há aggregateRating aqui, e é deliberado.
   *
   * Estava, e este schema vai no <head> de TODAS as páginas do site — incluindo
   * /contactos, o blog e os formulários, onde não existe uma única avaliação
   * visível. Declarar uma nota agregada numa página sem avaliações é
   * exatamente o padrão que o Google classifica como "self-serving review
   * snippets", e a sanção é manual: perdem-se as estrelas em todo o domínio,
   * não só na página que as pediu a mais.
   *
   * Pior ainda, o número aqui dizia 32 e o da página /avaliacoes dizia 163 —
   * ou seja, quem abrisse /avaliacoes recebia os dois no mesmo HTML, em duas
   * entidades LocalBusiness diferentes com a mesma morada.
   *
   * A nota vive onde as avaliações vivem: em /avaliacoes, e só lá.
   */
  /*
   * A faixa é qualitativa, e é de propósito.
   *
   * Dizia "120EUR - 500EUR", e este schema vai no <head> de TODAS as páginas
   * do site. Contradizia a tabela oficial nas duas pontas: por baixo, porque
   * há serviços publicados a partir de 30 € — o Google via um piso de 120 na
   * mesma página onde o cartão dizia 30; e por cima, porque um esvaziamento
   * de apartamento vai a 450 € e uma mudança não tem tecto publicado.
   *
   * Um intervalo numérico global obrigaria a manter dezenas de páginas em
   * sincronia com dois números que nenhuma delas mostra. "€€" diz a mesma
   * coisa que o Google usa para o resto do mundo — gama média — e não pode
   * ficar desatualizado.
   */
  priceRange: "€€",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "08:00",
      closes: "20:00",
    },
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: BUSINESS_PHONE,
    contactType: "customer service",
    areaServed: "PT",
    availableLanguage: ["pt-PT"],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: BUSINESS_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo-clyon-icon.webp`,
  contactPoint: {
    "@type": "ContactPoint",
    telephone: BUSINESS_PHONE,
    email: BUSINESS_EMAIL,
    contactType: "customer service",
    areaServed: "PT",
    availableLanguage: ["pt-PT"],
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: BUSINESS_NAME,
  url: SITE_URL,
  inLanguage: "pt-PT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" className={`${jakarta.variable} ${poppins.variable}`}>
      <head>
        <meta name="color-scheme" content="light" />
        {/* Sem dns-prefetch nem preconnect ao googletagmanager: abriam ligação
            ao Google no carregamento da página, antes de haver consentimento.
            Não enviam cookies, mas revelam o IP de quem ainda não decidiu. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#00B4CC" />
        <meta name="format-detection" content="telephone=yes" />
        <meta name="address" content={BUSINESS_ADDRESS} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="site-aqua-shell min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">
        {/* O Google e o Vercel Analytics passaram para aqui dentro, onde só
            carregam depois de a pessoa consentir. Estavam soltos neste ficheiro
            a carregar sempre, com um banner ao lado a prometer o contrário. */}
        <RastreioConsentido />
        <LocationProvider>
          <AuthClientProvider>
            <SiteChrome>{children}</SiteChrome>
          </AuthClientProvider>
        </LocationProvider>
        {/* Vistas de página na nossa base — o painel deixa de depender de uma
            conta externa para saber de que páginas vêm os pedidos */}
        <PageViewTracker />
      </body>
    </html>
  );
}
