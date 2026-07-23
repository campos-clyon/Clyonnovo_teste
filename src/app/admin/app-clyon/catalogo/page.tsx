import { redirect } from "next/navigation";

export default function CatalogoRedirect() {
  redirect("/admin?section=app_clyon&tab=catalogo");
}
