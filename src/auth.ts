/**
 * Configuração do NextAuth v4 para colaboradores CLYON.
 *
 * Fluxo:
 *   1. Colaborador clica "Entrar com Google" em /colaboradores/entrar
 *   2. O callback signIn retorna true para qualquer conta Google (sem verificação de DB aqui)
 *   3. Após o redirect de regresso, EntrarForm.tsx faz fetch a /api/colaboradores/verify-email
 *   4. Se o email não estiver na tabela colaboradores → signOut + erro=nao_autorizado
 *   5. Se estiver → redireciona para /colaboradores/admin
 *
 * Esta abordagem evita que o handler de colaboradores bloqueie logins de clientes
 * que usam o handler separado /api/auth/cliente/[...nextauth] (auth-cliente.ts).
 *
 * Variáveis de ambiente necessárias (adicionar no Vercel → Settings → Vars):
 *   NEXTAUTH_SECRET      — openssl rand -base64 32
 *   NEXTAUTH_URL         — https://clyon.pt (em produção) ou http://localhost:3000 (local)
 *   GOOGLE_CLIENT_ID     — Google Cloud Console → Credenciais → OAuth 2.0
 *   GOOGLE_CLIENT_SECRET — Google Cloud Console → Credenciais → OAuth 2.0
 */

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
// getPool não é necessário aqui — verificação de colaborador movida para /api/colaboradores/verify-email

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID  ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],

  callbacks: {
    async signIn() {
      // Permitir qualquer login Google neste handler.
      // A verificação de autorização de colaborador é feita em EntrarForm.tsx
      // via fetch a /api/colaboradores/verify-email após o redirect do OAuth,
      // evitando que este callback bloqueie logins de clientes no handler separado.
      return true;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Após login bem-sucedido de colaborador → ir para /colaboradores/admin
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return `${baseUrl}/colaboradores/admin`;
    },
  },

  pages: {
    signIn: "/colaboradores/entrar",
    error:  "/colaboradores/entrar",
  },

  session: { strategy: "jwt" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
