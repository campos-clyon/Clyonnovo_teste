import type { Metadata } from "next";
import SimulatorPage from "./SimulatorPage";

/*
 * "Simulador de Preços — Estimativa Instantânea" prometia um número que o
 * cliente deixou de ver a 18-09-2026 (sem-estimativa-para-o-cliente.test.ts):
 * o que esta página faz é recolher o pedido para os profissionais. Sem
 * "CLYON" no título — o layout já acrescenta « | CLYON» (30-09-2026).
 */
export const metadata: Metadata = {
  title: "Pedir Orçamento — Propostas de Profissionais",
  description:
    "Descreva o serviço, envie fotos e indique a morada. O pedido chega a profissionais verificados da sua zona e recebe propostas em até 6 horas.",
  alternates: {
    canonical: "https://clyon.pt/simulador",
  },
  openGraph: {
    // O openGraph não passa pelo template do layout: a marca vai escrita.
    title: "Pedir Orçamento — Propostas de Profissionais | CLYON",
    description:
      "Descreva o serviço, envie fotos e indique a morada. O pedido chega a profissionais verificados da sua zona e recebe propostas em até 6 horas.",
    url: "https://clyon.pt/simulador",
  },
};

export default function SimuladorPage() {
  return <SimulatorPage />;
}
