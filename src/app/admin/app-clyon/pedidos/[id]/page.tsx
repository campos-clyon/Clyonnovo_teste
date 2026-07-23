import type { Metadata } from "next";
import PedidoDetalheClient from "./PedidoDetalheClient";

export const metadata: Metadata = {
  title: "Detalhe do Pedido — App CLYON",
  robots: "noindex,nofollow",
};

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PedidoDetalheClient id={id} />;
}
