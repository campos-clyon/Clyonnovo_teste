import type { Metadata } from "next";
import VisaoGeralClient from "./VisaoGeralClient";

export const metadata: Metadata = {
  title: "App CLYON — Visão Geral",
  robots: "noindex,nofollow",
};

export default function VisaoGeralPage() {
  return <VisaoGeralClient />;
}
