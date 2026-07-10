"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { trackWhatsAppClick, trackCTAClick } from "@/lib/analytics";

interface ServiceHeroButtonsProps {
  ctaText: string;
  ctaHref: string;
  showWhatsApp: boolean;
  whatsappUrl: string;
  serviceTitle: string;
}

export default function ServiceHeroButtons({
  ctaText,
  ctaHref,
  showWhatsApp,
  whatsappUrl,
  serviceTitle,
}: ServiceHeroButtonsProps) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link
        href={ctaHref}
        onClick={() => trackCTAClick(ctaText, `service_hero_${serviceTitle}`)}
        className="site-btn-primary site-btn-lively min-w-[220px] px-8 py-4 text-lg"
      >
        <span>{ctaText}</span>
      </Link>
      {showWhatsApp && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick("service_hero", serviceTitle)}
          className="site-btn-whatsapp site-btn-lively min-w-[180px] py-4 text-lg"
        >
          <MessageCircle className="h-5 w-5" />
          <span>WhatsApp</span>
        </a>
      )}
    </div>
  );
}
