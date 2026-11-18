"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { campoEmLisboa } from "@/lib/hora-de-lisboa";
import { cargasFeitasNoTotal, diasPorExtenso, MAXIMO_DE_DIAS, type DiaDoTrabalho } from "@/lib/varios-dias";

/**
 * «VÁRIOS DIAS» — d64 (18-11-2026). No cartão da Mesa, dos Trabalhos CLYON e
 * na ficha da Agenda: a lista dos dias do trabalho (data e hora de início, em
 * hora de Lisboa), com as cargas previstas por dia (opcional). O primeiro dia
 * passa a ser o dia do pedido. Fechado, só a frase dos dias e um «Vários dias».
 */

type Linha = { inicio: string; cargasPrevistas: string; cargasFeitas: number | null };

const paraLinha = (d: DiaDoTrabalho): Linha => ({
  inicio: campoEmLisboa(d.inicio).slice(0, 16),
  cargasPrevistas: d.cargasPrevistas != null ? String(d.cargasPrevistas).replace(".", ",") : "",
  cargasFeitas: d.cargasFeitas ?? null,
});

export default function VariosDias({
  pedidoId,
  /** O dia do pedido (ou o combinado), para começar a lista quando ainda não há. */
  primeiroDia,
  onGravado,
  onLido,
  tema = "escuro",
}: {
  pedidoId: number;
  primeiroDia?: string | null;
  onGravado?: (dias: DiaDoTrabalho[]) => void;
  /** Os dias lidos (ou gravados) — para quem escreve a mensagem ao cliente. */
  onLido?: (dias: DiaDoTrabalho[]) => void;
  tema?: "escuro" | "claro";
}) {
  const { token } = useAdminAuth();
  const [dias, setDias] = useState<DiaDoTrabalho[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);
  // Numa ref: quem o mostra pode passar uma função nova a cada desenho sem voltar a ler.
  const avisar = useRef(onLido);
  avisar.current = onLido;

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/admin/pedidos/${pedidoId}/varios-dias`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) {
        const lidos = ((await r.json()) as { dias: DiaDoTrabalho[] }).dias ?? [];
        setDias(lidos);
        avisar.current?.(lidos);
      }
    } catch {
      /* fica sem a lista */
    }
  }, [token, pedidoId]);

  useEffect(() => {
    void ler();
  }, [ler]);

  function abrir() {
    const base = dias && dias.length > 1 ? dias.map(paraLinha) : [];
    if (base.length === 0) {
      const inicio = primeiroDia ? campoEmLisboa(primeiroDia).slice(0, 16) : "";
      base.push({ inicio, cargasPrevistas: "", cargasFeitas: null }, { inicio: "", cargasPrevistas: "", cargasFeitas: null });
    }
    setLinhas(base);
    setErro("");
    setAberto(true);
  }

  async function gravar(lista: Linha[]) {
    if (!token) return;
    const validas = lista.filter((l) => l.inicio.trim());
    if (validas.length === 0) {
      setErro("Indique pelo menos um dia.");
      return;
    }
    setAGravar(true);
    setErro("");
    try {
      const r = await fetch(`/api/admin/pedidos/${pedidoId}/varios-dias`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dias: validas.map((l) => ({ inicio: l.inicio, cargasPrevistas: l.cargasPrevistas, cargasFeitas: l.cargasFeitas })),
        }),
      });
      const d = (await r.json()) as { dias?: DiaDoTrabalho[]; error?: string };
      if (!r.ok || !d.dias) {
        setErro(d.error ?? "Não foi possível gravar.");
        return;
      }
      setDias(d.dias.length > 1 ? d.dias : []);
      setAberto(false);
      onGravado?.(d.dias);
      avisar.current?.(d.dias.length > 1 ? d.dias : []);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  const claro = tema === "claro";
  const caixa = claro ? "border-slate-200 bg-white text-slate-700" : "border-slate-700/60 bg-slate-950/40 text-slate-200";
  const campo = claro
    ? "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
    : "rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100";
  const fraco = claro ? "text-slate-500" : "text-slate-400";
  const emVarios = dias != null && dias.length > 1;
  const feitas = emVarios ? cargasFeitasNoTotal(dias) : null;

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${caixa}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">Vários dias</span>
          {emVarios ? (
            <>
              {": "}
              {diasPorExtenso(dias)} ({dias.length} dias)
              {feitas != null && <span className={fraco}> · {String(feitas).replace(".", ",")} carga(s) registadas</span>}
            </>
          ) : (
            <span className={fraco}> — um dia só</span>
          )}
        </p>
        {!aberto && (
          <button type="button" onClick={abrir} className="text-xs font-semibold underline underline-offset-2">
            {emVarios ? "Editar os dias" : "Passar a vários dias"}
          </button>
        )}
      </div>
      {aberto && (
        <div className="mt-2 space-y-2">
          <p className={`text-xs ${fraco}`}>Data e hora de início de cada dia (hora de Lisboa). O primeiro é o dia do pedido.</p>
          {linhas.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className={`w-12 text-xs ${fraco}`}>Dia {i + 1}</span>
              <input
                type="datetime-local"
                value={l.inicio}
                onChange={(e) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, inicio: e.target.value } : x)))}
                className={campo}
                aria-label={`Início do dia ${i + 1}`}
              />
              <input
                inputMode="decimal"
                placeholder="cargas"
                value={l.cargasPrevistas}
                onChange={(e) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, cargasPrevistas: e.target.value } : x)))}
                className={`${campo} w-20`}
                aria-label={`Cargas previstas no dia ${i + 1}`}
              />
              {l.cargasFeitas != null && <span className={`text-xs ${fraco}`}>feitas: {String(l.cargasFeitas).replace(".", ",")}</span>}
              {linhas.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLinhas((ls) => ls.filter((_, k) => k !== i))}
                  className="text-xs underline underline-offset-2"
                >
                  Tirar
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            {linhas.length < MAXIMO_DE_DIAS && (
              <button
                type="button"
                onClick={() => setLinhas((ls) => [...ls, { inicio: "", cargasPrevistas: "", cargasFeitas: null }])}
                className="text-xs font-semibold underline underline-offset-2"
              >
                Acrescentar um dia
              </button>
            )}
            <button
              type="button"
              disabled={aGravar}
              onClick={() => void gravar(linhas)}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {aGravar ? "A gravar…" : "Gravar os dias"}
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
