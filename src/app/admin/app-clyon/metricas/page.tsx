import { redirect } from "next/navigation";

export default function MetricasRedirect() {
  redirect("/admin?section=app_clyon&tab=metricas");
}
