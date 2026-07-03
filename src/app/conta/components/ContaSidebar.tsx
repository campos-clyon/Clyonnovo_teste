"use client";

import { signOut } from "next-auth/react";
import UserAvatar from "@/components/UserAvatar";
import {
  LayoutDashboard,
  ClipboardList,
  User,
  Receipt,
  Bell,
  Shield,
  LogOut,
} from "lucide-react";
import type { Section } from "./types";

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "visao-geral",    label: "Visão Geral",      icon: LayoutDashboard },
  { id: "pedidos",        label: "Os meus pedidos",  icon: ClipboardList },
  { id: "dados-pessoais", label: "Dados pessoais",   icon: User },
  { id: "faturacao",      label: "Faturação",        icon: Receipt },
  { id: "notificacoes",   label: "Notificações",     icon: Bell },
  { id: "seguranca",      label: "Segurança",        icon: Shield },
];

interface Props {
  section: Section;
  onSection: (s: Section) => void;
  nome: string;
  email: string;
  avatar: string | null;
}

export default function ContaSidebar({ section, onSection, nome, email, avatar }: Props) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-100 bg-white">
      {/* Utilizador */}
      <div className="flex flex-col items-center gap-2 border-b border-slate-100 px-4 py-6 text-center">
        <UserAvatar
          src={avatar}
          name={nome}
          size={56}
          className="ring-2 ring-[#00B4D8]/20"
        />
        <div className="min-w-0 w-full">
          <p className="truncate text-sm font-semibold text-slate-800">{nome}</p>
          <p className="truncate text-xs text-slate-400">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-2 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSection(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-[#00B4D8]/8 text-[#0077B6]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#00B4D8]" : "text-slate-400"}`} />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
