import type { Metadata } from "next";
import SimulatorPage from "./SimulatorPage";

export const metadata: Metadata = {
  // Acabava em «… Instantânea CLYON», e o template do layout acrescentava
  // « | CLYON»: a marca duas vezes no Google (29-09-2026).
  title: "Simulador de Preços — Estimativa Instantânea",
  // Até 155 caracteres, o essencial primeiro e sem frases cortadas: o
  // Google mostra uns 155 e corta o resto a meio (29-09-2026).
  description:
    "Descreva o serviço, envie fotos e a morada, e veja uma estimativa do preço. Recolha de móveis, entulho e monos, esvaziamentos e mudanças.",
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
