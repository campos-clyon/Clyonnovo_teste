import { redirect } from "next/navigation";

export default function ConfigRedirect() {
  redirect("/admin?section=app_clyon&tab=config");
}
