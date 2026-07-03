import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

export interface RegionCardData {
  name: string;
  slug: string;
  cities: string[];
  highlight?: string;
}

interface RegionGridProps {
  title?: string;
  subtitle?: string;
  regions: RegionCardData[];
  serviceSlug?: string;
  className?: string;
}

export default function RegionGrid({
  title = "Onde Operamos",
  subtitle = "Cobertura em Lisboa, Margem Sul e Setúbal",
  regions,
  serviceSlug,
  className = "",
}: RegionGridProps) {
  return (
    <section className={`py-12 ${className}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-lg text-slate-600">{subtitle}</p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {regions.map((region) => (
            <div
              key={region.slug}
              className="group relative overflow-hidden rounded-3xl border border-cyan-100 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(14,116,144,0.12)] transition-shadow hover:shadow-[0_24px_60px_-20px_rgba(14,116,144,0.2)]"
            >
              {region.highlight && (
                <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {region.highlight}
                </span>
              )}

              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50">
                  <MapPin className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {region.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {region.cities.length} localidades
                  </p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {region.cities.slice(0, 5).map((city) => (
                  <span
                    key={city}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
                  >
                    {city}
                  </span>
                ))}
                {region.cities.length > 5 && (
                  <span className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-600">
                    +{region.cities.length - 5}
                  </span>
                )}
              </div>

              <Link
                href={
                  serviceSlug
                    ? `/${serviceSlug}-${region.slug}`
                    : `/regioes/${region.slug}`
                }
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 transition-colors hover:text-cyan-700"
              >
                Ver serviços na região
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
