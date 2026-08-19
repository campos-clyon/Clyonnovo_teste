"use client";

import { Check } from "lucide-react";
import type { ServiceType } from "../types";

interface Service {
  id: ServiceType;
  label: string;
  icon: string;
  description?: string;
}

interface ServiceTypeCardsProps {
  services: Service[];
  selected?: ServiceType;
  onSelect: (serviceType: ServiceType) => void;
}

export default function ServiceTypeCards({
  services,
  selected,
  onSelect,
}: ServiceTypeCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {services.map((service) => {
        const isSelected = selected === service.id;
        return (
          <button
            key={service.id}
            onClick={() => onSelect(service.id)}
            className={`relative p-3 rounded-lg border transition-all duration-200 ${
              isSelected
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-blue-300"
            }`}
          >
            {/* Check mark corner */}
            {isSelected && (
              <div className="absolute top-1.5 right-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={3} />
              </div>
            )}

            {/* Icon */}
            <div className="text-xl mb-1.5">{service.icon}</div>

            {/* Label */}
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {service.label}
            </p>

            {/* Optional description */}
            {service.description && (
              <p className="text-xs text-slate-500 mt-0.5">{service.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
