import { redirect } from "next/navigation";

// Configuração foi removida do menu App CLYON. Redirect para Visão Geral.
export default function ConfigRedirect() {
  redirect("/admin?section=app_clyon&tab=visao-geral");
}
