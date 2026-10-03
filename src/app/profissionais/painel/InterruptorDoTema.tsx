"use client";

import { Moon } from "lucide-react";
import type { TemaDoPainel } from "@/lib/tema-do-painel";

/**
 * O MODO ESCURO, NA CONTA DELE — 03-10-2026.
 *
 * Uma linha do menu como as outras, com um interruptor em vez de abrir uma
 * secção: mudar de tema é um gesto, não um formulário. `role="switch"` para o
 * leitor de ecrã dizer «ligado/desligado», e a linha inteira é o alvo — não só
 * a bolinha.
 */
export default function InterruptorDoTema({
  tema,
  onMudar,
}: {
  tema: TemaDoPainel;
  onMudar: (tema: TemaDoPainel) => void;
}) {
  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={escuro}
      onClick={() => onMudar(escuro ? "claro" : "escuro")}
      className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition active:bg-slate-50"
    >
      <Moon className="h-5 w-5 shrink-0 text-cyan-600" aria-hidden="true" />
      <span className="flex-1 text-[15px] font-medium text-tinta">Modo escuro</span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${escuro ? "bg-acao" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            escuro ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}
