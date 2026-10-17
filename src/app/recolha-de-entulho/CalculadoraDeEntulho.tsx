"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics";
import {
  comIvaEscrito,
  referenciaDoEntulho,
  semIvaEscrito,
  type UnidadeDoEntulho,
} from "@/lib/quanto-custa";

/*
 * A CALCULADORA DE REFERÊNCIA — 17-10-2026.
 *
 * Substitui o «Qual é o seu caso?» do mesmo dia: o dono pediu as duas
 * opções, e a calculadora faz o que a escolha fazia e mais — a pessoa diz a
 * quantidade na medida que conhece (sacos, m³ ou big bags) em vez de adivinhar
 * a linha. As contas são de `referenciaDoEntulho` (quanto-custa.ts), que só lê
 * a grelha publicada: aqui não há número nenhum.
 */

export const PEDIR_ENTULHO = "/simulador?servico=recolha_entulho";

const UNIDADES: Array<{ id: UnidadeDoEntulho; nome: string }> = [
  { id: "sacos", nome: "Sacos (até 25 kg)" },
  { id: "m3", nome: "Metros cúbicos (m³)" },
  { id: "bigbags", nome: "Big bags" },
];

/** Atalhos para quem não sabe contar: as linhas da grelha. */
const ATALHOS: Array<{ nome: string; quantidade: number; unidade: UnidadeDoEntulho }> = [
  { nome: "10 sacos", quantidade: 10, unidade: "sacos" },
  { nome: "WC ou cozinha (1 m³)", quantidade: 1, unidade: "m3" },
  { nome: "Obra num T1/T2 (3 m³)", quantidade: 3, unidade: "m3" },
  { nome: "Renovação (5 m³)", quantidade: 5, unidade: "m3" },
];

const numero = (v: number) => v.toLocaleString("pt-PT", { maximumFractionDigits: 2 });

export default function CalculadoraDeEntulho() {
  const [texto, setTexto] = useState("20");
  const [unidade, setUnidade] = useState<UnidadeDoEntulho>("sacos");

  const quantidade = Number(texto.replace(",", "."));
  const ref = referenciaDoEntulho(quantidade, unidade);

  return (
    <div className="mt-8 rounded-[24px] border border-slate-200 bg-white p-5 sm:p-7">
      <h3 className="text-lg font-bold text-tinta">Calcule a referência para o seu entulho</h3>
      <p className="mt-1 text-sm text-slate-600">
        Diga quanto tem, na medida que conhece. O preço certo vem na proposta.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Exemplos">
        {ATALHOS.map((a) => (
          <button
            key={a.nome}
            type="button"
            onClick={() => {
              setTexto(String(a.quantidade));
              setUnidade(a.unidade);
            }}
            className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-acao"
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Quantidade
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ""))}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-800 outline-none focus:border-acao"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Medida
          </span>
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value as UnidadeDoEntulho)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-800 outline-none focus:border-acao"
          >
            {UNIDADES.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-[18px] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          {ref ? (
            <>
              <p className="text-sm text-slate-600">
                ≈ {numero(ref.sacos)} sacos · ≈ {numero(ref.m3)} m³
              </p>
              {ref.valor.tipo === "orcamento" ? (
                <p className="mt-1 text-lg font-bold text-tinta">
                  Volume grande: proposta a partir das fotografias
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xl font-bold text-tinta">{semIvaEscrito(ref.valor)} + IVA</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {comIvaEscrito(ref.valor)} com IVA
                  </p>
                </>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Referência. Andar sem elevador, estacionamento difícil ou urgência contam — o
                preço certo vem na proposta, antes de começar.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Escreva a quantidade para ver a referência.</p>
          )}
        </div>
        <Link
          href={PEDIR_ENTULHO}
          onClick={() =>
            trackCTAClick("Pedir proposta de entulho", `calculadora:${ref?.sacos ?? 0}-sacos`)
          }
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-acao px-5 text-sm font-semibold text-white hover:bg-acao-hover"
        >
          Pedir proposta
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
