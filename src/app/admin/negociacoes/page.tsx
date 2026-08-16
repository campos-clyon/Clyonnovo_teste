import type { Metadata } from "next";
import AdminNegociacoesClient from "./AdminNegociacoesClient";

export const metadata: Metadata = {
  title: "Pedidos da plataforma — Admin CLYON",
  description: "Acompanhar negociações e reenviar links de acesso.",
  robots: "noindex,nofollow",
};

export default function AdminNegociacoesPage() {
  return <AdminNegociacoesClient />;
}
