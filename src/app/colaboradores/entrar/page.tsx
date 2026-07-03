import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import EntrarForm from "./EntrarForm";

export const metadata = {
  title: "Entrar | Backoffice CLYON",
  robots: "noindex, nofollow",
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  // Se já tem sessão activa, redirecionar para o dashboard
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/colaboradores/dashboard");
  }

  const { erro } = await searchParams;
  return <EntrarForm erro={erro} />;
}
