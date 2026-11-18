"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { diaEmLisboa, horaEmLisboa } from "@/lib/hora-de-lisboa";
import { horasDoDia, horasEmPalavrasCurtas, lerDiaReal, pausaEmMinutos, registoRealEmPalavras, type DiaReal } from "@/lib/registo-real";

/**
 * O REGISTO REAL — d67 (18-11-2026). Ao lado do plano («Data e hora do
 * trabalho» / «Vários dias»): o que aconteceu, por dia — início, fim e a pausa
 * total; as horas calculam-se (fim − início − pausa), em hora de Lisboa. Só a
 * equipa (admin e assistentes) o escreve; a folha final escreve-o também.
 */

type Linha = { dia: string; inicio: string; fim: string; pausa: string };

const paraLinha = (d: DiaReal): Linha => ({
  dia: d.dia,
  inicio: horaEmLisboa(new Date(d.inicio)),
  fim: horaEmLisboa(new Date(d.fim)),
  pausa: d.pausaMin ? String(d.pausaMin) : "",
});

export default function RegistoReal({
  pedidoId,
  /** Os dias do plano, para começar a lista (AAAA-MM-DD). */
  diasDoPlano,
  onLido,
  onGravado,
}: {
  pedidoId: number;
  diasDoPlano?: string[];
  onLido?: (dias: DiaReal[]) => void;
  onGravado?: () => void;
}) {
  const { token } = useAdminAuth();
  const [dias, setDias] = useState<DiaReal[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const avisar = useRef(onLido);
  avisar.current = onLido;

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/admin/pedidos/${pedidoId}/registo-real`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) {
        const lidos = ((await r.json()) as { dias: DiaReal[] }).dias ?? [];
        setDias(lidos);
        avisar.current?.(lidos);
      }
    } catch {
      /* fica sem o registo */
    }
  }, [token, pedidoId]);

  useEffect(() => {
    void ler();
  }, [ler]);

  function abrir() {
    const base = dias && dias.length ? dias.map(paraLinha) : (diasDoPlano?.length ? diasDoPlano : [diaEmLisboa(new Date())]).map((dia) => ({ dia, inicio: "", fim: "", pausa: "" }));
    setLinhas(base);
    setErro("");
    setAberto(true);
  }

  async function gravar(lista: Linha[]) {
    if (!token) return;
    setAGravar(true);
    setErro("");
    try {
      const r = await fetch(`/api/admin/pedidos/${pedidoId}/registo-real`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dias: lista }),
      });
      const d = (await r.json()) as { dias?: DiaReal[]; error?: string };
      if (!r.ok || !d.dias) {
        setErro(d.error ?? "Não foi possível gravar.");
        return;
      }
      setDias(d.dias);
      avisar.current?.(d.dias);
      setAberto(false);
      onGravado?.();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  const campo = "rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100";
  const texto = dias && dias.length ? registoRealEmPalavras(dias) : "";

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">Registo real</span>
          {texto ? <>: {texto}</> : <span className="text-slate-400"> — ainda sem início e fim registados</span>}
        </p>
        {!aberto && (
          <button type="button" onClick={abrir} className="text-xs font-semibold underline underline-offset-2">
            {texto ? "Corrigir" : "Registar início e fim"}
          </button>
        )}
      </div>
      {aberto && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-400">Hora de Lisboa. A pausa é o total do dia (duas de 30 min = 1 h). As horas calculam-se.</p>
          {linhas.map((l, i) => {
            const lido = lerDiaReal(l);
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input type="date" value={l.dia} onChange={(e) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, dia: e.target.value } : x)))} className={campo} aria-label={`Dia ${i + 1}`} />
                <input placeholder="início 13:00" value={l.inicio} onChange={(e) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, inicio: e.target.value } : x)))} className={`${campo} w-24`} aria-label={`Início do dia ${i + 1}`} />
                <input placeholder="fim 19:00" value={l.fim} onChange={(e) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, fim: e.target.value } : x)))} className={`${campo} w-24`} aria-label={`Fim do dia ${i + 1}`} />
                <input placeholder="pausa 1 h" value={l.pausa} onChange={(e) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, pausa: e.target.value } : x)))} className={`${campo} w-24`} aria-label={`Pausa do dia ${i + 1}`} />
                <span className="text-xs text-slate-400">
                  {lido.ok ? `→ ${horasEmPalavrasCurtas(horasDoDia(lido.dia))}` : Number.isNaN(pausaEmMinutos(l.pausa)) ? "pausa?" : ""}
                </span>
                {linhas.length > 1 && (
                  <button type="button" onClick={() => setLinhas((ls) => ls.filter((_, k) => k !== i))} className="text-xs underline underline-offset-2">
                    Tirar
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setLinhas((ls) => [...ls, { dia: "", inicio: "", fim: "", pausa: "" }])} className="text-xs font-semibold underline underline-offset-2">
              Acrescentar um dia
            </button>
            <button type="button" disabled={aGravar} onClick={() => void gravar(linhas)} className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
              {aGravar ? "A gravar…" : "Gravar o registo"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="text-xs underline underline-offset-2">
              Cancelar
            </button>
          </div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
        </div>
      )}
    </div>
  );
}
