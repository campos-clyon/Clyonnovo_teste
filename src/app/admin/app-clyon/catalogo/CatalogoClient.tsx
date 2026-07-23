"use client";

import { useCallback, useEffect, useState } from "react";
import AppClyonShell from "../AppClyonShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Category = {
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number | null;
  request_count: number;
};

export default function CatalogoClient() {
  const { authHeader, ready } = useAdminAuth({ skip: false });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/app-clyon/catalogo", { headers: authHeader });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao carregar."); return; }
      setCategories(data.categories ?? []);
    } catch {
      setError("Erro de ligação.");
    } finally {
      setLoading(false);
    }
  }, [ready, authHeader]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(cat: Category) {
    setToggling(cat.slug);
    try {
      const res = await fetch(`/api/admin/app-clyon/catalogo/${cat.slug}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !cat.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao actualizar.");
        return;
      }
      setCategories((prev) =>
        prev.map((c) => (c.slug === cat.slug ? { ...c, is_active: !c.is_active } : c)),
      );
    } catch {
      setError("Erro de ligação.");
    } finally {
      setToggling(null);
    }
  }

  return (
    <AppClyonShell>
      <div className="px-5 py-6 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Catálogo</h2>
            <p className="text-xs text-slate-500">
              Categorias de serviço visíveis na aplicação — activar/arquivar sem apagar histórico
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-xs underline">Fechar</button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="h-6 w-6 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && categories.length === 0 && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] py-12 text-center text-sm text-slate-600">
            Sem categorias encontradas na tabela <code>service_categories</code>.
          </div>
        )}

        {!loading && categories.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
            {categories.map((cat, i) => (
              <div
                key={cat.slug}
                className={`flex items-center gap-4 px-4 py-4 ${
                  i < categories.length - 1 ? "border-b border-white/[0.04]" : ""
                } ${!cat.is_active ? "opacity-50" : ""}`}
              >
                {/* Ícone */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-xl">
                  {cat.icon || "📦"}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{cat.name}</p>
                    {!cat.is_active && (
                      <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-500">
                        Arquivada
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 font-mono">{cat.slug}</p>
                  {cat.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{cat.description}</p>
                  )}
                </div>

                {/* Contagem de pedidos históricos */}
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{cat.request_count}</p>
                  <p className="text-[10px] text-slate-600">pedidos</p>
                </div>

                {/* Toggle activo/arquivado */}
                <button
                  onClick={() => handleToggle(cat)}
                  disabled={toggling === cat.slug}
                  title={cat.is_active ? "Arquivar categoria" : "Activar categoria"}
                  className={`flex-shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    cat.is_active
                      ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                      : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  }`}
                >
                  {toggling === cat.slug ? "..." : cat.is_active ? "Arquivar" : "Activar"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4">
          <p className="text-xs text-amber-300/70">
            <strong className="text-amber-300">Atenção:</strong> Arquivar uma categoria não apaga pedidos históricos.
            Apenas impede novos pedidos dessa categoria. Categorias com pedidos não podem ser eliminadas.
          </p>
        </div>
      </div>
    </AppClyonShell>
  );
}
