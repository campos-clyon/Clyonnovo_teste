import type { Metadata } from "next";
import AppPedidosClient from "./AppPedidosClient";

export const metadata: Metadata = {
  title: "Pedidos App — Painel Admin CLYON",
  robots: "noindex,nofollow",
};

export default function AppPedidosPage() {
  return <AppPedidosClient />;
}
