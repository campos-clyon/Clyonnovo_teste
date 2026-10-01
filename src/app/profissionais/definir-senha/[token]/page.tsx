import type { Metadata } from "next";
import DefinirSenhaForm from "./DefinirSenhaForm";

export const metadata: Metadata = {
  // `absolute`: o título já diz a marca, e o template do layout
  // acrescentava outra — «… CLYON profissionais | CLYON» (29-09-2026).
  title: { absolute: "Escolher palavra-passe — CLYON profissionais" },
  robots: { index: false, follow: false },
};

export default async function DefinirSenhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <DefinirSenhaForm token={token} />;
}
