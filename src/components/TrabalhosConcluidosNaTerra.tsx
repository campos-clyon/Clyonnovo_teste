import { CheckCircle2 } from "lucide-react";

import { emTerra } from "@/lib/preposicao-da-terra";
import { concluidosNaTerra, trabalhosConcluidosRecentes } from "@/lib/trabalhos-recentes";
import { tService } from "@/lib/translations";

/*
 * «TRABALHOS CONCLUÍDOS NESTA ZONA» — 14-10-2026 (auditoria de SEO).
 *
 * O que só esta página pode dizer: o que se fez mesmo nesta terra nos
 * últimos meses, agrupado por serviço e mês («3 × Recolha de móveis —
 * outubro de 2026»). Sem nomes, sem moradas, sem preços. Sem trabalhos aqui,
 * o bloco não aparece — um «ainda nenhum» numa página de cidade não ajuda
 * ninguém.
 */
const MES = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "Europe/Lisbon" });

export default async function TrabalhosConcluidosNaTerra({ terra }: { terra: string }) {
  const daTerra = concluidosNaTerra(await trabalhosConcluidosRecentes(), terra, 40);
  if (daTerra.length === 0) return null;

  const grupos = new Map<string, { servico: string; mes: string; quantos: number }>();
  for (const t of daTerra) {
    const servico = tService(t.servico);
    const mes = MES.format(t.quando);
    const chave = `${servico}|${mes}`;
    const g = grupos.get(chave);
    if (g) g.quantos += 1;
    else grupos.set(chave, { servico, mes, quantos: 1 });
  }
  const linhas = [...grupos.values()].slice(0, 6);

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <div className="rounded-[30px] border border-emerald-100 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(5,150,105,0.14)]">
        <h2 className="text-2xl font-bold text-slate-950">Trabalhos concluídos {emTerra(terra)}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Pedidos feitos na CLYON e já concluídos nos últimos meses — sem nomes nem moradas.
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {linhas.map((l) => (
            <li
              key={`${l.servico}-${l.mes}`}
              className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                {l.quantos > 1 ? `${l.quantos} × ` : ""}
                {l.servico} — {l.mes}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
