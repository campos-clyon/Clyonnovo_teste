import type { Metadata } from "next";
import { Suspense } from "react";
import EntradaDeTeste from "./EntradaDeTeste";

export const metadata: Metadata = {
  // `absolute`: sem ele, o template do layout dava «CLYON plataforma | CLYON».
  title: { absolute: "CLYON plataforma" },
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
