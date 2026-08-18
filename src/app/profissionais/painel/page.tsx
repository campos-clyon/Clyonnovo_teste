import type { Metadata } from "next";
import PainelDoProfissional from "./PainelDoProfissional";

export const metadata: Metadata = {
  title: "Os meus pedidos — CLYON profissionais",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function PainelProfissionalPage() {
  return <PainelDoProfissional />;
}
