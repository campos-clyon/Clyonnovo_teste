import type { Metadata } from "next";

import ColaboradorLoginClient from "./login/ColaboradorLoginClient";

export const metadata: Metadata = {
  title: "Portal do Colaborador",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ColaboradoresPage() {
  return <ColaboradorLoginClient />;
}
