import { CheckCircle2, Clock, Star, Truck } from "lucide-react";

interface TrustBadgesProps {
  variant?: "horizontal" | "grid";
  className?: string;
}

const badges = [
  {
    icon: Star,
    value: "163",
    label: "avaliações no Fixando",
    color: "text-amber-500",
  },
  {
    icon: Clock,
    value: "24h",
    label: "resposta garantida",
    color: "text-cyan-500",
  },
  {
    icon: Truck,
    value: "Rápido",
    label: "serviço eficiente",
    color: "text-emerald-500",
  },
  {
    icon: CheckCircle2,
    value: "Grátis",
    label: "orçamento sem compromisso",
    color: "text-cyan-600",
  },
];

export default function TrustBadges({
  variant = "horizontal",
  className = "",
}: TrustBadgesProps) {
  if (variant === "grid") {
    return (
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`}>
        {badges.map((badge) => (
          <div
            key={badge.label}
            className="flex flex-col items-center rounded-2xl border border-cyan-100 bg-white/90 px-4 py-4 text-center shadow-[0_16px_40px_-30px_rgba(14,116,144,0.18)]"
          >
            <badge.icon className={`h-6 w-6 ${badge.color}`} />
            <div className="mt-2 text-xl font-bold text-slate-900">
              {badge.value}
            </div>
            <div className="mt-1 text-xs leading-tight text-slate-500">
              {badge.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6 ${className}`}
    >
      {badges.slice(0, 3).map((badge) => (
        <div key={badge.label} className="flex items-center gap-2">
          <badge.icon className={`h-5 w-5 ${badge.color}`} />
          <span className="text-sm font-semibold text-slate-700">
            {badge.value}
          </span>
          <span className="text-sm text-slate-500">{badge.label}</span>
        </div>
      ))}
    </div>
  );
}
