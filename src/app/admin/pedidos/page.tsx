import { redirect } from "next/navigation";

/*
 * A PÁGINA DOS PEDIDOS SAIU — 17-10-2026.
 *
 * «Quero que coloque a gestão de pedido para dentro de Início, e excluir a
 * página pedidos, mantendo essa gestão geral de pedidos num único lugar.» — o
 * dono. Esta era uma lista antiga, à parte do painel; a gestão dos pedidos
 * vive no Início do painel. Quem chega aqui por um link antigo vai para lá.
 * O detalhe de cada pedido (/admin/pedidos/<id>) fica: é para onde apontam os
 * avisos por email.
 */
export default function AdminPedidosPage() {
  redirect("/admin?section=pedidos");
}
