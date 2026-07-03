import type { Metadata } from "next";
import AdminPedidosClient from "./AdminPedidosClient";

export const metadata: Metadata = {
  title: "Pedidos — Painel Admin CLYON",
  robots: "noindex,nofollow",
};

export default function AdminPedidosPage() {
  return <AdminPedidosClient />;
}
