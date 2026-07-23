import { redirect } from "next/navigation";

export default async function PedidoDetalheRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin?section=app_clyon&tab=pedidos&pedido=${id}`);
}
