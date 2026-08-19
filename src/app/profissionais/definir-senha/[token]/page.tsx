import type { Metadata } from "next";
import DefinirSenhaForm from "./DefinirSenhaForm";

export const metadata: Metadata = {
  title: "Criar palavra-passe — CLYON profissionais",
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
