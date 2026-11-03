"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics";
import {
  ANDARES_DO_ENTULHO_EM_FRASE,
  comIvaEscrito,
  comOSuplemento,
  referenciaDoEntulho,
  semIvaEscrito,
  suplementoDoEntulho,
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
  { id: "sacos", nome: "Sacos (25 a 30 kg)" },
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

/** O acesso (d1 v2, 03-11-2026): os andares a pé somam por m³, pela mesma conta da referência e do motor. */
const ACESSOS: Array<{ id: string; nome: string; floor: number; hasElevator: string }> = [
  { id: "0", nome: "Rés-do-chão ou com elevador", floor: 0, hasElevator: "yes" },
  { id: "1", nome: "1.º andar sem elevador", floor: 1, hasElevator: "no" },
  { id: "2", nome: "2.º andar sem elevador", floor: 2, hasElevator: "no" },
  { id: "3", nome: "3.º andar sem elevador", floor: 3, hasElevator: "no" },
  { id: "4", nome: "4.º andar sem elevador", floor: 4, hasElevator: "no" },
  { id: "5", nome: "5.º andar sem elevador", floor: 5, hasElevator: "no" },
];

const numero = (v: number) => v.toLocaleString("pt-PT", { maximumFractionDigits: 2 });

export default function CalculadoraDeEntulho() {
  const [texto, setTexto] = useState("20");
  const [unidade, setUnidade] = useState<UnidadeDoEntulho>("sacos");
  const [acesso, setAcesso] = useState("0");
  const [longe, setLonge] = useState(false);

  const quantidade = Number(texto.replace(",", "."));
  const ref = referenciaDoEntulho(quantidade, unidade);
  const a = ACESSOS.find((x) => x.id === acesso) ?? ACESSOS[0];
  const suplemento = ref
    ? suplementoDoEntulho(ref.sacos, {
        floor: a.floor,
        hasElevator: a.hasElevator,
        parkingDistance: longe ? "over_30m" : null,
      })
    : null;
  const valor = ref ? comOSuplemento(ref.valor, suplemento?.valor ?? 0) : null;

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
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Onde está
          </span>
          <select
            value={acesso}
            onChange={(e) => setAcesso(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-800 outline-none focus:border-acao"
          >
            {ACESSOS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={longe}
            onChange={(e) => setLonge(e.target.checked)}
            className="h-5 w-5 accent-acao"
          />
          Estacionamento a mais de 30 metros ou difícil
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-[18px] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          {ref && valor ? (
            <>
              <p className="text-sm text-slate-600">
                ≈ {numero(ref.sacos)} sacos · ≈ {numero(ref.m3)} m³
              </p>
              {valor.tipo === "orcamento" ? (
                <p className="mt-1 text-lg font-bold text-tinta">
                  Volume grande: proposta a partir das fotografias
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xl font-bold text-tinta">{semIvaEscrito(valor)} + IVA</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {comIvaEscrito(valor)} com IVA
                  </p>
                </>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Referência. {ANDARES_DO_ENTULHO_EM_FRASE} A urgência também conta — o preço
                certo vem na proposta, antes de começar.
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
