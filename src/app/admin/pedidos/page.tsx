import type { Metadata } from "next";
import AdminPedidosClient from "./AdminPedidosClient";

export const metadata: Metadata = {
  // `absolute`: o título já diz a marca, e o template do layout
  // acrescentava outra — «… Admin CLYON | CLYON» (29-09-2026).
  title: { absolute: "Pedidos — Painel Admin CLYON" },
  robots: "noindex,nofollow",
};

export default function AdminPedidosPage() {
  return <AdminPedidosClient />;
}
