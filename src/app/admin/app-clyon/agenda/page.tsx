import { redirect } from "next/navigation";

export default function AgendaRedirect() {
  redirect("/admin?section=app_clyon&tab=agenda");
}
