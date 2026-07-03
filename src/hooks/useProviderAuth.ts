"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

export type ProviderUser = {
  id: number;
  name: string;
  email: string | null;
};

export function useProviderAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("provider_token");
    const p = localStorage.getItem("provider_user");
    if (!t || !p) {
      router.replace("/parceiros/entrar");
      return;
    }
    try {
      const parsed = JSON.parse(p) as ProviderUser;
      setToken(t);
      setProvider(parsed);
      setReady(true);
    } catch {
      router.replace("/parceiros/entrar");
    }
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("provider_token");
    localStorage.removeItem("provider_user");
    router.push("/parceiros/entrar");
  }, [router]);

  // Memoizado por token — uma referência nova a cada render faria os useCallback/useEffect
  // que dependem de authHeader disparar em loop infinito nos consumidores.
  const authHeader = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  return { token, provider, ready, logout, authHeader };
}
