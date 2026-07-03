import type { Metadata } from "next";
import ParceiroDashboardClient from "./ParceiroDashboardClient";

export const metadata: Metadata = {
  title: "Painel do Parceiro — CLYON",
  robots: "noindex,nofollow",
};

export default function ParceiroDashboardPage() {
  return <ParceiroDashboardClient />;
}
