import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { authOptions } from "@/auth";
import { AnimatedBackground } from "./AnimatedBackground";
import { ErrorHandler } from "./ErrorHandler";

export const metadata: Metadata = {
  title: "Entrar na tua conta | CLYON",
  description: "Acede à tua conta CLYON para acompanhar os teus pedidos.",
  robots: { index: false, follow: false },
};

export default async function EntrarPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/conta");

  return (
    <>
      <AnimatedBackground />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
        <Suspense fallback={null}>
          <ErrorHandler />
        </Suspense>
      </div>
    </>
  );
}
