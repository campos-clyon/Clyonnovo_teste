"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Envolve a aplicação pública com o SessionProvider do NextAuth de cliente.
 * Usa a rota /api/auth/cliente para separar sessões de clientes e colaboradores.
 */
export default function AuthClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider basePath="/api/auth/cliente">
      {children}
    </SessionProvider>
  );
}
