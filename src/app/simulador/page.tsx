import type { Metadata } from "next";
import SimulatorPage from "./SimulatorPage";

export const metadata: Metadata = {
  title: "Simulador de Preços — Estimativa Instantânea CLYON",
  description:
    "Descreva o serviço, envie fotos e indique a morada. A CLYON calcula uma estimativa com base no preçário e nas condições de acesso. Recolha de móveis, entulho, monos, esvaziamentos e mudanças em Lisboa e Setúbal.",
  alternates: {
    canonical: "https://clyon.pt/simulador",
  },
  openGraph: {
    title: "Simulador de Preços — Estimativa Instantânea CLYON",
    description:
      "Estimativa de preço instantânea para recolha, esvaziamento e mudanças em Lisboa e Setúbal.",
    url: "https://clyon.pt/simulador",
  },
};

export default function SimuladorPage() {
  return <SimulatorPage />;
}
