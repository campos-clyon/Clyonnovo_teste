import type { Metadata } from "next";
import AprovarPedidoClient from "./AprovarPedidoClient";

export const metadata: Metadata = {
  // `absolute`: o título já diz a marca, e o template do layout
  // acrescentava outra — «… CLYON Admin | CLYON» (29-09-2026).
  title: { absolute: "Aprovar Pedido — CLYON Admin" },
  robots: "noindex,nofollow",
};

export default function AprovarPedidoPage() {
  return <AprovarPedidoClient />;
}
