"use client";

import { useState } from "react";
import {
  MATERIAIS_A_PARTE,
  MATERIAIS_DE_PARTIDA,
  MATERIAIS_INCLUIDOS,
  MAXIMO_DE_MATERIAIS,
  PERGUNTA_DOS_MATERIAIS,
  type MateriaisDaProposta,
  type MaterialDaProposta,
} from "@/lib/materiais-da-proposta";

/**
 * OS MATERIAIS NA PROPOSTA — 31-10-2026 (acrescento à ordem das horas).
 *
 * Ao propor, ele diz se o valor já inclui os materiais (filme/plástico,
 * cartão, caixas) ou o preço de cada um à parte. Os nomes e os preços de
 * partida são os da tabela das mudanças (`MATERIAIS_DE_PARTIDA`). O estado
 * vive em quem chama (`useEstadoDosMateriais`), para ir no corpo do POST.
 */

export type EstadoDosMateriais = {
  resposta: "sim" | "nao" | null;
  itens: Array<{ id: string; nome: string; preco: string; unidade: string; usar: boolean }>;
};

export function estadoInicialDosMateriais(m: MateriaisDaProposta | null | undefined): EstadoDosMateriais {
  const partida = MATERIAIS_DE_PARTIDA.map((p) => ({
    id: p.id,
    nome: p.nome,
    preco: String(p.preco).replace(".", ","),
    unidade: p.unidade,
    usar: true,
  }));
  if (!m) return { resposta: null, itens: partida };
  if (m.incluidos) return { resposta: "sim", itens: partida };
  const dele = m.itens.map((i) => ({
    id: i.id,
    nome: i.nome,
    preco: String(i.preco).replace(".", ","),
    unidade: i.unidade,
    usar: true,
  }));
  const faltam = partida.filter((p) => !dele.some((d) => d.id === p.id)).map((p) => ({ ...p, usar: false }));
  return { resposta: "nao", itens: [...dele, ...faltam] };
}

/** O que vai no corpo do POST — `undefined` sem resposta (a rota deixa o que lá estava). */
export function materiaisParaEnviar(e: EstadoDosMateriais): MateriaisDaProposta | undefined {
  if (e.resposta === "sim") return { incluidos: true };
  if (e.resposta !== "nao") return undefined;
  const itens: MaterialDaProposta[] = e.itens
    .filter((i) => i.usar && i.nome.trim())
    .map((i) => ({ id: i.id, nome: i.nome.trim(), preco: Number(i.preco.replace(",", ".")), unidade: i.unidade.trim() || "unidade" }))
    .filter((i) => Number.isFinite(i.preco) && i.preco > 0);
  return itens.length > 0 ? { incluidos: false, itens } : undefined;
}

export function useEstadoDosMateriais(m: MateriaisDaProposta | null | undefined) {
  return useState<EstadoDosMateriais>(() => estadoInicialDosMateriais(m));
}

export default function CamposDosMateriais({
  estado,
  onMudar,
  obrigatorio,
}: {
  estado: EstadoDosMateriais;
  onMudar: (e: EstadoDosMateriais) => void;
  /** Numa mudança a pergunta tem de ter resposta antes de propor. */
  obrigatorio: boolean;
}) {
  const mudarItem = (i: number, campo: Partial<EstadoDosMateriais["itens"][number]>) =>
    onMudar({ ...estado, itens: estado.itens.map((x, j) => (j === i ? { ...x, ...campo } : x)) });
  const outros = estado.itens.filter((i) => i.id.startsWith("outro-")).length;

  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">
        {PERGUNTA_DOS_MATERIAIS}
        {!obrigatorio && <span className="font-normal text-slate-500"> (opcional)</span>}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["sim", "nao"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onMudar({ ...estado, resposta: r })}
            className={`min-h-[44px] rounded-lg border-2 px-2 text-sm font-semibold transition ${
              estado.resposta === r ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {r === "sim" ? `Sim — ${MATERIAIS_INCLUIDOS.toLowerCase()}` : `Não — ${MATERIAIS_A_PARTE.toLowerCase()}`}
          </button>
        ))}
      </div>
      {estado.resposta === "nao" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-600">O preço de cada um, sem IVA (como o seu valor). O cliente vê-o com o IVA ao lado.</p>
          {estado.itens.map((i, n) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={i.usar}
                onChange={(e) => mudarItem(n, { usar: e.target.checked })}
                aria-label={`Cobrar ${i.nome}`}
              />
              {i.id.startsWith("outro-") ? (
                <input
                  value={i.nome}
                  onChange={(e) => mudarItem(n, { nome: e.target.value })}
                  placeholder="Nome"
                  maxLength={40}
                  className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              ) : (
                <span className="w-32 text-sm text-slate-800">{i.nome}</span>
              )}
              <input
                value={i.preco}
                onChange={(e) => mudarItem(n, { preco: e.target.value })}
                inputMode="decimal"
                aria-label={`Preço de ${i.nome || "outro material"}`}
                className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900"
              />
              <span className="text-xs text-slate-500">€ por</span>
              <input
                value={i.unidade}
                onChange={(e) => mudarItem(n, { unidade: e.target.value })}
                maxLength={16}
                aria-label={`Unidade de ${i.nome || "outro material"}`}
                className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              />
            </div>
          ))}
          {estado.itens.length < MAXIMO_DE_MATERIAIS && (
            <button
              type="button"
              onClick={() =>
                onMudar({
                  ...estado,
                  itens: [...estado.itens, { id: `outro-${outros + 1}`, nome: "", preco: "", unidade: "unidade", usar: true }],
                })
              }
              className="text-sm font-semibold text-cyan-700 underline"
            >
              + Outro
            </button>
          )}
        </div>
      )}
    </div>
  );
}
