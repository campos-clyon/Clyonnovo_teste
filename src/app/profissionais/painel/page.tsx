import type { Metadata } from "next";
import { Suspense } from "react";
import PainelDoProfissional from "./PainelDoProfissional";

export const metadata: Metadata = {
  title: "A minha conta — CLYON profissionais",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * O ecrã aberto vem da query (`?ecra=carteira`), e `useSearchParams` obriga a
 * uma fronteira de suspense — sem ela o build recusa a página inteira.
 */
export default function PainelProfissionalPage() {
  return (
    <Suspense fallback={<div className="py-24" />}>
      <PainelDoProfissional />
    </Suspense>
  );
}
