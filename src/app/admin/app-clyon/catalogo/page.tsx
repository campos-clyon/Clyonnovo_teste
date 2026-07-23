import type { Metadata } from "next";
import CatalogoClient from "./CatalogoClient";

export const metadata: Metadata = {
  title: "App CLYON — Catálogo",
  robots: "noindex,nofollow",
};

export default function CatalogoPage() {
  return <CatalogoClient />;
}
