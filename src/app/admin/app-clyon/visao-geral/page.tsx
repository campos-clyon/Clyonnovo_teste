import { redirect } from "next/navigation";

export default function VisaoGeralRedirect() {
  redirect("/admin?section=app_clyon&tab=visao-geral");
}
