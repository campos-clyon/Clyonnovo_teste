/**
 * NextAuth v4 — autenticação dos CLIENTES (Google).
 *
 * Entram por /entrar → callbackUrl /conta, com a conta criada automaticamente.
 *
 * O backoffice não passa por aqui: a administração entra em /admin/login com
 * email e senha, contra a tabela `colaboradores`, e recebe um JWT próprio.
 * O login Google de colaborador (/colaboradores/entrar + verify-email) existia
 * quando havia assistentes, motoristas e ajudantes — foi removido com eles.
 *
 * Nota: existia uma segunda instância (/api/auth/cliente) para clientes, removida
 * porque o NextAuth no Vercel ignora basePaths personalizados ao construir o
 * redirect_uri do OAuth, o que fazia o callback cair no handler errado.
 *
 * Variáveis de ambiente necessárias (adicionar no Vercel → Settings → Vars):
 *   NEXTAUTH_SECRET      — openssl rand -base64 32
 *   NEXTAUTH_URL         — https://clyon.pt (em produção) ou http://localhost:3000 (local)
 *   GOOGLE_CLIENT_ID     — Google Cloud Console → Credenciais → OAuth 2.0
 *   GOOGLE_CLIENT_SECRET — Google Cloud Console → Credenciais → OAuth 2.0
 */

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { registarCliente } from "@/lib/conta-server";
import { consumirLigacaoDeEntrada } from "@/lib/db";
import { pareceUmToken } from "@/lib/entrada-por-link";
import { hashDaLigacao } from "@/lib/entrada-por-link-segredo";
// getPool não é necessário aqui — verificação de colaborador movida para /api/colaboradores/verify-email

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID  ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),

    /**
     * Entrada pelo link enviado por email.
     *
     * O Google era a única porta, e deixava de fora quem nos deu um endereço
     * hotmail, sapo, live ou do trabalho — vinte e seis dos setenta e nove
     * clientes sem conta. Não era falta de vontade deles: não havia botão que
     * lhes servisse.
     *
     * ISTO NÃO ACEITA UM EMAIL. Aceita um token, e só um token. Se recebesse
     * o email, qualquer pessoa entrava na conta de qualquer outra escrevendo
     * o endereço — é o erro clássico deste tipo de provedor, e é fatal. O
     * email sai de dentro da linha guardada na base, nunca do que vem do
     * browser.
     *
     * O token é consumido aqui, num único UPDATE com a condição do uso único
     * lá dentro. Ver `consumirLigacaoDeEntrada`.
     */
    CredentialsProvider({
      id: "link-de-entrada",
      name: "Link de entrada",
      credentials: { token: { label: "Token", type: "text" } },

      async authorize(credenciais) {
        const token = credenciais?.token;

        // A forma verifica-se antes de tocar na base: sem isto, cada tentativa
        // com lixo custava uma consulta, e tentativas com lixo fazem-se aos
        // milhares.
        if (!pareceUmToken(token)) return null;

        try {
          const r = await consumirLigacaoDeEntrada(hashDaLigacao(token));
          if (!r.ok) return null;

          // O `id` é o email porque é ele que identifica um cliente em todo o
          // sistema — os pedidos ligam-se por email, não por número.
          return { id: r.email, email: r.email, name: null };
        } catch (err) {
          console.error("[link-de-entrada] falhou a consumir:", err);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      // Qualquer conta Google pode ser cliente — não há lista de autorizados.
      //
      // A conta fica gravada aqui, e não à espera de que a pessoa abra /conta.
      // Autenticar-se É criar conta; esperar por uma visita a uma página
      // específica deixava de fora quem entrasse e fosse fazer outra coisa.
      if (user?.email) {
        await registarCliente(user.email, user.name ?? null);
      }
      return true;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return `${baseUrl}/conta`;
    },
  },

  pages: {
    signIn: "/entrar",
    error:  "/entrar",
  },

  session: { strategy: "jwt" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
