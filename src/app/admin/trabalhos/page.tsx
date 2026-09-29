import type { Metadata } from "next";
import AdminTrabalhosClient from "./AdminTrabalhosClient";

export const metadata: Metadata = {
  // `absolute`: o título já diz a marca, e o template do layout
  // acrescentava outra — «… Admin CLYON | CLYON» (29-09-2026).
  title: { absolute: "Trabalhos Realizados — Admin CLYON" },
  description: "Gerir trabalhos realizados visíveis em clyon.pt/trabalhos.",
  robots: "noindex,nofollow",
};

export default function AdminTrabalhosPage() {
  return <AdminTrabalhosClient />;
}
