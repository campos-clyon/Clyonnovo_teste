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

  /*
   * O painel do profissional é território de outra identidade.
   *
   * Estas duas sessões vivem em cookies separados de propósito — a do cliente
   * no next-auth, a do profissional no clyon_profissional — e é legítimo ter
   * as duas: quem contrata na CLYON pode também trabalhar para ela. O que não
   * é legítimo é o que estava a acontecer no ecrã.
   *
   * Dentro do painel do profissional, este cabeçalho mostrava o avatar, o nome
   * e o email da CONTA DE CLIENTE, com um "Sair" próprio, ao lado do "Sair" do
   * profissional na barra da esquerda. Duas identidades e dois botões de sair
   * no mesmo ecrã: quem quisesse sair do painel carregava no de cima e saía da
   * outra conta, ficando com o painel aberto e a pensar que tinha fechado.
   *
   * Aqui não se esconde a sessão — ela continua a existir e a valer. Esconde-se
   * o menu que a faz parecer a identidade activa nesta página.
   */
  const naAreaDoProfissional = pathname?.startsWith("/profissionais") ?? false;

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

    /*
     * Escape fecha, e o foco VOLTA ao botão.
     *
     * Devolver o foco é a metade que costuma faltar: sem isso, fechar o menu
     * por teclado deixava o foco num elemento que já não existe, e o Tab
     * seguinte recomeçava do princípio da página.
     */
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSolucoesOpen((aberto) => {
          if (aberto) buttonRef.current?.focus();
          return false;
        });
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
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
            {/*
              O CLIQUE DEIXA DE FECHAR O QUE O RATO ACABOU DE ABRIR.

              Era `onClick={() => setSolucoesOpen(!solucoesOpen)}` com
              `onMouseEnter` a abrir. Quem aponta e clica — que é o que a
              maioria das pessoas faz — via o menu desaparecer no próprio
              gesto de o tentar usar: o rato abria-o, o clique alternava-o
              para fechado.

              Agora o clique só ABRE. Fecha-se com Esc, ao sair com o rato, ou
              ao clicar fora, que é o que já existia.

              `onFocus` abre também: sem isso, quem chega ao botão por Tab
              nunca conseguia entrar no menu, e o mega-menu é o principal
              caminho de descoberta de serviços em desktop — onde estão os
              pedidos de empresas e condomínios.
            */}
            <button
              ref={buttonRef}
              onClick={() => setSolucoesOpen(true)}
              onMouseEnter={() => setSolucoesOpen(true)}
              onFocus={() => setSolucoesOpen(true)}
              aria-expanded={solucoesOpen}
              aria-haspopup="true"
              aria-controls="menu-solucoes"
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                solucoesOpen
                  ? "bg-slate-50 text-acao"
                  : "text-slate-600 hover:bg-slate-50 hover:text-acao-hover"
              }`}
            >
              Soluções
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  solucoesOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Other nav links */}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2.5 text-[0.9375rem] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-acao-hover"
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
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-whatsapp-tinta transition-all hover:bg-[#20bd5a]"
          >
            <MessageCircle className="h-4 w-4 text-whatsapp-tinta" />
            <span className="text-whatsapp-tinta">WhatsApp</span>
          </a>

          {/* Botão conta / entrar */}
          {naAreaDoProfissional ? null : session?.user ? (
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
                    <p className="truncate text-xs text-tinta-fraca">
                      {session.user.email}
                    </p>
                  </div>
                  <Link
                    href="/conta"
                    onClick={() => setContaOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-acao-hover"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-acao-hover"
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
          {naAreaDoProfissional ? null : session?.user ? (
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
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-200 text-slate-500 transition hover:border-cyan-300 hover:text-acao-hover"
            >
              <User className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Mega Menu Dropdown - Centralized */}
      {solucoesOpen && (
        <div
          id="menu-solucoes"
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
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-acao px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-acao-hover"
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
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-acao transition-colors group-hover:bg-acao-hover group-hover:text-white">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 group-hover:text-acao-hover">
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
                className="rounded-xl bg-acao px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-acao-hover"
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
