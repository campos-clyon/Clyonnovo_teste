import type { Metadata } from "next";
import AppClyonPedidosClient from "./AppClyonPedidosClient";

export const metadata: Metadata = {
  title: "App CLYON — Pedidos",
  robots: "noindex,nofollow",
};

export default function AppClyonPedidosPage() {
  return <AppClyonPedidosClient />;
}
