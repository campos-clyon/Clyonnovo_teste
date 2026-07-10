"use client";

import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";

import { BUSINESS_PHONE } from "@/lib/seo-data";
import { trackWhatsAppClick, trackCTAClick, trackPhoneCall } from "@/lib/analytics";

interface CTABlockProps {
  title?: string;
  description?: string;
  primaryText?: string;
  primaryHref?: string;
  showWhatsApp?: boolean;
  showPhone?: boolean;
  variant?: "default" | "compact" | "centered";
  className?: string;
  whatsappMessage?: string;
}

export default function CTABlock({
  title = "Pronto para começar?",
  description = "Peça um orçamento grátis e receba resposta em 24 horas.",
  primaryText = "Pedir Orçamento Grátis",
  primaryHref = "/contactos",
  showWhatsApp = true,
  showPhone = false,
  variant = "default",
  className = "",
  whatsappMessage = "Olá! Gostava de pedir um orçamento à CLYON.",
}: CTABlockProps) {
  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  const phoneHref = `tel:${BUSINESS_PHONE.replace(/\s+/g, "")}`;

  if (variant === "compact") {
    return (
      <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
        <Link
          href={primaryHref}
          onClick={() => trackCTAClick(primaryText, "cta_block_compact")}
          className="site-btn-primary site-btn-lively min-w-[200px] px-6 py-3.5 text-white"
        >
          <span className="text-white">{primaryText}</span>
        </Link>
        {showWhatsApp && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick("cta_block_compact")}
            className="site-btn-whatsapp site-btn-lively min-w-[180px]"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp</span>
          </a>
        )}
        {showPhone && (
          <a
            href={phoneHref}
            onClick={() => trackPhoneCall("cta_block_compact", BUSINESS_PHONE)}
            className="site-btn-secondary site-btn-lively min-w-[160px] px-6 py-3.5"
          >
            <Phone className="h-4 w-4" />
            <span>Ligar</span>
          </a>
        )}
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div
        className={`rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white px-6 py-10 text-center shadow-[0_24px_60px_-20px_rgba(14,116,144,0.12)] sm:px-10 ${className}`}
      >
        <h3 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {title}
        </h3>
        <p className="mx-auto mt-3 max-w-md text-base text-slate-600">
          {description}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={primaryHref}
            onClick={() => trackCTAClick(primaryText, "cta_block_centered")}
            className="site-btn-primary site-btn-lively min-w-[220px] px-8 py-4 text-lg text-white"
          >
            <span className="text-white">{primaryText}</span>
          </Link>
          {showWhatsApp && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick("cta_block_centered")}
              className="site-btn-whatsapp site-btn-lively min-w-[180px] py-4 text-lg"
            >
              <MessageCircle className="h-5 w-5" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div>
        <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {title}
        </h3>
        <p className="mt-1 text-base text-slate-600">{description}</p>
      </div>
      <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row">
        <Link
          href={primaryHref}
          onClick={() => trackCTAClick(primaryText, "cta_block_default")}
          className="site-btn-primary site-btn-lively px-6 py-3.5 text-white"
        >
          <span className="text-white">{primaryText}</span>
        </Link>
        {showWhatsApp && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick("cta_block_default")}
            className="site-btn-whatsapp site-btn-lively"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp</span>
          </a>
        )}
      </div>
    </div>
  );
}
