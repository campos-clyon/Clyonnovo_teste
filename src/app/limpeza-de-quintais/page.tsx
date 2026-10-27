import type { Metadata } from "next";
import { og } from "@/lib/open-graph";

import ServicoForaDoPlano from "@/components/ServicoForaDoPlano";
import { SITE_URL } from "@/lib/seo-data";
import { O_QUE_PODE_FAZER } from "@/lib/voz-da-vitoria";

/*
 * Fora do plano desde 25-10-2026 (`FORA_DO_PLANO`): a página abre para quem
 * chega por um link antigo, mas sai do Google e do sitemap. Desde 27-10-2026
 * diz no topo que a CLYON não faz este serviço, sem preço nem botão.
 */

const DESCRICAO = `De momento a CLYON não faz limpeza de quintais. Pode pedir ${O_QUE_PODE_FAZER}.`;

export const metadata: Metadata = {
  title: "Limpeza de Quintais e Jardins em Lisboa e Setúbal",
  description: DESCRICAO,
  alternates: { canonical: `${SITE_URL}/limpeza-de-quintais` },
  robots: { index: false, follow: true },
  openGraph: og({
    title: "Limpeza de Quintais e Jardins em Lisboa e Setúbal",
    description: DESCRICAO,
    url: `${SITE_URL}/limpeza-de-quintais`,
  }),
};

export const revalidate = 86400;

export default function LimpezaQuintaisPage() {
  return <ServicoForaDoPlano titulo="Jardinagem e limpeza de quintais" />;
}
