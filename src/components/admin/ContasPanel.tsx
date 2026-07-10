"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Mail, Phone, MapPin, Shield, ShieldOff, RefreshCw } from "lucide-react";

interface UserAccount {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  addressCity: string | null;
  loginMethod: string;
  role: string;
  nif: string | null;
  createdAt: string;
  lastSignedIn: string | null;
  deletedAt: string | null;
}

interface ContasPanelProps {
  authToken: string;
}

export default function ContasPanel({ authToken }: ContasPanelProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "user" | "admin">("all");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateUser = async (id: number, patch: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro");
    }
  };

  const activeUsers = users.filter((u) => !u.deletedAt);
  const deletedUsers = users.filter((u) => u.deletedAt);

  const filtered = activeUsers.filter((u) => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (u.name ?? "").toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      (u.phone ?? "").includes(s) ||
      (u.addressCity ?? "").toLowerCase().includes(s)
    );
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-600" />
            Contas de Clientes
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {activeUsers.length} conta{activeUsers.length !== 1 ? "s" : ""} ativa{activeUsers.length !== 1 ? "s" : ""}
            {deletedUsers.length > 0 && ` · ${deletedUsers.length} desativada${deletedUsers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome, email, telefone ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "user", "admin"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                filterRole === r
                  ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {r === "all" ? "Todos" : r === "user" ? "Clientes" : "Admins"}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading && users.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> A carregar...
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 hidden md:table-cell">Telefone</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 hidden lg:table-cell">Cidade</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 hidden lg:table-cell">Login</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Criada</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 hidden md:table-cell">Último acesso</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      {search ? "Sem resultados para esta pesquisa" : "Sem contas registadas"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {u.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <a href={`mailto:${u.email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-cyan-600">
                          <Mail className="h-3.5 w-3.5" />
                          {u.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {u.phone ? (
                          <a href={`tel:${u.phone}`} className="flex items-center gap-1.5 text-slate-600 hover:text-cyan-600">
                            <Phone className="h-3.5 w-3.5" />
                            {u.phone}
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {u.addressCity ? (
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <MapPin className="h-3.5 w-3.5" />
                            {u.addressCity}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {u.loginMethod === "google" ? "Google" : u.loginMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                        {formatDateTime(u.lastSignedIn)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          u.role === "admin"
                            ? "bg-violet-50 text-violet-700 border border-violet-200"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {u.role === "admin" ? <Shield className="h-3 w-3" /> : null}
                          {u.role === "admin" ? "Admin" : "Cliente"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {u.role === "user" ? (
                            <button
                              onClick={() => updateUser(u.id, { role: "admin" })}
                              title="Promover a admin"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition"
                            >
                              <Shield className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => updateUser(u.id, { role: "user" })}
                              title="Remover admin"
                              className="rounded-lg p-1.5 text-violet-400 hover:bg-slate-100 hover:text-slate-600 transition"
                            >
                              <ShieldOff className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Desativar conta de ${u.name || u.email}?`)) {
                                updateUser(u.id, { deletedAt: new Date().toISOString() });
                              }
                            }}
                            title="Desativar conta"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deactivated accounts */}
      {deletedUsers.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900">
            Contas desativadas ({deletedUsers.length})
          </summary>
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="space-y-2">
              {deletedUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{u.name || "—"}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                  <button
                    onClick={() => updateUser(u.id, { deletedAt: null })}
                    className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    Reativar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
