"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getColaboradorItem,
  clearColaboradorStorage,
} from "@/lib/colaborador-storage";

export type AdminUser = {
  id: number;
  nome: string;
  isAdmin: boolean;
  funcao: string;
};

/**
 * Hook de autenticação administrativa.
 *
 * Fonte canónica: família colaborador_* (token, nome, id, isAdmin, funcao)
 * gravada pelo /api/colaboradores/login e acessível via getColaboradorItem.
 *
 * Migração de compatibilidade: se encontrar admin_token/admin_user (formato
 * antigo), lê uma vez e limpa; o utilizador fará novo login com o formato
 * correcto.
 */
export function useAdminAuth({ skip = false }: { skip?: boolean } = {}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(skip);

  useEffect(() => {
    if (skip) return;

    // ── Fonte canónica: colaborador_* ─────────────────────────────────────────
    const t = getColaboradorItem("token");
    const nome = getColaboradorItem("nome");
    const idStr = getColaboradorItem("id");
    const isAdminStr = getColaboradorItem("isAdmin");
    const funcao = getColaboradorItem("funcao") ?? "";

    if (t && nome) {
      const isAdmin = isAdminStr === "1" || isAdminStr === "true";
      if (!isAdmin) {
        // Colaborador autenticado mas sem acesso administrativo
        router.replace("/admin/login");
        return;
      }
      setToken(t);
      setUser({
        id: parseInt(idStr ?? "0", 10),
        nome,
        isAdmin,
        funcao,
      });
      setReady(true);
      return;
    }

    // ── Migração de compatibilidade: formato antigo admin_token/admin_user ────
    // Lê uma vez; se encontrar, limpa e força novo login.
    if (typeof window !== "undefined") {
      const oldToken = localStorage.getItem("admin_token");
      if (oldToken) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      }
    }

    router.replace("/admin/login");
  }, [router, skip]);

  const logout = useCallback(() => {
    clearColaboradorStorage();
    // Limpar também chaves legadas caso existam
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
    }
    router.push("/admin/login");
  }, [router]);

  const authHeader = useMemo(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` } as Record<string, string>;
  }, [token]);

  return { token, user, ready, logout, authHeader };
}
