"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminSidebar from "@/components/admin/AdminSidebar";

const TABS = [
  { href: "/admin/app-clyon/visao-geral", label: "Visão Geral" },
  { href: "/admin/app-clyon/pedidos",     label: "Pedidos" },
  { href: "/admin/app-clyon/agenda",      label: "Agenda" },
  { href: "/admin/app-clyon/equipa",      label: "Equipa" },
  { href: "/admin/app-clyon/catalogo",    label: "Catálogo" },
  { href: "/admin/app-clyon/config",      label: "Configuração" },
  { href: "/admin/app-clyon/metricas",    label: "Métricas" },
] as const;

export default function AppClyonShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAdminAuth();
  const pathname = usePathname();

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080F1A]">
        <svg className="h-8 w-8 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#080F1A]">
      {/* Sidebar — visível ≥ md */}
      <div className="hidden md:flex">
        <AdminSidebar user={user} onLogout={logout} />
      </div>

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Cabeçalho da secção */}
        <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#080F1A] px-5 pt-5 md:px-6">
          <div className="flex items-center gap-3 pb-1">
            <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div>
              <h1 className="text-sm font-bold text-white">App CLYON</h1>
              <p className="text-[10px] text-slate-500">Gestão operacional dos pedidos recebidos pela aplicação móvel</p>
            </div>
          </div>

          {/* Tabs de sub-navegação */}
          <nav className="mt-3 flex gap-0.5 overflow-x-auto pb-0" aria-label="Secções App CLYON">
            {TABS.map((tab) => {
              const isActive =
                tab.href === "/admin/app-clyon/pedidos"
                  ? pathname.startsWith("/admin/app-clyon/pedidos")
                  : pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex-shrink-0 rounded-t-xl px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                    isActive
                      ? "bg-[#0A1220] text-cyan-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Conteúdo da tab activa */}
        <main className="flex-1 overflow-y-auto bg-[#0A1220]">{children}</main>
      </div>
    </div>
  );
}
