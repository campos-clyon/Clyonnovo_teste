import { CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import Breadcrumb, { type BreadcrumbItem } from "@/components/Breadcrumb";
import TrustBadges from "@/components/TrustBadges";
import ServiceHeroButtons from "@/components/service/ServiceHeroButtons";
import { BUSINESS_PHONE } from "@/lib/seo-data";

interface ServiceHeroProps {
  title: string;
  subtitle?: string;
  description: string;
  icon?: LucideIcon;
  breadcrumbs: BreadcrumbItem[];
  highlights?: string[];
  ctaText?: string;
  ctaHref?: string;
  showWhatsApp?: boolean;
  cityName?: string;
  priceFrom?: string;
}

export default function ServiceHero({
  title,
  subtitle,
  description,
  icon: Icon,
  breadcrumbs,
  highlights = [],
  ctaText = "Pedir Orçamento Grátis",
  ctaHref = "/contactos",
  showWhatsApp = true,
  cityName,
  priceFrom,
}: ServiceHeroProps) {
  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappMessage = cityName
    ? `Olá! Preciso de ${title.toLowerCase()} em ${cityName}. Podem dar-me um orçamento?`
    : `Olá! Gostava de pedir um orçamento para ${title.toLowerCase()}.`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-cyan-50/80 to-white pb-12 pt-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={breadcrumbs} className="mb-6" />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
          <div className="flex-1">
            {subtitle && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-1.5 text-sm font-medium text-cyan-700">
                {Icon && <Icon className="h-4 w-4" />}
                {subtitle}
              </div>
            )}

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              {title}
            </h1>

            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
              {description}
            </p>

            {highlights.length > 0 && (
              <ul className="mt-6 space-y-2">
                {highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-center gap-2 text-slate-700"
                  >
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-cyan-500" />
                    {highlight}
                  </li>
                ))}
              </ul>
            )}

            <ServiceHeroButtons
              ctaText={ctaText}
              ctaHref={ctaHref}
              showWhatsApp={showWhatsApp}
              whatsappUrl={whatsappUrl}
              serviceTitle={title}
            />

            {priceFrom && (
              <p className="mt-4 text-sm text-slate-500">
                Preços desde{" "}
                <span className="font-semibold text-cyan-600">{priceFrom}</span>
              </p>
            )}
          </div>

          <div className="hidden lg:block lg:w-80">
            <TrustBadges variant="grid" />
          </div>
        </div>

        <div className="mt-8 lg:hidden">
          <TrustBadges variant="grid" />
        </div>
      </div>
    </section>
  );
}
