import type { Metadata } from "next";

import ColaboradorAlterarSenhaClient from "./ColaboradorAlterarSenhaClient";

export const metadata: Metadata = {
  title: "Alterar Palavra-passe",
  robots: { index: false, follow: false },
};

export default function ColaboradorAlterarSenhaPage() {
  return <ColaboradorAlterarSenhaClient />;
}

export const dynamic = "force-dynamic";
