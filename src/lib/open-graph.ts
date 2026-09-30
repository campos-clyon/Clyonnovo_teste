import type { Metadata } from "next";
import { BUSINESS_NAME } from "@/lib/seo-data";

type OpenGraph = NonNullable<Metadata["openGraph"]>;
type Imagens = OpenGraph["images"];

/**
 * A IMAGEM QUE VAI COM O LINK QUANDO ALGUÉM O PARTILHA.
 *
 * `public/og-image.jpg`, 1200×630 — o tamanho que o Facebook, o WhatsApp e o
 * LinkedIn mostram inteiro. A imagem é de outra equipa; o endereço é este.
 */
export const IMAGEM_DE_PARTILHA = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "CLYON — recolha de móveis, monos e entulho, esvaziamentos e mudanças",
} as const;

type DadosDePartilha = {
  title: string;
  description?: string;
  /** Absoluto ou relativo — o `metadataBase` do layout completa-o. */
  url: string;
  images?: Imagens;
  /** Só os artigos do blog são `article`; o resto do site é `website`. */
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

/**
 * O `openGraph` de uma página, já com o que o site todo partilha — 29-09-2026.
 *
 * O Next junta os metadados por CAMPO e não por dentro dos campos: uma página
 * que define `openGraph` substitui o do layout inteiro, e não só o título. As
 * páginas davam título, descrição e endereço e perdiam em silêncio o
 * `locale` pt_PT, o `siteName` e a imagem — trinta e tal páginas partilhadas
 * sem imagem nenhuma, e o Facebook a adivinhar a língua.
 *
 * Esta função devolve o bloco inteiro; a página só diz o que é dela.
 */
export function og({
  title,
  description,
  url,
  images,
  type = "website",
  publishedTime,
  modifiedTime,
}: DadosDePartilha): OpenGraph {
  const comum = {
    title,
    description,
    url,
    siteName: BUSINESS_NAME,
    locale: "pt_PT",
    images: images ?? [IMAGEM_DE_PARTILHA],
  };
  return type === "article"
    ? { ...comum, type: "article", publishedTime, modifiedTime }
    : { ...comum, type: "website" };
}
