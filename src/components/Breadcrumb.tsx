import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  const schemaItems = [
    { "@type": "ListItem", position: 1, name: "Início", item: "https://clyon.pt" },
    ...items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 2,
      name: item.label,
      ...(item.href ? { item: `https://clyon.pt${item.href}` } : {}),
    })),
  ];

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: schemaItems,
  };

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center gap-1.5 text-sm ${className}`}
      >
        <Link
          href="/"
          className="flex items-center gap-1 text-slate-500 transition-colors hover:text-cyan-600"
        >
          <Home className="h-4 w-4" />
          <span className="sr-only">Início</span>
        </Link>
        {items.map((item, index) => (
          <span key={index} className="flex items-center gap-1.5">
            <ChevronRight className="h-4 w-4 text-slate-300" />
            {item.href ? (
              <Link
                href={item.href}
                className="text-slate-500 transition-colors hover:text-cyan-600"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-slate-700">{item.label}</span>
            )}
          </span>
        ))}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
