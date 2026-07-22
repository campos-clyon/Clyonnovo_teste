"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

export type AdminUser = {
  id: number;
  nome: string;
  isAdmin: number;
  funcao: string;
};

export function useAdminAuth({ skip = false }: { skip?: boolean } = {}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(skip);

  useEffect(() => {
    if (skip) return;
    const t = localStorage.getItem("admin_token");
    const u = localStorage.getItem("admin_user");
    if (!t || !u) {
      router.replace("/admin/login");
      return;
    }
    try {
      const parsed = JSON.parse(u) as AdminUser;
      if (!parsed.isAdmin) {
        router.replace("/admin/login");
        return;
      }
      setToken(t);
      setUser(parsed);
      setReady(true);
    } catch {
      router.replace("/admin/login");
    }
  }, [router, skip]);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    router.push("/admin/login");
  }, [router]);

  const authHeader = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  return { token, user, ready, logout, authHeader };
}
