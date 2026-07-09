"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  MessageCircle,
  Sofa,
  HardHat,
  Package,
  Home,
  Sparkles,
  TreePine,
  Truck,
  Refrigerator,
  Zap,
  ArrowRight,
  Clock,
  User,
  LogOut,
  ClipboardList,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";

import { trackWhatsAppClick } from "@/lib/analytics";
import { trackContactEvent } from "@/lib/track-contact";
import { BUSINESS_PHONE } from "@/lib/seo-data";
import HeaderLocationSelector from "@/components/HeaderLocationSelector";

const solucoes = [
  {
    label: "Recolha de Móveis",
    description: "Sofás, camas, armários, colchões e recheios.",
    href: "/recolha-de-moveis",
    icon: Sofa,
  },
  {
    label: "Recolha de Entulho",
    description: "Sacos de obra, restos de remodelação e resíduos de construção.",
    href: "/recolha-de-entulho",
    icon: HardHat,
  },
  {
    label: "Recolha de Monos",
    description: "Volumes grandes, objetos antigos e materiais acumulados.",
    href: "/recolha-de-monos",
    icon: Package,
  },
  {
    label: "Esvaziamento de Casas",
    description: "Retirada completa de móveis, recheios e objetos.",
    href: "/esvaziamento-de-casas",
    icon: Home,
  },
  {
    label: "Limpeza Pós-Obra",
    description: "Apoio após remodelações, obras e mudanças.",
    href: "/limpeza-pos-obra",
    icon: Sparkles,
  },
  {
    label: "Limpeza de Quintais",
    description: "Lixo verde, resíduos exteriores e limpeza de espaços.",
    href: "/limpeza-de-quintais",
    icon: TreePine,
  },
  {
    label: "Mudanças",
    description: "Transporte, carga e descarga com equipa.",
    href: "/mudancas",
    icon: Truck,
  },
  {
    label: "Recolha de Eletrodomésticos",
    description: "Máquinas, frigoríficos e equipamentos grandes.",
    href: "/recolha-de-eletrodomesticos",
    icon: Refrigerator,
  },
  {
    label: "Serviço Urgente",
    description: "Pedidos rápidos em Lisboa, Margem Sul e Setúbal.",
    href: "/recolha-de-moveis-urgente",
    icon: Zap,
  },
];

const navLinks = [
  { label: "Trabalhos", href: "/trabalhos" },
  { label: "Avaliações", href: "/avaliacoes" },
  { label: "Contactos", href: "/contactos" },
];

export default function Header() {
  const [solucoesOpen, setSolucoesOpen] = useState(false);
  const [contaOpen, setContaOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contaRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession();
  const pathname = usePathname();
  const isContaActive = pathname?.startsWith("/conta") ?? false;

  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Gostava de pedir um orçamento à CLYON.")}`;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setSolucoesOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleContaOutside(event: MouseEvent) {
      if (contaRef.current && !contaRef.current.contains(event.target as Node)) {
        setContaOpen(false);
      }
    }
    document.addEventListener("mousedown", handleContaOutside);
    return () => document.removeEventListener("mousedown", handleContaOutside);
  }, []);

  return (
    <>
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-100 bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/logo-clyon.png"
            alt="CLYON - Recolha de Móveis e Entulho"
            className="h-8 w-auto sm:h-10"
            width={205}
            height={84}
            priority
            sizes="205px"
          />
        </Link>

        {/* Location Selector */}
        <div className="hidden lg:flex ml-5">
          <HeaderLocationSelector />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {/* Soluções dropdown */}
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setSolucoesOpen(!solucoesOpen)}
              onMouseEnter={() => setSolucoesOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                solucoesOpen
                  ? "bg-slate-50 text-cyan-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-cyan-600"
              }`}
            >
              Soluções
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  solucoesOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Other nav links */}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2.5 text-[0.9375rem] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-cyan-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA Buttons */}
        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick("header")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#20bd5a]"
          >
            <MessageCircle className="h-4 w-4 text-white" />
            <span className="text-white">WhatsApp</span>
          </a>

          {/* Botão conta / entrar */}
          {session?.user ? (
            <div className="relative" ref={contaRef}>
              <button
                type="button"
                onClick={() => setContaOpen(!contaOpen)}
                className={`rounded-full border-2 transition ${
                  isContaActive
                    ? "border-cyan-500 ring-2 ring-cyan-500 ring-offset-2"
                    : "border-cyan-200 hover:border-cyan-400"
                }`}
                aria-label="Menu da conta"
              >
                <UserAvatar
                  src={session.user.image}
                  name={session.user.name ?? session.user.email}
                  size={36}
                />
              </button>
              {contaOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
                  <div className="border-b border-slate-100 px-4 pb-2 pt-1.5">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {session.user.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {session.user.email}
                    </p>
                  </div>
                  <Link
                    href="/conta"
                    onClick={() => setContaOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-cyan-700"
                  >
                    <ClipboardList className="h-4 w-4" />
                    A minha conta
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setContaOpen(false); signOut({ callbackUrl: "/" }); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/entrar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-cyan-700"
            >
              <User className="h-4 w-4" />
              Entrar
            </Link>
          )}
        </div>

        {/* Mobile: topo mínimo (localização + conta). A navegação vive na barra
            inferior estilo app — sem menu hambúrguer para evitar dois menus. */}
        <div className="flex items-center gap-2 lg:hidden">
          <HeaderLocationSelector />
          {session?.user ? (
            <Link
              href="/conta"
              aria-label="A minha conta"
              className={`rounded-full border-2 transition ${
                isContaActive
                  ? "border-cyan-500 ring-2 ring-cyan-500 ring-offset-2"
                  : "border-cyan-200 hover:border-cyan-400"
              }`}
            >
              <UserAvatar
                src={session.user.image}
                name={session.user.name ?? session.user.email}
                size={36}
              />
            </Link>
          ) : (
            <Link
              href="/entrar"
              aria-label="Entrar na conta"
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-200 text-slate-500 transition hover:border-cyan-300 hover:text-cyan-600"
            >
              <User className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Mega Menu Dropdown - Centralized */}
      {solucoesOpen && (
        <div
          ref={dropdownRef}
          onMouseLeave={() => setSolucoesOpen(false)}
          className="absolute left-1/2 top-full z-50 hidden w-[min(1200px,calc(100vw-48px))] -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200 lg:block"
        >
          <div className="mt-2 rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
            <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
              {/* Left Column - Info */}
              <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-cyan-50 to-slate-50 p-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Soluções CLYON</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Servicos profissionais de recolha, limpeza, transporte e esvaziamento em Lisboa, Margem Sul e Setubal.
                  </p>
                </div>
                <div className="mt-6 space-y-3">
                  <Link
                    href="/simulador"
                    onClick={() => setSolucoesOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-700"
                  >
                    Pedir orçamento
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm text-slate-600">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    <span>Resposta rápida em 24h</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Solutions Grid */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {solucoes.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setSolucoesOpen(false)}
                    className="group flex items-start gap-3 rounded-xl p-3 transition-all hover:-translate-y-0.5 hover:bg-cyan-50"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 group-hover:text-cyan-700">
                        {item.label}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Não encontra o que procura?
                </p>
                <p className="text-xs text-slate-500">
                  Fale connosco para um orçamento personalizado.
                </p>
              </div>
              <Link
                href="/contactos"
                onClick={() => setSolucoesOpen(false)}
                className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700"
              >
                Contactar
              </Link>
            </div>
          </div>
        </div>
      )}

    </header>
    </>
  );
}
