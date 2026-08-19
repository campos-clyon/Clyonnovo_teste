"use client";

import { ChevronRight, ChevronLeft, type LucideIcon } from "lucide-react";

/**
 * As peças do portal — do profissional e do cliente.
 *
 * O desenho é o das aplicações que estas pessoas já usam no telemóvel: uma
 * lista de linhas com ícone à esquerda, o valor à direita e uma seta a dizer
 * que se abre. Ninguém precisa de aprender nada — já sabe.
 *
 * A alternativa que estava cá antes eram separadores no topo. Num telemóvel,
 * quatro separadores ocupam a largura toda, cortam os nomes a meio e escondem
 * tudo o que não é o primeiro. Uma lista mostra o que existe, de uma vez, e
 * cada linha pode ainda dizer o essencial à direita — o saldo, quantos pedidos
 * esperam resposta — sem se abrir.
 */

export function GrupoDeLinhas({
  titulo,
  children,
  className = "",
}: {
  titulo?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {titulo && (
        <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">
          {titulo}
        </h2>
      )}
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-[#E2EEF3] bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

export function LinhaDeMenu({
  icone: Icone,
  rotulo,
  valor,
  destaque,
  aviso,
  onClick,
  tom = "normal",
  activo = false,
}: {
  icone: LucideIcon;
  rotulo: string;
  /** O que aparece à direita, antes da seta. */
  valor?: string;
  /** Um distintivo colorido — "3 à espera", "por verificar". */
  destaque?: string;
  aviso?: boolean;
  onClick: () => void;
  tom?: "normal" | "perigo";
  /**
   * A secção que está aberta. Só faz diferença no desenho de secretária, onde
   * o menu fica sempre à vista: sem marca nenhuma, olha-se para a lista e não
   * se sabe o que se está a ver do outro lado.
   */
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? "page" : undefined}
      className={`flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition active:bg-slate-50 ${
        activo ? "bg-cyan-50" : ""
      }`}
    >
      <Icone
        className={`h-5 w-5 shrink-0 ${tom === "perigo" ? "text-red-500" : "text-cyan-600"}`}
        aria-hidden="true"
      />
      <span
        className={`flex-1 text-[15px] font-medium ${
          tom === "perigo" ? "text-red-600" : "text-[#0B1929]"
        }`}
      >
        {rotulo}
      </span>
      {destaque && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            aviso ? "bg-amber-100 text-amber-800" : "bg-cyan-100 text-cyan-800"
          }`}
        >
          {destaque}
        </span>
      )}
      {valor && <span className="text-sm text-slate-500">{valor}</span>}
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
    </button>
  );
}

/**
 * O cabeçalho de um ecrã interior: seta para trás e título.
 *
 * A seta está sempre no mesmo sítio, e é grande o suficiente para um polegar —
 * 44 pixéis é o mínimo que se acerta sem olhar.
 */
export function CabecalhoDeEcra({
  titulo,
  onVoltar,
  accao,
}: {
  titulo: string;
  onVoltar: () => void;
  accao?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-1 border-b border-slate-100 bg-white/95 px-2 py-2 backdrop-blur sm:-mx-6 sm:px-4 lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0">
      {/* Num ecrã grande o menu está sempre à vista e a seta não tem para onde
          voltar — o backoffice também não a tem. Num telemóvel é a única
          forma de sair do ecrã aberto. */}
      <button
        type="button"
        onClick={onVoltar}
        aria-label="Voltar"
        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition active:bg-slate-100 lg:hidden"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden="true" />
      </button>
      <h1 className="flex-1 truncate text-lg font-bold text-[#0B1929]">{titulo}</h1>
      {accao}
    </header>
  );
}

/** Um botão redondo com o nome por baixo, como nas carteiras das aplicações. */
export function BotaoRedondo({
  icone: Icone,
  rotulo,
  onClick,
  desactivado,
}: {
  icone: LucideIcon;
  rotulo: string;
  onClick: () => void;
  desactivado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      className="flex w-20 flex-col items-center gap-1.5 disabled:opacity-40"
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full ${
          desactivado ? "bg-slate-100" : "bg-cyan-50 ring-1 ring-cyan-200"
        }`}
      >
        <Icone
          className={`h-6 w-6 ${desactivado ? "text-slate-400" : "text-cyan-700"}`}
          aria-hidden="true"
        />
      </span>
      <span className="text-center text-xs font-medium leading-tight text-slate-600">
        {rotulo}
      </span>
    </button>
  );
}

export function euros(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}
