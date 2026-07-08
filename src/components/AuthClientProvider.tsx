"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Envolve a aplicação com o SessionProvider único do NextAuth.
 * Clientes e colaboradores partilham a mesma instância (/api/auth) —
 * a distinção é feita após o login (verify-email para colaboradores).
 * Instância separada de clientes foi removida: o NextAuth no Vercel ignora
 * basePaths personalizados, o que quebrava o callback OAuth.
 */
export default function AuthClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
