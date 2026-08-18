import type { Metadata } from "next";
import EntrarForm from "./EntrarForm";

export const metadata: Metadata = {
  title: "Entrar — CLYON profissionais",
  description: "Entre no painel de profissionais CLYON para ver os seus pedidos.",
  robots: { index: false, follow: false },
};

export default function EntrarProfissionalPage() {
  return <EntrarForm />;
}
