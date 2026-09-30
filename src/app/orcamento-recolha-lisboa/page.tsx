import type { Metadata } from "next";
import { og } from "@/lib/open-graph";

import { PRESTADOR } from "@/lib/dados-estruturados";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "Orçamento de Recolha em Lisboa — Entulho e Móveis",
  // Sem a limpeza pós-obra, que deixou de ser serviço activo (29-09-2026).
  description:
    "Peça orçamento para recolha de entulho, móveis e monos e esvaziamento de casas em Lisboa, Margem Sul e Setúbal.",
  alternates: {
    canonical: "https://clyon.pt/orcamento-recolha-lisboa",
  },
  openGraph: og({
    title: "Orçamento de Recolha em Lisboa — Entulho e Móveis",
    description:
      "Orçamento rápido por WhatsApp para recolha de entulho, móveis e monos e esvaziamento de casas em Lisboa, Margem Sul e Setúbal.",
    url: "https://clyon.pt/orcamento-recolha-lisboa",
  }),
};

/*
 * UM `Service`, E NÃO OUTRO `LocalBusiness` — 29-09-2026.
 *
 * Estava aqui um segundo `LocalBusiness`/`HomeAndConstructionBusiness`
 * «CLYON», sem `@id`, com o `url` desta página e sem morada — ao lado do do
 * layout, que é a entidade a sério. Duas empresas com o mesmo nome e telefone
 * no mesmo HTML, uma delas a dizer que o site da empresa é uma landing page.
 * E o catálogo ainda vendia limpeza pós-obra, que deixou de ser serviço.
 *
 * O que esta página tem de próprio é o pedido de orçamento: vai como serviço,
 * com o prestador por `@id` e o catálogo do que se pode pedir.
 */
const servicoSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Orçamento de recolha em Lisboa, Margem Sul e Setúbal",
  url: "https://clyon.pt/orcamento-recolha-lisboa",
  provider: PRESTADOR,
  description:
    "Pedido de orçamento para recolha de entulho, móveis e monos e esvaziamento de casas em Lisboa, Margem Sul e Setúbal, com propostas de profissionais verificados.",
  areaServed: [
    { "@type": "City", name: "Lisboa" },
    { "@type": "City", name: "Amadora" },
    { "@type": "City", name: "Odivelas" },
    { "@type": "City", name: "Loures" },
    { "@type": "City", name: "Oeiras" },
    { "@type": "City", name: "Cascais" },
    { "@type": "City", name: "Sintra" },
    { "@type": "City", name: "Almada" },
    { "@type": "City", name: "Seixal" },
    { "@type": "City", name: "Barreiro" },
    { "@type": "City", name: "Montijo" },
    { "@type": "City", name: "Moita" },
    { "@type": "City", name: "Setúbal" },
    { "@type": "City", name: "Sesimbra" },
    { "@type": "City", name: "Palmela" },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Serviços de recolha CLYON",
    itemListElement: [
      "Recolha de entulho",
      "Recolha de móveis",
      "Recolha de monos e volumosos",
      "Esvaziamento de casas",
    ].map((service) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: service },
    })),
  },
  // O `contactPoint` saiu com o LocalBusiness: o telefone e o email da CLYON
  // estão no do layout, e o ponto de contacto com horário em /contactos.
};

export default function OrcamentoRecolhaLisboaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicoSchema) }}
      />
      <LandingClient />
    </>
  );
}
