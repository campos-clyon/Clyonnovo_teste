import type { Metadata } from "next";
import { jsonLd } from "@/lib/json-ld";
import { og } from "@/lib/open-graph";

import { PRESTADOR } from "@/lib/dados-estruturados";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { PRECOS } from "@/lib/precos-publicos";
import { comIva, euros } from "@/lib/quanto-custa";
import { PRAZO_DE_RESPOSTA } from "@/lib/seo-data";
import LandingClient from "./LandingClient";

/*
 * O PREÇO DOS MÓVEIS VEM DA FONTE, COM O IVA AO LADO — 28-10-2026.
 * O preço dos móveis estava escrito à mão: um número que não mudava
 * com a grelha, e o sem IVA sozinho. Até 155 caracteres, o essencial primeiro
 * (`descricaoQueCabe`): o que não couber inteiro fica de fora.
 */
const MOVEIS_DESDE = PRECOS.recolha_moveis.minimo!;
const DESCRICAO = descricaoQueCabe([
  // Sem a limpeza pós-obra, que deixou de ser serviço activo (29-09-2026).
  "Recolha de móveis, monos e entulho em Lisboa, Margem Sul e Setúbal.",
  `Móveis desde ${euros(MOVEIS_DESDE)} + IVA (${euros(comIva(MOVEIS_DESDE))} com IVA).`,
  `${PRAZO_DE_RESPOSTA.frase}.`,
  "Carregamento incluído.",
]);

export const metadata: Metadata = {
  title: "Recolha de Móveis, Monos e Entulho em Lisboa",
  description: DESCRICAO,
  alternates: {
    canonical: "https://clyon.pt/orcamento-recolha-lisboa",
  },
  openGraph: og({
    title: "Recolha de Móveis, Monos e Entulho em Lisboa",
    description:
      "Orçamento por WhatsApp para recolha de entulho, móveis, monos e esvaziamento de casas em Lisboa, Margem Sul e Setúbal.",
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
        dangerouslySetInnerHTML={{ __html: jsonLd(servicoSchema) }}
      />
      <LandingClient />
    </>
  );
}
