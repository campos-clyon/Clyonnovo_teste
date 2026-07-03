import type { Metadata } from "next";
import AdminTrabalhosClient from "./AdminTrabalhosClient";

export const metadata: Metadata = {
  title: "Trabalhos Realizados — Admin CLYON",
  description: "Gerir trabalhos realizados visíveis em clyon.pt/trabalhos.",
  robots: "noindex,nofollow",
};

export default function AdminTrabalhosPage() {
  return <AdminTrabalhosClient />;
}
