import { redirect } from "next/navigation";

export default function PedidosRedirect() {
  redirect("/admin?section=app_clyon&tab=pedidos");
}
