"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";

import { BUSINESS_PHONE } from "@/lib/seo-data";
import { trackWhatsAppClick, trackCTAClick } from "@/lib/analytics";

// Rotas onde o StickyCTA não deve aparecer
const HIDDEN_ROUTES = ["/colaboradores", "/simulador"];

interface StickyCTAProps {
  showAfterScroll?: number;
}

export default function StickyCTA({ showAfterScroll = 300 }: StickyCTAProps) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);

  const isHidden = HIDDEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  useEffect(() => {
    if (isHidden) return;
    const handleScroll = () => {
      setIsVisible(window.scrollY > showAfterScroll);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [showAfterScroll, isHidden]);

  if (isHidden || !isVisible) return null;

  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Gostava de pedir um orçamento à CLYON.")}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-center gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick("sticky_cta")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(37,211,102,0.6)] transition hover:bg-[#20bd5a]"
        >
          <MessageCircle className="h-5 w-5 text-white" />
          <span className="text-white">WhatsApp</span>
        </a>
        <Link
          href="/contactos"
          onClick={() => trackCTAClick("orcamento", "sticky_cta")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(6,182,212,0.6)] transition hover:bg-cyan-700"
        >
          <Phone className="h-5 w-5 text-white" />
          <span className="text-white">Orçamento</span>
        </Link>
      </div>
    </div>
  );
}
