import { redirect } from "next/navigation";

export default function AppPedidosLegacyPage() {
  redirect("/admin?section=app_clyon&tab=pedidos");
}
