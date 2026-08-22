"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import StatusBadge from "./StatusBadge";
import OrderDetailModal from "./OrderDetailModal";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import {
  SERVICE_LABELS,
  estadoNaPlataforma,
  type Order,
  type OrderSummary,
} from "./types";

const FILTER_TABS = [
  { value: "todos",      label: "Todos" },
  { value: "novo",       label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "aprovado",   label: "Aprovado" },
  { value: "agendado",   label: "Agendado" },
  { value: "concluido",  label: "Concluído" },
  { value: "cancelado",  label: "Cancelado" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="flex-1 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-tinta-fraca">{rotulo}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">{valor}</p>
    </div>
  );
}

export default function MeusPedidos({ resumo }: { resumo?: OrderSummary | null }) {
  const [filter, setFilter]   = useState("todos");
  const [page, setPage]       = useState(1);
  const [orders, setOrders]   = useState<Order[]>([]);
  const [total, setTotal]     = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);

  /**
   * @param silencioso Sem mostrar "a carregar". É como o ciclo automático
   * corre: quem está a ler não pode ver a lista desaparecer de minuto a
   * minuto para voltar igual.
   */
  const fetchOrders = useCallback(
    async (f: string, p: number, silencioso = false) => {
      if (!silencioso) setLoading(true);
      try {
        const res = await fetch(`/api/users/me/orders?status=${f}&page=${p}`, {
          credentials: "include",
        });
        const data = (await res.json()) as {
          orders: Order[];
          total: number;
          pages: number;
          summary?: { totalOrders?: number };
        };

        // Só se troca o que mudou. Substituir sempre fazia a lista redesenhar-se
        // inteira a cada minuto, e o detalhe aberto perder o que estivesse a ser
        // escrito na caixa de mensagem.
        const novos = data.orders ?? [];
        setOrders((antes) =>
          JSON.stringify(antes) === JSON.stringify(novos) ? antes : novos,
        );

        // O pedido aberto acompanha: é aí que aparece a proposta que o
        // profissional acabou de fazer, sem ser preciso fechar e abrir.
        setSelected((aberto) => {
          if (!aberto) return aberto;
          const actualizado = novos.find((o) => o.id === aberto.id);
          if (!actualizado) return aberto;
          return JSON.stringify(aberto) === JSON.stringify(actualizado)
            ? aberto
            : actualizado;
        });

        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        // Total geral (todos os pedidos) — independente do filtro ativo.
        if (typeof data.summary?.totalOrders === "number") {
          setGrandTotal(data.summary.totalOrders);
        }
      } finally {
        if (!silencioso) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => { void fetchOrders(filter, page); }, [filter, page, fetchOrders]);

  /*
   * De minuto a minuto, sem dar por isso.
   *
   * As propostas dos profissionais chegam enquanto o cliente está a olhar para
   * o pedido. Sem isto, ele via um ecrã parado e concluía que ninguém tinha
   * respondido — e a proposta tem 48 horas de prazo a correr.
   */
  useAutoRefresh(() => fetchOrders(filter, page, true), { intervalMs: 60_000 });

  const handleFilter = (f: string) => { setFilter(f); setPage(1); };

  /*
   * Ou a lista, ou o detalhe — nunca os dois, e nunca um por cima do outro.
   *
   * É o que o backoffice faz e o que o resto desta conta já fazia: o menu à
   * esquerda fica onde está, e o que se escolhe abre à direita. Assim o detalhe
   * herda a largura da área de conteúdo em vez de a inventar.
   */
  if (selected) {
    return (
      <OrderDetailModal
        order={selected}
        onClose={() => setSelected(null)}
        onOrderChange={(patch) => {
          setSelected((cur) => (cur ? ({ ...cur, ...patch } as Order) : cur));
          setOrders((cur) =>
            cur.map((o) => (o.id === selected.id ? ({ ...o, ...patch } as Order) : o)),
          );
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Os meus pedidos</h2>
        <p className="mt-0.5 text-sm text-slate-500">{grandTotal} {grandTotal === 1 ? "pedido" : "pedidos"} no total</p>
      </div>

      {/* As três contas que vinham da Visão Geral. É o que ela tinha de útil e
          que a lista não diz — o resto era a mesma lista outra vez. */}
      {resumo && resumo.totalOrders > 0 && (
        <div className="flex gap-3">
          <Metrica rotulo="Pedidos" valor={resumo.totalOrders} />
          <Metrica rotulo="A decorrer" valor={resumo.activeOrders} />
          <Metrica
            rotulo="Último"
            valor={
              resumo.lastOrderDate
                ? new Date(resumo.lastOrderDate).toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                  })
                : "—"
            }
          />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => handleFilter(t.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === t.value
                ? "bg-[#0077B6] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00B4D8] border-t-transparent" />
        </div>
      )}

      {/* Sem resultados */}
      {!loading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          <p className="mb-1 text-sm font-semibold text-slate-700">Sem pedidos nesta categoria.</p>
          {filter === "todos" && (
            <>
              <p className="mb-4 text-sm text-tinta-fraca">Ainda não fizeste nenhum pedido.</p>
              <Link
                href="/simulador"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0077B6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005f96]"
              >
                Pedir orçamento gratuito
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      )}

      {/* Lista */}
      {!loading && orders.length > 0 && (
        <>
          <ul className="space-y-3">
            {orders.map((o) => {
              const plataforma = estadoNaPlataforma(o);
              const preco =
                plataforma.valor ?? o.precoFinalIva ?? o.precoFinal ?? o.estimateTotal;
              const local = o.city ?? o.address?.split(",").pop()?.trim();
              // Uma proposta à espera dele é a única coisa nesta lista com
              // prazo a correr — 48 horas. Sem nada que a distinga, o pedido
              // com uma proposta em cima da mesa parece igual ao que está
              // simplesmente à espera de alguém.
              const aEsperar = plataforma.urgente ? 1 : 0;
              return (
                <li
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className={`cursor-pointer rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                    aEsperar > 0
                      ? "border-l-4 border-l-[#00B4CC] border-y-slate-100 border-r-slate-100 ring-1 ring-[#00B4CC]/20"
                      : "border-slate-100 hover:border-[#0077B6]/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {SERVICE_LABELS[o.serviceType] ?? o.serviceType}
                        </span>
                        {plataforma.etiqueta ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              plataforma.urgente
                                ? "bg-[#00B4CC] text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {plataforma.etiqueta}
                          </span>
                        ) : (
                          <StatusBadge status={o.status} />
                        )}
                      </div>
                      {local && <p className="mt-0.5 text-xs text-tinta-fraca">{local}</p>}
                      {o.scheduledDate && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-tinta-fraca">
                          <CalendarDays className="h-3 w-3 text-acao" />
                          {new Date(o.scheduledDate).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
                          {o.scheduledStartTime ? ` às ${o.scheduledStartTime}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        {preco != null && (
                          <p className="text-sm font-bold text-slate-900">{Number(preco).toFixed(2)} €</p>
                        )}
                        <p className="text-xs text-tinta-fraca">
                          {plataforma.legenda === "acordado" ? "a pagar" : formatDate(o.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelected(o)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-[#0077B6]"
                      >
                        Ver detalhe
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Paginação */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-600">
                Página {page} de {pages}
              </span>
              <button
                type="button"
                disabled={page === pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
