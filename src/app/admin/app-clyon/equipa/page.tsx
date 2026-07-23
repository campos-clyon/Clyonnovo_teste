import type { Metadata } from "next";
import EquipaClient from "./EquipaClient";

export const metadata: Metadata = {
  title: "App CLYON — Equipa",
  robots: "noindex,nofollow",
};

export default function EquipaPage() {
  return <EquipaClient />;
}
