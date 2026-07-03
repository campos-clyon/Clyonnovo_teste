"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export type AdminUser = {
  id: number;
  nome: string;
  isAdmin: number;
  funcao: string;
};

export function useAdminAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    router.push("/admin/login");
  }, [router]);

  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  return { token, user, ready, logout, authHeader };
}
