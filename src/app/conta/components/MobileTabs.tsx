"use client";

import {
  LayoutDashboard,
  ClipboardList,
} from "lucide-react";
import type { Section } from "./types";

// Só as 2 secções mais usadas ficam na barra — as restantes (Dados, Fatura,
// Notif., Segurança) vivem como lista dentro de "Geral", ao estilo do
// ecrã de Perfil da Oscar, para não cortar abas num ecrã estreito.
const TABS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "visao-geral", label: "Geral",   icon: LayoutDashboard },
  { id: "pedidos",     label: "Pedidos", icon: ClipboardList },
];

interface Props {
  section: Section;
  onSection: (s: Section) => void;
}

export default function MobileTabs({ section, onSection }: Props) {
  return (
    <div className="sticky top-0 z-10 flex overflow-x-auto border-b border-slate-100 bg-white scrollbar-hide">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = section === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSection(id)}
            className={`flex shrink-0 flex-col items-center gap-1 px-4 py-3 text-xs font-medium transition border-b-2 ${
              active
                ? "border-[#00B4D8] text-[#0077B6]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
