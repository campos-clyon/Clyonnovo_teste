import type { Metadata } from "next";
import { Suspense } from "react";
import EntradaDeTeste from "./EntradaDeTeste";

export const metadata: Metadata = {
  title: "CLYON plataforma",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default function EntrarNaPlataformaPage() {
  return (
    <Suspense fallback={<div className="py-24" />}>
      <EntradaDeTeste />
    </Suspense>
  );
}
