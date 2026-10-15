import Link from "next/link";

import { caminhoDoServicoNaCidade } from "@/lib/caminho-da-cidade";
import { SERVICES, type CityData } from "@/lib/seo-data";

/*
 * CADA TERRA COM TODOS OS SERVIÇOS — 15-10-2026 (pente fino).
 *
 * Nas páginas de região e em /regioes as terras ligavam só à recolha de
 * móveis. Aqui cada uma liga a todos os serviços, que é como a pessoa
 * procura («entulho no Seixal», «mudanças em Almada»). Os endereços saem de
 * `caminhoDoServicoNaCidade`, que conhece as páginas consolidadas.
 */
export default function TerrasComServicos({ cidades }: { cidades: CityData[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cidades.map((city) => (
        <li key={city.slug} className="rounded-[22px] border border-slate-200 p-4">
          <p className="font-semibold text-slate-950">{city.name}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {SERVICES.map((service, i) => (
              <span key={service.slug}>
                {i > 0 && " · "}
                <Link
                  href={caminhoDoServicoNaCidade(service.slug, city.slug)}
                  className="text-acao underline-offset-2 hover:underline"
                >
                  {service.shortName.charAt(0).toUpperCase() + service.shortName.slice(1)}
                </Link>
              </span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  );
}
