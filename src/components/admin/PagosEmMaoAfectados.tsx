"use client";

import { useEffect, useState } from "react";
import type { ProfissionalAfectado } from "@/lib/pagos-em-mao-afectados";

/**
 * OS PAGOS EM MÃO QUE A CARTEIRA CONTAVA EM «POR RECEBER» — 01-11-2026.
 *
 * Só para o administrador, nos Pagamentos. Só lê. Diz quantos são e, em
 * primeiro lugar, quem tem um pedido de transferência aberto — esse confere-se
 * antes de se pagar. Ver `pagos-em-mao-afectados.ts`.
 */

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const dia = (v: string | null) => {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v));
};

const ALERTA: Record<NonNullable<ProfissionalAfectado["alerta"]>, string> = {
  pedido_aberto: "Tem um pedido de transferência aberto — conferir antes de pagar",
  pago_um_a_um: "A CLYON já marcou um destes trabalhos como pago ao profissional",
  transferencia_depois: "Houve uma transferência paga depois do registo — conferir se levou estes valores",
};

export default function PagosEmMaoAfectados({ token }: { token: string | null }) {
  const [dados, setDados] = useState<{
    profissionais: ProfissionalAfectado[];
    totalTrabalhos: number;
    conferido?: { porQuem: string; em: string } | null;
  } | null>(null);
  const [erro, setErro] = useState("");
  // Uma linha fechada que se abre ao tocar (02-11-2026, dono).
  const [aberto, setAberto] = useState(false);
  const [aGravar, setAGravar] = useState(false);

  async function jaConferi() {
    if (!token) return;
    setAGravar(true);
    try {
      const r = await fetch("/api/admin/pagamentos/pagos-em-mao", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error ?? "Não foi possível gravar.");
      else setDados((x) => (x ? { ...x, conferido: d.conferido } : x));
    } catch {
      setErro("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    fetch("/api/admin/pagamentos/pagos-em-mao", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const d = await r.json();
        if (!vivo) return;
        if (!r.ok) setErro(d.error ?? "Não foi possível ler.");
        else setDados(d);
      })
      .catch(() => vivo && setErro("Erro de rede."));
    return () => {
      vivo = false;
    };
  }, [token]);

  if (erro) return <p className="text-xs text-red-300">Pagos em mão: {erro}</p>;
  if (!dados || dados.profissionais.length === 0) return null;
  // Conferido, e sem trabalhos novos desde então: não ocupa o ecrã.
  if (dados.conferido) return null;

  const abertos = dados.profissionais.filter((p) => p.alerta === "pedido_aberto").length;
  return (
    <section
      className={`rounded-xl border px-4 py-3 ${abertos > 0 ? "border-red-500/40 bg-red-500/[0.08]" : "border-slate-700 bg-slate-900/60"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="text-left text-sm text-slate-200"
        >
          <span className="font-semibold text-white">Para conferir:</span> {dados.totalTrabalhos} trabalho(s) pagos em
          mão · {dados.profissionais.length} profissional(is)
          {abertos > 0 && <span className="ml-1 font-semibold text-red-300">· {abertos} com transferência pedida</span>}
          <span className="ml-2 text-xs text-slate-400">{aberto ? "fechar" : "abrir"}</span>
        </button>
        <button
          type="button"
          onClick={() => void jaConferi()}
          disabled={aGravar}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-40"
        >
          {aGravar ? "A gravar…" : "Já conferi"}
        </button>
      </div>
      {aberto && (
        <>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        Corrigido a 01/11/2026: já aparecem como recebidos em mão, e a taxa fica a descontar no saldo. Esta
        lista é para conferir quem pode ter recebido duas vezes. «Já conferi» esconde-a até aparecer um caso novo.
      </p>
      <ul className="mt-3 space-y-2">
        {dados.profissionais.map((p) => (
          <li key={p.providerId} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-white">{p.profissional ?? `Profissional ${p.providerId}`}</span>
              <span>
                mostrava a mais {euros(p.mostradoAMais)} · deve à CLYON {euros(p.deve)}
              </span>
            </p>
            {p.alerta && (
              <p className={`mt-1 font-semibold ${p.alerta === "pedido_aberto" ? "text-red-300" : "text-amber-300"}`}>
                {ALERTA[p.alerta]}
              </p>
            )}
            <p className="mt-1">
              {p.trabalhos
                .map((t) => `#${t.pedidoId} (${euros(t.recebe)}${t.pagoUmAUm ? ", pago um a um" : ""})`)
                .join(" · ")}
            </p>
            {p.pedidosAbertos.length > 0 && (
              <p className="mt-1 text-red-300">
                Pedido(s) aberto(s): {p.pedidosAbertos.map((v) => `#${v.id} ${euros(v.valor)} de ${dia(v.em)}`).join(" · ")}
              </p>
            )}
            {p.transferenciasDepois.length > 0 && (
              <p className="mt-1 text-amber-300">
                Transferência(s) pagas depois:{" "}
                {p.transferenciasDepois.map((v) => `#${v.id} ${euros(v.valor)} a ${dia(v.em)}`).join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>
        </>
      )}
    </section>
  );
}
