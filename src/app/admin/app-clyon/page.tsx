import { redirect } from "next/navigation";

export default function AppClyonRootPage() {
  redirect("/admin?section=app_clyon&tab=visao-geral");
}
