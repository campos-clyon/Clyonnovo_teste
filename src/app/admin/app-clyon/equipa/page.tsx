import { redirect } from "next/navigation";

export default function EquipaRedirect() {
  redirect("/admin?section=app_clyon&tab=profissionais");
}
