"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Star, User, Sparkles } from "lucide-react";

/**
 * Barra de navegação inferior estilo app (inspirada na Oscar/Fixando).
 * Substitui a antiga barra de botões WhatsApp/Orçamento.
 * Só aparece em mobile; o desktop usa o Header. Escondida em áreas que já
 * têm o seu próprio shell (backoffice, portal de parceiros, simulador).
 */

const HIDDEN_PREFIXES = ["/colaboradores", "/parceiros", "/simulador"];

const LEFT = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/servicos", label: "Serviços", icon: LayoutGrid },
];

const RIGHT = [
  { href: "/avaliacoes", label: "Avaliações", icon: Star },
  { href: "/conta", label: "Conta", icon: User },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  const isHidden = HIDDEN_PREFIXES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  if (isHidden) return null;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const itemCls = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${
      active ? "text-cyan-600" : "text-slate-400"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm md:hidden">
      <div className="mx-auto flex max-w-md items-end px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
        {LEFT.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link key={href} href={href} className={itemCls(active)}>
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}

        {/* Botão central destacado — ação principal (Simular orçamento) */}
        <Link
          href="/simulador"
          className="flex flex-1 flex-col items-center justify-end gap-1"
          aria-label="Simular orçamento"
        >
          <span className="-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/40 ring-4 ring-white">
            <Sparkles className="h-6 w-6" />
          </span>
          <span className="text-[10px] font-semibold text-cyan-600">Simular</span>
        </Link>

        {RIGHT.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} className={itemCls(active)}>
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
