import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import ContaCliente from "./ContaCliente";
import { loadContaData } from "@/lib/conta-server";

export const metadata: Metadata = {
  title: "A minha conta | CLYON",
  description: "Os teus pedidos e histórico de serviços CLYON.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/entrar");

  // Pre-carregar em SSR — evita o estado vazio de ~7s no cliente
  let initial: Awaited<ReturnType<typeof loadContaData>> | null = null;
  try {
    initial = await loadContaData(session.user.email, session.user.name ?? null);
  } catch {
    initial = null; // se falhar, o cliente faz fetch como fallback
  }

  return (
    <ContaCliente
      nome={session.user.name ?? ""}
      email={session.user.email ?? ""}
      avatar={session.user.image ?? null}
      initialUser={(initial?.user as any) ?? null}
      initialOrders={(initial?.orders as any) ?? []}
      initialSummary={(initial?.summary as any) ?? null}
    />
  );
}
