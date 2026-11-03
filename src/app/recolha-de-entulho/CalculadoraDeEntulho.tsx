"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackCTAClick } from "@/lib/analytics";
import {
  ANDARES_DO_ENTULHO_EM_FRASE,
  comIvaEscrito,
  contaDosSacosEmTexto,
  linhasDosAndares,
  semIvaEscrito,
  type UnidadeDoEntulho,
} from "@/lib/quanto-custa";
import { valorDoEntulho } from "@/lib/preco-de-referencia";

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

/*
 * O ANDAR E O ELEVADOR (d4, 03-11-2026): os andares contam por trabalho, com e
 * sem elevador — a mesma conta da referência da app e do site e do motor
 * (`valorDoEntulho`). Era só «sem elevador», por m³ (d1 v2).
 */
const ANDARES: Array<{ id: number; nome: string }> = [
  { id: 0, nome: "Rés-do-chão" },
  { id: 1, nome: "1.º andar" },
  { id: 2, nome: "2.º andar" },
  { id: 3, nome: "3.º andar" },
  { id: 4, nome: "4.º andar" },
  { id: 5, nome: "5.º andar" },
];

const numero = (v: number) => v.toLocaleString("pt-PT", { maximumFractionDigits: 2 });

export default function CalculadoraDeEntulho() {
  const [texto, setTexto] = useState("20");
  const [unidade, setUnidade] = useState<UnidadeDoEntulho>("sacos");
  const [andar, setAndar] = useState(0);
  const [elevador, setElevador] = useState<"yes" | "no">("yes");
  const [longe, setLonge] = useState(false);

  const quantidade = Number(texto.replace(",", "."));
  const acesso = { floor: andar, hasElevator: andar > 0 ? elevador : null, parkingDistance: longe ? "over_30m" : null };
  const conta = valorDoEntulho(Number.isFinite(quantidade) && quantidade > 0 ? { quantidade, unidade } : null, acesso);
  const ref = conta?.ref ?? null;
  const valor = conta?.valor ?? null;
  // A conta à vista (d4): os sacos um a um e os andares, como no simulador.
  const linhasDaConta = conta
    ? [
        ...(conta.ref.porSaco
          ? [contaDosSacosEmTexto(conta.ref.sacos, unidade === "bigbags" ? `${numero(quantidade)} ${quantidade === 1 ? "big bag" : "big bags"}` : undefined)]
          : []),
        ...(conta.valor.tipo === "orcamento" ? [] : linhasDosAndares(conta.sup, acesso)),
      ]
    : [];

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
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Andar
          </span>
          <select
            value={andar}
            onChange={(e) => setAndar(Number(e.target.value))}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-800 outline-none focus:border-acao"
          >
            {ANDARES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        {andar > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Elevador
            </span>
            <select
              value={elevador}
              onChange={(e) => setElevador(e.target.value === "no" ? "no" : "yes")}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-800 outline-none focus:border-acao"
            >
              <option value="yes">Tem elevador</option>
              <option value="no">Não tem elevador</option>
            </select>
          </label>
        )}
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
              {linhasDaConta.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {linhasDaConta.map((l) => (
                    <li key={l} className="text-xs text-slate-700">
                      {l}
                    </li>
                  ))}
                </ul>
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
