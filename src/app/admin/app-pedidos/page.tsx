import { redirect } from "next/navigation";

// Compatibilidade: links antigos para /admin/app-pedidos redirecionam
// para a nova localização canónica em /admin/app-clyon/pedidos
export default function AppPedidosLegacyPage() {
  redirect("/admin/app-clyon/pedidos");
}
