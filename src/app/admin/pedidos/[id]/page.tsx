import type { Metadata } from "next";
import AdminPedidoDetalheClient from "./AdminPedidoDetalheClient";

export const metadata: Metadata = {
  // `absolute`: o título já diz a marca, e o template do layout
  // acrescentava outra — «… Admin CLYON | CLYON» (29-09-2026).
  title: { absolute: "Detalhe do Pedido — Painel Admin CLYON" },
  robots: "noindex,nofollow",
};

export default async function AdminPedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminPedidoDetalheClient id={Number(id)} />;
}
