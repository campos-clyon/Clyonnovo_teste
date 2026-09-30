import type { Metadata } from "next";
import EntrarForm from "./EntrarForm";

export const metadata: Metadata = {
  // `absolute`: o título já diz a marca, e o template do layout
  // acrescentava outra — «… CLYON profissionais | CLYON» (29-09-2026).
  title: { absolute: "Entrar — CLYON profissionais" },
  description: "Entre no painel de profissionais CLYON para ver os seus pedidos.",
  robots: { index: false, follow: false },
};

export default function EntrarProfissionalPage() {
  return <EntrarForm />;
}
