import type { Metadata } from "next";
import ColaboradorDashboardClient from "./ColaboradorDashboardClient";

export const metadata: Metadata = {
  title: "Dashboard do Colaborador",
  robots: { index: false, follow: false },
};

export default function ColaboradorDashboardPage() {
  return <ColaboradorDashboardClient />;
}
export const dynamic = 'force-dynamic';
