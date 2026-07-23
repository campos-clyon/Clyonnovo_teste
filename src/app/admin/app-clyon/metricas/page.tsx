import type { Metadata } from "next";
import MetricasAppClient from "./MetricasAppClient";

export const metadata: Metadata = {
  title: "App CLYON — Métricas",
  robots: "noindex,nofollow",
};

export default function MetricasAppPage() {
  return <MetricasAppClient />;
}
