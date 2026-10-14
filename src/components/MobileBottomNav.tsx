"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, MessageCircle, Phone, Sparkles } from "lucide-react";

import { trackPhoneCall, trackWhatsAppClick } from "@/lib/analytics";
import { linkDeWhatsApp } from "@/lib/link-de-whatsapp";
import { BUSINESS_PHONE } from "@/lib/seo-data";

/**
 * Barra de navegação inferior estilo app (inspirada na Oscar/Fixando).
 * Substitui a antiga barra de botões WhatsApp/Orçamento.
 * Só aparece em mobile; o desktop usa o Header. Escondida em áreas que já
 * têm o seu próprio shell (backoffice, portal de parceiros, simulador).
 *
 * ATÉ AOS 1024 px, E NÃO ATÉ AOS 768
 *
 * Esta barra escondia-se em `md:hidden` (a partir de 768 px) e a navegação do
 * Header só aparece em `lg:flex` (a partir de 1024 px). No meio ficava uma
 * faixa de 256 px onde o site não tinha navegação NENHUMA: sem menu Soluções,
 * sem Trabalhos, sem Avaliações, sem Contactos, e sem o botão Simular, que é
 * o CTA principal em mobile.
 *
 * Não é um intervalo teórico — é o iPad em retrato (768), o iPhone Pro Max
 * deitado, e os Android grandes em paisagem. Quem chegasse ao site nessas
 * larguras só saía da homepage pelos links do corpo da página.
 *
 * O comentário antigo dizia "sem menu hambúrguer para evitar dois menus". O
 * resultado era uma faixa com zero menus. Os dois sistemas passam a
 * encontrar-se no mesmo limiar: `lg`, que é onde o mega-menu cabe.
 */

const HIDDEN_PREFIXES = [
  "/admin",
  "/simulador",
  /*
   * A landing tem barra própria, com SMS, email, chamada e WhatsApp.
   *
   * Sem esta linha ficavam DUAS barras empilhadas no fundo do ecrã — a dela e
   * esta — a comer 130 px de altura num telemóvel. Numa página de destino de
   * campanha, a barra de conversão dela é que manda; a navegação do site
   * inteiro só lhe roubaria o clique.
   */
  "/orcamento-recolha-lisboa",
];

const LEFT = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/servicos", label: "Serviços", icon: LayoutGrid },
];

/*
 * LIGAR E WHATSAPP, NO LUGAR DE AVALIAÇÕES E CONTA (14-10-2026).
 *
 * No telemóvel não havia como ligar nem abrir o WhatsApp sem voltar ao topo
 * da página — e quem esvazia a casa de um familiar muitas vezes prefere
 * falar com alguém. A conta continua no cabeçalho (o botão redondo ao lado
 * da localização); as avaliações, na página inicial e no rodapé.
 */
const WHATSAPP = linkDeWhatsApp(BUSINESS_PHONE, "Olá! Gostava de pedir um orçamento à CLYON.") ?? "/contactos";

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
      active ? "text-acao" : "text-tinta-fraca"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm lg:hidden">
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
          <span className="text-[10px] font-semibold text-acao">Simular</span>
        </Link>

        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick("barra_telemovel")}
          className={itemCls(false)}
        >
          <MessageCircle className="h-5 w-5 text-emerald-600" strokeWidth={2} />
          WhatsApp
        </a>
        <a
          href={`tel:${BUSINESS_PHONE}`}
          onClick={() => trackPhoneCall("barra_telemovel", BUSINESS_PHONE)}
          className={itemCls(false)}
        >
          <Phone className="h-5 w-5" strokeWidth={2} />
          Ligar
        </a>
      </div>
    </nav>
  );
}
