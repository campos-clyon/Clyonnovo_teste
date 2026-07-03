import type { Metadata } from "next";
import AdminPedidoDetalheClient from "./AdminPedidoDetalheClient";

export const metadata: Metadata = {
  title: "Detalhe do Pedido — Painel Admin CLYON",
  robots: "noindex,nofollow",
};

export default async function AdminPedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminPedidoDetalheClient id={Number(id)} />;
}
