"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getColaboradorItem,
  clearColaboradorStorage,
} from "@/lib/colaborador-storage";
import { papelMexeNoDinheiro, type PapelDoPainel } from "@/lib/papel-do-painel";

export type AdminUser = {
  id: number;
  nome: string;
  isAdmin: boolean;
  papel: PapelDoPainel;
  funcao: string;
};

/**
 * Lê o papel guardado no browser.
 *
 * `colaborador_isAdmin = "1"` é administrador — a forma antiga, que continua
 * a valer. `colaborador_papel = "assistente"` é assistente. Qualquer outra
 * combinação não é sessão nenhuma.
 */
export function papelGuardadoNoBrowser(): PapelDoPainel | null {
  const isAdminStr = getColaboradorItem("isAdmin");
  if (isAdminStr === "1" || isAdminStr === "true") return "admin";
  if (getColaboradorItem("papel") === "assistente") return "assistente";
  return null;
}

/**
 * Este ecrã pode mostrar os botões de dinheiro e de taxas? — 03-10-2026.
 *
 * Decisão do dono: nas Carteiras, Pagamentos, Levantamentos, App CLYON e
 * Configs o assistente só vê. O servidor recusa-lhe as escritas na mesma
 * (`ESCRITAS_SO_DO_ADMINISTRADOR`); isto é para os botões nem aparecerem.
 *
 * Começa em `false` e só passa a `true` depois de montar e ler o papel: um
 * botão de dinheiro que pisca ao assistente é pior do que um que demora um
 * instante a aparecer ao administrador.
 */
export function useMexeNoDinheiro(): boolean {
  const [pode, setPode] = useState(false);
  useEffect(() => {
    setPode(papelMexeNoDinheiro(papelGuardadoNoBrowser()));
  }, []);
  return pode;
}

/**
 * Quem está ao ecrã é o administrador? Para os botões que o servidor recusa
 * a qualquer assistente — apagar, sobretudo (nenhum DELETE passa a um
 * assistente). Como o de cima, começa em `false` — 03-10-2026.
 */
export function useEAdministrador(): boolean {
  const [e, setE] = useState(false);
  useEffect(() => {
    setE(papelGuardadoNoBrowser() === "admin");
  }, []);
  return e;
}

/**
 * Hook de autenticação do backoffice.
 *
 * Fonte canónica: família colaborador_* (token, nome, id, isAdmin, papel,
 * funcao) gravada pelo /api/colaboradores/login e acessível via
 * getColaboradorItem.
 *
 * Aceita administradores e assistentes. Quem decide o que cada um pode
 * chamar é o servidor; isto só diz ao ecrã quem está a trabalhar.
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
    const funcao = getColaboradorItem("funcao") ?? "";

    if (t && nome) {
      const papel = papelGuardadoNoBrowser();
      if (!papel) {
        // Colaborador autenticado mas sem papel no backoffice
        clearColaboradorStorage();
        router.replace("/admin/login");
        return;
      }
      setToken(t);
      setUser({
        id: parseInt(idStr ?? "0", 10),
        nome,
        isAdmin: papel === "admin",
        papel,
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

  return { token, user, ready, logout, authHeader, papel: user?.papel ?? null };
}
