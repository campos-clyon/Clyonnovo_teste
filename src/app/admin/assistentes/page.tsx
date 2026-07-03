import type { Metadata } from "next";
import AdminAssistentesClient from "./AdminAssistentesClient";

export const metadata: Metadata = {
  title: "Assistentes — Painel Admin CLYON",
  robots: "noindex,nofollow",
};

export default function AdminAssistentesPage() {
  return <AdminAssistentesClient />;
}
