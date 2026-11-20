"use client";

import { useCallback, useEffect, useState } from "react";
import type { PagoPorRealizar } from "@/lib/pedido-concluido";

/**
 * «PAGOS DOS DOIS LADOS, AINDA NÃO REALIZADOS» — d76 (CEO e dono, 20-11-2026).
 *
 * Só para o administrador, nos Pagamentos. A lista só lê; o botão «Marcar como
 * realizado» fecha UM pedido pelo mesmo fecho do «Realizado» da lista de
 * Pedidos (a folha do Google, o aviso ao cliente). A pergunta é um diálogo da
 * página, nunca a janela nativa do navegador. Os pedidos novos fecham sozinhos
 * (`fecho-automatico.ts`): isto é para os que ficaram parados antes.
 */

export const TITULO_DOS_PAGOS_DOS_DOIS_LADOS = "Pagos dos dois lados, ainda não realizados";

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const dia = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v))
    : null;

export default function PagosDosDoisLados({ token, aoMudar }: { token: string | null; aoMudar?: () => void }) {
  const [lista, setLista] = useState<PagoPorRealizar[] | null>(null);
  const [erro, setErro] = useState("");
  const [aPerguntar, setAPerguntar] = useState<PagoPorRealizar | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const [erroDoDialogo, setErroDoDialogo] = useState("");

  const ler = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/admin/pagamentos/pagos-dos-dois-lados", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error ?? "Não foi possível ler.");
      else {
        setErro("");
        setLista(d.lista ?? []);
      }
    } catch {
      setErro("Erro de rede.");
    }
  }, [token]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function marcar(l: PagoPorRealizar) {
    if (!token) return;
    setAGravar(true);
    setErroDoDialogo("");
    try {
      const r = await fetch("/api/admin/pagamentos/pagos-dos-dois-lados", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedidoId: l.pedidoId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErroDoDialogo(d.error ?? "Não foi possível marcar.");
        return;
      }
      setAPerguntar(null);
      await ler();
      aoMudar?.();
    } catch {
      setErroDoDialogo("Erro de rede.");
    } finally {
      setAGravar(false);
    }
  }

  if (erro) return <p className="text-xs text-red-300">{TITULO_DOS_PAGOS_DOS_DOIS_LADOS}: {erro}</p>;
  if (!lista || lista.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
      <h3 className="text-sm font-bold text-white">
        {TITULO_DOS_PAGOS_DOS_DOIS_LADOS} <span className="font-semibold text-slate-400">({lista.length})</span>
      </h3>
      <p className="mt-0.5 text-xs text-slate-400">
        O cliente e o profissional estão pagos, mas o pedido não ficou como realizado — por isso ainda não conta para os assistentes.
        Os novos fecham sozinhos.
      </p>
      <ul className="mt-2 divide-y divide-slate-800">
        {lista.map((l) => (
          <li key={l.pedidoId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="text-slate-200">
              <strong className="text-white">#{l.pedidoId}</strong>
              {l.servico ? ` · ${l.servico}` : ""}
              {l.cidade ? ` · ${l.cidade}` : ""}
              {l.profissional ? ` · ${l.profissional}` : ""}
              {l.clientePaga != null ? ` · ${euros(l.clientePaga)}` : ""}
              {l.dataFutura && dia(l.agendadoPara) ? (
                <span className="text-amber-300"> · marcado para {dia(l.agendadoPara)}</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => {
                setErroDoDialogo("");
                setAPerguntar(l);
              }}
              className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
            >
              Marcar como realizado
            </button>
          </li>
        ))}
      </ul>

      {aPerguntar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pagos-dos-dois-lados-titulo"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <h2 id="pagos-dos-dois-lados-titulo" className="text-base font-bold text-white">
              Marcar o pedido #{aPerguntar.pedidoId} como realizado?
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Sai da lista ativa, entra na folha de trabalhos concluídos e passa a contar para os assistentes. O cliente recebe o
              aviso de pedido concluído, como no «Realizado» da lista de Pedidos.
            </p>
            {aPerguntar.dataFutura && (
              <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Este pedido ainda não está na data{dia(aPerguntar.agendadoPara) ? ` (${dia(aPerguntar.agendadoPara)})` : ""}.
              </p>
            )}
            {erroDoDialogo && <p className="mt-2 text-sm text-red-300">{erroDoDialogo}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAPerguntar(null)}
                disabled={aGravar}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void marcar(aPerguntar)}
                disabled={aGravar}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {aGravar ? "A marcar…" : "Marcar como realizado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
