import MetricasClient from "./MetricasClient";

export const metadata = {
  // `absolute`: o título já diz a marca, e o template do layout
  // acrescentava outra — «… CLYON Admin | CLYON» (29-09-2026).
  title: { absolute: "Métricas — CLYON Admin" },
  robots: "noindex",
};

export default function MetricasPage() {
  return <MetricasClient />;
}
