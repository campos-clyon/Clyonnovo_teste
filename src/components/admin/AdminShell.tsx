"use client";

import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAdminAuth();

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#080F1A]">
      {/* Sidebar — hidden on mobile, shown ≥ md */}
      <div className="hidden md:flex">
        <AdminSidebar user={user} onLogout={logout} />
      </div>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#0A1220]">
        {children}
      </main>
    </div>
  );
}
