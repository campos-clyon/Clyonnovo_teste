import type { Metadata } from "next";
import AprovarPedidoClient from "./AprovarPedidoClient";

export const metadata: Metadata = {
  title: "Aprovar Pedido — CLYON Admin",
  robots: "noindex,nofollow",
};

export default function AprovarPedidoPage() {
  return <AprovarPedidoClient />;
}
