"use client";

import { useEffect, useState } from "react";

/*
 * «ATRIBUIR DIRECTAMENTE A…» NO CARTÃO DE UM TRABALHO CLYON — 11-11-2026
 * (dono, o #591). *«Quero só atribuir o pedido a ele e ficar ligado a ele, sem
 * ele ter de fazer nada.»* Para um trabalho que já existe e que ainda ninguém
 * tem: escolhe-se o profissional com quem ficou combinado, e fica logo dele.
 * A rota é a dos Trabalhos CLYON (`accao: "atribuir"`).
 */

type Profissional = { id: number; nome: string };

export default function AtribuirDirectamente({
  token,
  pedidoId,
  ocupado,
  onAtribuir,
}: {
  token: string | null;
  pedidoId: number;
  ocupado: boolean;
  onAtribuir: (providerId: number, nome: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [todos, setTodos] = useState<Profissional[] | null>(null);
  const [escolhido, setEscolhido] = useState<number | null>(null);

  useEffect(() => {
    if (!aberto || todos != null || !token) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/profissionais", { headers: { Authorization: `Bearer ${token}` } });
        const dados = await res.json();
        if (!vivo) return;
        setTodos(
          (dados.profissionais ?? [])
            .filter(
              (p: Record<string, unknown>) => p.estado === "aprovado" && Number(p.isActive) === 1 && !p.contaDeTeste,
            )
            .map((p: Record<string, unknown>) => ({ id: Number(p.id), nome: String(p.name ?? `#${p.id}`) }))
            .sort((x: Profissional, y: Profissional) => x.nome.localeCompare(y.nome, "pt")),
        );
      } catch {
        if (vivo) setTodos([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [aberto, todos, token]);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10"
      >
        Atribuir directamente a…
      </button>
    );
  }

  const nome = todos?.find((p) => p.id === escolhido)?.nome ?? null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-900/60 bg-slate-950/60 p-2 text-xs">
      <select
        value={escolhido ?? ""}
        onChange={(e) => setEscolhido(e.target.value ? Number(e.target.value) : null)}
        className="h-8 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white"
      >
        <option value="">{todos == null ? "A carregar os profissionais…" : "Escolha o profissional…"}</option>
        {(todos ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={ocupado || escolhido == null}
        onClick={() => {
          if (escolhido == null) return;
          if (
            !window.confirm(
              `Atribuir o #${pedidoId} directamente a ${nome ?? "este profissional"}?\n\n` +
                "Fica logo com ele, como acordado por fora — sem ter de aceitar, e sem ir a mais ninguém. Quem tinha a oferta em aberto fica de fora. Ele é avisado de que o trabalho é dele, com o dia.",
            )
          )
            return;
          onAtribuir(escolhido, nome ?? "");
          setAberto(false);
        }}
        className="rounded-lg bg-acao px-3 py-1.5 font-semibold text-white hover:bg-acao-hover disabled:opacity-40"
      >
        Atribuir
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-300 hover:bg-slate-800"
      >
        Cancelar
      </button>
      <span className="basis-full text-[11px] text-slate-500">
        Para quando já está combinado com ele por fora: não precisa de aceitar na app.
      </span>
    </div>
  );
}
