import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import ContaCliente from "./ContaCliente";

export const metadata: Metadata = {
  title: "A minha conta | CLYON",
  description: "Os teus pedidos e histórico de serviços CLYON.",
  robots: { index: false, follow: false },
};

export default async function ContaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/entrar");

  return (
    <ContaCliente
      nome={session.user.name ?? ""}
      email={session.user.email ?? ""}
      avatar={session.user.image ?? null}
    />
  );
}
