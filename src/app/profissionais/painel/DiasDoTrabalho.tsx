"use client";

import { useState } from "react";
import { cargasFeitasNoTotal, diaNDeM, diasPorExtenso, horaDoDia, type DiaDoTrabalho } from "@/lib/varios-dias";

/**
 * OS DIAS DO TRABALHO, NO PAINEL DELE — d64 (18-11-2026). Num trabalho em
 * vários dias: cada dia com a hora de início e as cargas previstas, e um campo
 * para ele registar as cargas que fez nesse dia (no próprio dia ou depois). O
 * total sai no fim; o «Está feito» só no último dia.
 */
export default function DiasDoTrabalho({
  negociacaoId,
  dias,
  podeRegistar,
  onGravou,
}: {
  negociacaoId: number;
  dias: DiaDoTrabalho[];
  /** Contratado e ainda por dar por feito. */
  podeRegistar: boolean;
  onGravou?: () => void;
}) {
  const [lista, setLista] = useState(dias);
  const [escrito, setEscrito] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState<string | null>(null);
  if (lista.length <= 1) return null;
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
  const total = cargasFeitasNoTotal(lista);

  async function gravar(dia: string) {
    const cargas = (escrito[dia] ?? "").trim();
    if (!cargas) return;
    setAGravar(dia);
    setErro("");
    try {
      const r = await fetch("/api/profissionais/trabalho/cargas-do-dia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negociacaoId, dia, cargas }),
      });
      const d = (await r.json()) as { dias?: DiaDoTrabalho[]; error?: string };
      if (!r.ok || !d.dias) {
        setErro(d.error ?? "Não foi possível gravar.");
        return;
      }
      setLista(d.dias);
      setEscrito((e) => ({ ...e, [dia]: "" }));
      onGravou?.();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(null);
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-bold text-slate-900">Trabalho em {lista.length} dias</h2>
      <p className="mt-1 text-sm text-slate-600">
        Registe as cargas de cada dia. Dá o trabalho por feito só no último dia; o total conta-se no fim.
      </p>
      <ul className="mt-3 space-y-2">
        {lista.map((d, i) => {
          const hora = horaDoDia(d);
          return (
            <li key={d.dia} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800">
              <p className="font-semibold">
                {diasPorExtenso([d.dia])}
                {hora ? `, às ${hora}` : ""} <span className="font-normal text-slate-500">({diaNDeM(i + 1, lista.length)})</span>
              </p>
              <p className="text-slate-600">
                {d.cargasPrevistas != null ? `Previstas: ${String(d.cargasPrevistas).replace(".", ",")}` : "Sem cargas previstas"}
                {d.cargasFeitas != null ? ` · Feitas: ${String(d.cargasFeitas).replace(".", ",")}` : ""}
              </p>
              {podeRegistar && d.dia <= hoje && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    placeholder="cargas feitas"
                    value={escrito[d.dia] ?? ""}
                    onChange={(e) => setEscrito((x) => ({ ...x, [d.dia]: e.target.value }))}
                    className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    aria-label={`Cargas feitas no dia ${i + 1}`}
                  />
                  <button
                    type="button"
                    disabled={aGravar === d.dia}
                    onClick={() => void gravar(d.dia)}
                    className="rounded-lg bg-acao px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Gravar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {total != null && (
        <p className="mt-2 text-sm font-semibold text-slate-800">Cargas registadas: {String(total).replace(".", ",")}</p>
      )}
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </section>
  );
}
