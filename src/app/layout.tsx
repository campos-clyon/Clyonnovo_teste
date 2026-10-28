import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { SCRIPT_DO_FUSO_DE_LISBOA } from "@/lib/relogio-de-lisboa";
import { pecasEmLisboa } from "@/lib/hora-de-lisboa";
import { SCRIPT_DO_TEMA_DO_PAINEL } from "@/lib/tema-do-painel";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import RastreioConsentido from "@/components/RastreioConsentido";
import OrigemECliques from "@/components/OrigemECliques";
import PageViewTracker from "@/components/PageViewTracker";

import SiteChrome from "@/components/SiteChrome";
import HtmlComLingua from "@/components/HtmlComLingua";
import AuthClientProvider from "@/components/AuthClientProvider";
import { LocationProvider } from "@/contexts/LocationContext";
import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  REGIONS,
  SITE_URL,
  AVALIACOES,
  PRAZO_DE_RESPOSTA,
} from "@/lib/seo-data";
import { precoDe } from "@/lib/precos-publicos";
import { MORADA_DA_CLYON } from "@/lib/identificacao-legal";
import { ID_DO_NEGOCIO, LOCALIDADES_SERVIDAS } from "@/lib/dados-estruturados";
import { IMAGEM_DE_PARTILHA } from "@/lib/open-graph";

/*
 * A meta description global deixou de levar o preço da recolha de móveis
 * (29-09-2026). Levava-o da fonte única, e bem, mas era uma frase de 190
 * caracteres — o Google mostra uns 155 — a vender também a limpeza pós-obra,
 * que deixou de ser serviço. Só a vêem as páginas sem description própria.
 */

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
    default: "CLYON - Recolha de Móveis, Entulho, Monos e Esvaziamento de Casas em Lisboa e Setúbal",
    template: "%s | CLYON",
  },
  /*
   * Anunciava "limpeza pós-obra", que não é um serviço da plataforma, e não
   * dizia quem faz o trabalho. Passa a dizer — profissionais verificados — e
   * o prazo é o de PRAZO_DE_RESPOSTA (30-09-2026).
   *
   * Com a manutenção da casa, que voltou a 25-10-2026. Para caber nos 155,
   * «verificados» e «menos de» ficaram de fora — o profissional e o prazo não.
   */
  description:
    "Recolha de móveis, monos, entulho, esvaziamentos, mudanças e manutenção da casa em Lisboa, Margem Sul e Setúbal: profissionais propõem em menos de 6 horas.",
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
  /*
   * SEM `alternates` AQUI — 29-09-2026.
   *
   * Estava `canonical: SITE_URL` (e o hreflang a apontar para o mesmo), e o
   * layout vale para TODAS as páginas: a que não declarasse o seu próprio
   * canónico herdava o da homepage. Era o caso do 404, do /entrar e do
   * /admin/login — três páginas a dizer ao Google «a versão a sério de mim
   * é a homepage». Num 404 isso é pior do que não dizer nada: é pedir-lhe
   * que junte o erro à página principal.
   *
   * Cada página pública declara o seu canónico (há um teste que o confirma
   * em `metadados-das-paginas.test.ts`); as outras ficam sem nenhum, que é o
   * certo para uma página noindex. O hreflang saiu com ele: o site só tem
   * uma língua, e um hreflang que aponta para a homepage a partir de todas
   * as páginas era outro sinal errado.
   */
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  /*
   * SÓ O QUE É IGUAL EM TODAS AS PÁGINAS — 29-09-2026.
   *
   * Tinha título, descrição e `url: SITE_URL`. Uma página sem `openGraph`
   * próprio herdava-os: /termos, /regioes ou /quero-ser-parceiro saíam
   * partilhadas com o título da homepage e o endereço da homepage. Sem
   * eles aqui, o Next preenche o título e a descrição do Open Graph com os
   * da própria página. As páginas que definem o seu usam `og()`
   * (open-graph.ts), que junta o que está aqui — o Next não junta sozinho.
   */
  openGraph: {
    type: "website",
    locale: "pt_PT",
    siteName: BUSINESS_NAME,
    images: [IMAGEM_DE_PARTILHA],
  },
  /*
   * O mesmo para o Twitter/X: sem título nem descrição, o Next usa os do
   * Open Graph de cada página. Com eles, TODAS as páginas partilhavam o
   * título genérico do layout — até as que tinham o seu.
   */
  twitter: {
    card: "summary_large_image",
    images: [IMAGEM_DE_PARTILHA.url],
  },
  other: {
    "geo.region": "PT-11",
    "geo.placename": "Amora, Portugal",
    "geo.position": "38.6120;-9.1152",
    ICBM: "38.6120, -9.1152",
    language: "pt-PT",
  },
};

/** O logótipo para os dados estruturados: o Google pede pelo menos 112 px de lado. */
const LOGO_DO_NEGOCIO = `${SITE_URL}/logo-clyon-icon.png`;

/** Os perfis onde a CLYON se confirma fora do site. */
const PERFIS_DO_NEGOCIO = ["https://www.google.com/maps?cid=6227316191619861484", AVALIACOES.fixandoUrl];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
  // O `@id` a que todos os `Service` do site se referem como prestador
  // (`PRESTADOR`, em dados-estruturados.ts). Muda lá, muda em todo o lado.
  "@id": ID_DO_NEGOCIO,
  name: BUSINESS_NAME,
  url: SITE_URL,
  telephone: BUSINESS_PHONE,
  email: BUSINESS_EMAIL,
  image: `${SITE_URL}/og-image.jpg`,
  /*
   * LOGO, GEO E SAMEAS (14-10-2026, auditoria de SEO). O logótipo é o PNG de
   * 896×251 — o webp tinha 205×84, abaixo dos 112 px que o Google pede. As
   * coordenadas são as das meta geo.position. O sameAs liga esta entidade aos
   * dois perfis onde as avaliações se confirmam: o Google pelo CID (conferido
   * no Maps a 14-10-2026) e a Fixando.
   */
  logo: LOGO_DO_NEGOCIO,
  geo: { "@type": "GeoCoordinates", latitude: 38.612, longitude: -9.1152 },
  sameAs: PERFIS_DO_NEGOCIO,
  /*
   * Dizia «Empresa especializada em … limpeza pós-obra e mudanças». A CLYON
   * é a plataforma, quem faz o trabalho são profissionais independentes — e
   * a limpeza pós-obra já não é um serviço activo (29-09-2026).
   */
  /*
   * 27-10-2026 (d12): diz também quem faz o trabalho e o que a CLYON guarda,
   * e a manutenção da casa (que voltou a 25/10). O tipo continua
   * LocalBusiness: trocá-lo por Organization mexe no SEO local e fica para
   * quando o Marketing o medir.
   */
  description:
    "Plataforma que liga clientes a profissionais independentes e verificados de recolha de móveis, monos e entulho, esvaziamento de casas, mudanças e manutenção da casa em Lisboa, Margem Sul e Setúbal. O trabalho é feito pelo profissional que o cliente escolhe; a CLYON guarda o acordo e o pagamento.",
  // A mesma morada dos Termos e da etiqueta `address` (identificacao-legal.ts, 28-10-2026, d1).
  address: {
    "@type": "PostalAddress",
    streetAddress: MORADA_DA_CLYON.rua,
    addressLocality: MORADA_DA_CLYON.localidade,
    addressRegion: MORADA_DA_CLYON.distrito,
    postalCode: MORADA_DA_CLYON.codigoPostal,
    addressCountry: "PT",
  },
  // As localidades com página, e não uma lista escrita à mão — faltavam a
  // Costa da Caparica, a Amora, Corroios e Alcochete (29-09-2026).
  areaServed: LOCALIDADES_SERVIDAS.map((name) => ({ "@type": "City", name })),
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
   *
   * (29-09-2026: nem lá. As de /avaliacoes vêm do Google e da Fixando e são
   * do próprio negócio — duas coisas que as regras da Google não aceitam em
   * dados estruturados. Ficou o texto visível; as únicas estrelas declaradas
   * no site são as das páginas dos profissionais.)
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
  logo: LOGO_DO_NEGOCIO,
  sameAs: PERFIS_DO_NEGOCIO,
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
  /*
   * O ANO DO RODAPÉ CONTA-SE AQUI, UMA VEZ, NA HORA DE LISBOA (26-10-2026).
   *
   * O rodapé fazia `new Date().getFullYear()` no navegador: no fuso de quem
   * olha, e numa página feita antes. Na passagem de ano, de França (já 1 de
   * Janeiro lá, ainda 31 em Lisboa), o HTML dizia um ano e o navegador outro —
   * o React #418 em todas as páginas públicas, provado num Chrome com o fuso
   * de Paris. Contado no servidor e passado ao rodapé, o navegador recebe o
   * mesmo número que está no HTML.
   */
  const anoEmLisboa = pecasEmLisboa(new Date()).ano;
  return (
    /*
      O <html> vem de HtmlComLingua: lang="pt-PT" no site e lang="en" nas
      páginas /en (28-10-2026, d1). O `suppressHydrationWarning` do script do
      tema (abaixo) foi com ele.
    */
    <HtmlComLingua className={`${jakarta.variable} ${poppins.variable}`}>
      <head>
        {/* PRIMEIRO DE TUDO: a hora do site é a de Lisboa, venha de onde vier
            quem olha. Tem de correr antes de qualquer ecrã escrever uma data —
            ver `relogio-de-lisboa.ts`. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_FUSO_DE_LISBOA }} />
        {/* O modo escuro do painel do profissional, antes de pintar — ver
            `tema-do-painel.ts`. Fora do painel não faz nada. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA_DO_PAINEL }} />
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
          dangerouslySetInnerHTML={{ __html: jsonLd(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema) }}
        />
      </head>
      <body className="site-aqua-shell min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">
        {/* O Google e o Vercel Analytics passaram para aqui dentro, onde só
            carregam depois de a pessoa consentir. Estavam soltos neste ficheiro
            a carregar sempre, com um banner ao lado a prometer o contrário. */}
        <RastreioConsentido />
        <OrigemECliques />
        {/* A sessão por fora da localização: o LocationProvider usa
            useSession() para só perguntar pela conta a quem tem sessão. */}
        <AuthClientProvider>
          <LocationProvider>
            <SiteChrome anoEmLisboa={anoEmLisboa}>{children}</SiteChrome>
          </LocationProvider>
        </AuthClientProvider>
        {/* Vistas de página na nossa base — o painel deixa de depender de uma
            conta externa para saber de que páginas vêm os pedidos */}
        <PageViewTracker />
      </body>
    </HtmlComLingua>
  );
}
