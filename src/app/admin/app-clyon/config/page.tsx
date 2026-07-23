import type { Metadata } from "next";
import ConfigClient from "./ConfigClient";

export const metadata: Metadata = {
  title: "App CLYON — Configuração",
  robots: "noindex,nofollow",
};

export default function ConfigPage() {
  return <ConfigClient />;
}
