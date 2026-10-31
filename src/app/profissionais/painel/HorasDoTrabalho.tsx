"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import {
  GRAVAR_AS_HORAS,
  HORA_DE_FIM,
  HORA_DE_INICIO,
  REGRA_DAS_HORAS,
  TITULO_DAS_HORAS,
  agoraNoCampo,
} from "@/lib/horas-do-trabalho";
import type { Pedido } from "./tipos";

/**
 * AS HORAS DO TRABALHO — 31-10-2026 (ordem do CEO com o sim do dono).
 *
 * Num trabalho por hora, depois do «Cheguei» confirmado: DOIS campos que ele
 * escreve — a hora de início e a de fim, em hora de Lisboa. Vazios, ao tocar
 * põem a hora de agora, mas ficam sempre editáveis: não é um cronómetro que
 * continua a contar depois de acabar (o dono não o quer). Com os materiais à
 * parte, a quantidade de cada um. «OK» grava; o site conta as horas (ao
 * quarto de hora, para cima, mínimo 3) e o total, e o cliente confirma.
 */
export function HorasDoTrabalho({ pedido, onGravou }: { pedido: Pedido; onGravou: () => void }) {
  const h = pedido.porHora!;
  const [inicio, setInicio] = useState(h.campos.inicio);
  const [fim, setFim] = useState(h.campos.fim);
  const [quantidades, setQuantidades] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(h.campos.materiais ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const aParte = pedido.materiais && !pedido.materiais.incluidos ? pedido.materiais.itens : [];
  const editavel = h.podeMarcar;

  async function gravar() {
    setAEnviar(true);
    setErro("");
    setMensagem("");
    try {
      const materiais = Object.fromEntries(
        Object.entries(quantidades)
          .map(([k, v]) => [k, Number(v)] as const)
          .filter(([, v]) => Number.isFinite(v) && v > 0),
      );
      const res = await fetch("/api/profissionais/trabalho/horas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negociacaoId: pedido.negociacaoId,
          inicio,
          fim,
          ...(h.campos.dia ? { dia: h.campos.dia } : {}),
          ...(aParte.length > 0 ? { materiais } : {}),
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.error ?? "Não foi possível gravar as horas.");
        return;
      }
      setMensagem(typeof dados.mensagem === "string" ? dados.mensagem : "");
      onGravou();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAEnviar(false);
    }
  }

  const campo = (rotulo: string, valor: string, mudar: (v: string) => void) => (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      <input
        type="time"
        value={valor}
        disabled={!editavel}
        // Vazio, ao tocar põe a hora de agora (Lisboa) — e continua editável.
        onFocus={() => {
          if (!valor) mudar(agoraNoCampo());
        }}
        onChange={(e) => mudar(e.target.value)}
        className="min-h-[48px] w-full rounded-xl border-2 border-cyan-200 bg-white px-3 text-lg font-semibold text-slate-900 outline-none focus:border-cyan-500 disabled:opacity-60"
      />
    </label>
  );

  return (
    <section className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
      <h2 className="flex items-center gap-2 text-base font-bold text-cyan-900">
        <Clock className="h-5 w-5" aria-hidden="true" />
        {TITULO_DAS_HORAS}
      </h2>
      {h.resumo && <p className="mt-1 text-sm leading-relaxed text-cyan-900">{h.resumo.textoParaQuemFez}</p>}
      {h.estadoTexto && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
            h.contestadas ? "border border-amber-300 bg-amber-50 text-amber-900" : "bg-white/70 text-cyan-900"
          }`}
        >
          {h.estadoTexto}
        </p>
      )}

      {editavel && (
        <>
          <div className="mt-3 flex gap-3">
            {campo(HORA_DE_INICIO, inicio, setInicio)}
            {campo(HORA_DE_FIM, fim, setFim)}
          </div>
          {aParte.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-semibold text-cyan-900">Materiais à parte usados</p>
              {aParte.map((m) => (
                <label key={m.id} className="flex items-center justify-between gap-3 text-sm text-slate-800">
                  <span>
                    {m.nome} <span className="text-slate-500">({euroCurto(m.preco)}/{m.unidade})</span>
                  </span>
                  <input
                    inputMode="numeric"
                    value={quantidades[m.id] ?? ""}
                    onChange={(e) => setQuantidades({ ...quantidades, [m.id]: e.target.value.replace(/[^\d]/g, "") })}
                    placeholder="0"
                    aria-label={`Quantidade de ${m.nome}`}
                    className="w-20 rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-right font-semibold text-slate-900"
                  />
                </label>
              ))}
            </div>
          )}
          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
          {mensagem && <p className="mt-2 text-sm font-semibold text-emerald-800">{mensagem}</p>}
          <button
            onClick={gravar}
            disabled={aEnviar || !inicio || !fim}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-acao text-base font-bold text-white transition active:bg-acao-hover disabled:opacity-40"
          >
            {aEnviar && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {GRAVAR_AS_HORAS}
          </button>
        </>
      )}
      <p className="mt-2 text-xs text-cyan-800">{REGRA_DAS_HORAS}</p>
    </section>
  );
}

function euroCurto(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}
