"use client";

import { useSearchParams } from "next/navigation";
import { PremiumLoginCard } from "./PremiumLoginCard";

const errorMessages: Record<string, string> = {
  OAuthSignin: "Erro ao iniciar sessão com Google. Tenta de novo.",
  OAuthCallback: "Erro na resposta do Google. Tenta de novo.",
  OAuthCreateAccount: "Não foi possível criar a conta. Contacta o suporte.",
  Default: "Ocorreu um erro. Tenta de novo.",
};

export function ErrorHandler() {
  const params = useSearchParams();
  const errorCode = params.get("error");
  const errorMsg = errorCode ? (errorMessages[errorCode] ?? errorMessages.Default) : null;

  return <PremiumLoginCard errorMsg={errorMsg} />;
}
