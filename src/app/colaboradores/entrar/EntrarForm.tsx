"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Shield, LogIn, AlertCircle, Loader2 } from "lucide-react";

interface EntrarFormProps {
  erro?: string;
}

const ERRO_MESSAGES: Record<string, string> = {
  nao_autorizado: "Este email não tem acesso ao backoffice CLYON. Contacta o administrador.",
  OAuthSignin:    "Erro ao iniciar sessão com o Google. Tenta novamente.",
  OAuthCallback:  "Erro ao receber resposta do Google. Tenta novamente.",
  AccessDenied:   "Acesso negado. O teu email não está autorizado.",
  Default:        "Ocorreu um erro de autenticação. Tenta novamente.",
};

export default function EntrarForm({ erro }: EntrarFormProps) {
  const { data: session, status } = useSession();
  const [verificando, setVerificando] = useState(false);
  const erroMsg = erro ? (ERRO_MESSAGES[erro] ?? ERRO_MESSAGES.Default) : null;

  // Após login Google bem-sucedido, verificar se o email está autorizado
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;

    const verificarEmail = async () => {
      setVerificando(true);
      try {
        const res = await fetch("/api/colaboradores/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: session.user!.email }),
        });
        const data = await res.json() as { authorized?: boolean };

        if (!data.authorized) {
          // Email não autorizado: terminar sessão e mostrar erro
          await signOut({ callbackUrl: "/colaboradores/entrar?erro=nao_autorizado" });
        } else {
          // Autorizado: redirecionar para o painel de admin
          window.location.href = "/admin";
        }
      } catch {
        await signOut({ callbackUrl: "/colaboradores/entrar?erro=Default" });
      } finally {
        setVerificando(false);
      }
    };

    void verificarEmail();
  }, [status, session]);

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/colaboradores/entrar" });
  };

  // Estado de carregamento enquanto verifica autorização
  if (status === "loading" || verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">{verificando ? "A verificar autorização..." : "A carregar..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logótipo / título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Backoffice CLYON
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acesso exclusivo para colaboradores
          </p>
        </div>

        {/* Mensagem de erro */}
        {erroMsg && (
          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 mb-6 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{erroMsg}</span>
          </div>
        )}

        {/* Botão de login */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3.5 text-foreground font-medium text-sm hover:bg-accent transition-colors shadow-sm"
        >
          {/* Google icon SVG */}
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Entrar com Google
          <LogIn className="w-4 h-4 ml-auto text-muted-foreground" />
        </button>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Apenas contas Google autorizadas pela CLYON
        </p>
      </div>
    </div>
  );
}
