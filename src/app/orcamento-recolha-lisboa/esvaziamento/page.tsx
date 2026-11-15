import type { Metadata } from "next";
import { descricaoQueCabe } from "@/lib/descricoes-seo";
import { ESVAZIAMENTO_NA_LANDING } from "@/lib/landing-do-esvaziamento";
import { comIva, euros } from "@/lib/quanto-custa";
import { PRAZO_DE_RESPOSTA } from "@/lib/seo-data";
import LandingClient from "../LandingClient";

/*
 * A PÁGINA DO ANÚNCIO, VERSÃO DO ESVAZIAMENTO — 15-11-2026 (d42).
 *
 * Chega-se cá por /orcamento-recolha-lisboa?servico=esvaziamento (o
 * next.config reescreve, e o endereço que a pessoa vê não muda). Fica fora do
 * Google: é uma versão da página do anúncio, e a página do esvaziamento para
 * quem pesquisa é /esvaziamento-de-casas.
 */
export const metadata: Metadata = {
  title: "Esvaziamento de Casas e Recheios em Lisboa",
  description: descricaoQueCabe([
    "Esvaziamento de casas e apartamentos em Lisboa, Margem Sul e Setúbal: heranças, mudanças, arrendamento.",
    `Desde ${euros(ESVAZIAMENTO_NA_LANDING.desde)} + IVA (${euros(comIva(ESVAZIAMENTO_NA_LANDING.desde))} com IVA).`,
    `${PRAZO_DE_RESPOSTA.frase}.`,
  ]),
  robots: { index: false, follow: true },
};

export default function OrcamentoDoEsvaziamentoPage() {
  return <LandingClient variante="esvaziamento" />;
}
