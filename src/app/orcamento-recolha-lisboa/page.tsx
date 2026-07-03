import type { Metadata } from "next";

import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "Recolha de Entulho, Móveis e Monos em Lisboa | CLYON",
  description:
    "Peça orçamento para recolha de entulho, móveis, monos, esvaziamento de casas e limpeza pós-obra em Lisboa, Margem Sul e Setúbal.",
  alternates: {
    canonical: "https://clyon.pt/orcamento-recolha-lisboa",
  },
  openGraph: {
    title: "Recolha de Entulho, Móveis e Monos em Lisboa | CLYON",
    description:
      "Orçamento rápido por WhatsApp para recolha de entulho, móveis, monos, esvaziamento de casas e limpeza pós-obra em Lisboa, Margem Sul e Setúbal.",
    url: "https://clyon.pt/orcamento-recolha-lisboa",
    type: "website",
    locale: "pt_PT",
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
  name: "CLYON",
  url: "https://clyon.pt/orcamento-recolha-lisboa",
  telephone: "+351965785395",
  email: "geral@clyon.pt",
  description:
    "Recolha de entulho, móveis, monos, esvaziamento de casas e limpeza pós-obra em Lisboa, Margem Sul e Setúbal. Carregamento e transporte incluídos.",
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
      "Limpeza pós-obra",
    ].map((service) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: service },
    })),
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+351965785395",
    email: "geral@clyon.pt",
    contactType: "customer service",
    areaServed: "PT",
    availableLanguage: ["pt-PT"],
  },
};

export default function OrcamentoRecolhaLisboaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <LandingClient />
    </>
  );
}
