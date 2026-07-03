import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface FurnitureSeoLinksProps {
  currentPage?: string;
  variant?: "grid" | "inline" | "compact";
  showHeading?: boolean;
  className?: string;
}

const seoLinks = [
  { href: "/recolha-de-moveis", label: "Recolha de Móveis", description: "Página principal do serviço" },
  { href: "/recolha-de-sofas", label: "Recolha de Sofás", description: "Sofás e chaise longues" },
  { href: "/recolha-de-camas", label: "Recolha de Camas", description: "Camas, estrados e colchões" },
  { href: "/recolha-de-armarios", label: "Recolha de Armários", description: "Armários e roupeiros" },
  { href: "/recolha-de-eletrodomesticos", label: "Recolha de Eletrodomésticos", description: "Frigoríficos e máquinas" },
  { href: "/recolha-gratuita-de-moveis-usados", label: "Recolha Gratuita vs Privada", description: "Quando escolher" },
  { href: "/recolha-de-moveis-urgente", label: "Recolha Urgente", description: "Resposta no próprio dia" },
  { href: "/recolha-de-sofa-lisboa", label: "Sofá em Lisboa", description: "Carregamento e transporte" },
  { href: "/retirar-moveis-velhos", label: "Retirar Móveis Velhos", description: "Desmontagem incluída" },
  { href: "/recolha-moveis-lisboa", label: "Recolha de móveis em Lisboa", description: "Lisboa e bairros" },
  { href: "/recolha-moveis-almada", label: "Recolha de móveis em Almada", description: "Almada e Caparica" },
  { href: "/recolha-moveis-setubal", label: "Recolha de móveis em Setúbal", description: "Setúbal e Palmela" },
  { href: "/recolha-moveis-amadora", label: "Recolha de móveis na Amadora", description: "Amadora e Queluz" },
  { href: "/recolha-de-monos-amadora", label: "Monos na Amadora", description: "Volumosos na Amadora" },
  { href: "/esvaziamento-de-casas-amadora", label: "Esvaziamento na Amadora", description: "Casas e apartamentos" },
  { href: "/recolha-moveis-sintra", label: "Recolha de móveis em Sintra", description: "Sintra e região" },
  { href: "/recolha-moveis-oeiras", label: "Recolha de móveis em Oeiras", description: "Oeiras e arredores" },
  { href: "/recolha-moveis-cascais", label: "Recolha de móveis em Cascais", description: "Linha de Cascais" },
  { href: "/recolha-monos-lisboa", label: "Recolha de monos", description: "Monos e volumosos" },
  { href: "/esvaziamento-de-casas", label: "Esvaziamento de casas", description: "Recheios completos" },
];

const blogLinks = [
  { href: "/blog/recolha-de-moveis-como-funciona", label: "Como funciona a recolha de móveis" },
  { href: "/blog/recolha-gratuita-de-moveis-usados-costa-da-caparica", label: "Recolha gratuita vs privada" },
];

export default function FurnitureSeoLinks({
  currentPage,
  variant = "grid",
  showHeading = true,
  className = "",
}: FurnitureSeoLinksProps) {
  const filteredLinks = seoLinks.filter((link) => link.href !== currentPage);

  if (variant === "inline") {
    return (
      <div className={`${className}`}>
        {showHeading && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Páginas relacionadas
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {filteredLinks.slice(0, 6).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`${className}`}>
        {showHeading && (
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Ver também:
          </p>
        )}
        <ul className="space-y-1">
          {filteredLinks.slice(0, 5).map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-cyan-600 underline-offset-2 hover:underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Default: grid variant
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-6 ${className}`}>
      {showHeading && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">
            Links internos
          </p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">
            Recolha de móveis por zona
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Veja o serviço de recolha de móveis na sua zona ou explore artigos úteis sobre como funciona.
          </p>
        </>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filteredLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium transition hover:border-cyan-200 hover:bg-cyan-50"
            style={{ color: '#0f172a' }}
          >
            {link.label}
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-cyan-600" />
          </Link>
        ))}
      </div>
      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">Artigos úteis:</p>
        <div className="flex flex-wrap gap-2">
          {blogLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:border-cyan-200 hover:bg-cyan-50"
              style={{ color: '#0f172a' }}
            >
              {link.label}
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
