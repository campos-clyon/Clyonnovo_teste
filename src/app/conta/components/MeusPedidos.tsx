"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, MessageCircle, Star, X } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { SERVICE_LABELS, type Order } from "./types";
import { BUSINESS_PHONE } from "@/lib/seo-data";

function toWhatsAppNumber(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

const FILTER_TABS = [
  { value: "todos",      label: "Todos" },
  { value: "pendente",   label: "Novo" },
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

interface OrderModalProps {
  order: Order;
  onClose: () => void;
}

function OrderModal({ order, onClose }: OrderModalProps) {
  const preco = order.precoFinalIva ?? order.precoFinal ?? order.estimateTotal;
  const [rating, setRating] = useState<number | null>(order.clientRating);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState("");

  const professionalName = order.providerName ?? order.assignedToName;
  const supportWhatsapp = `https://wa.me/${toWhatsAppNumber(BUSINESS_PHONE)}?text=${encodeURIComponent(
    `Olá! Sobre o pedido #${order.id}, gostava de falar com quem está a tratar do meu serviço.`,
  )}`;
  const swapWhatsapp = `https://wa.me/${toWhatsAppNumber(BUSINESS_PHONE)}?text=${encodeURIComponent(
    `Olá! Gostava de pedir a troca do profissional atribuído ao pedido #${order.id}.`,
  )}`;
  const professionalWhatsapp = order.providerPhone
    ? `https://wa.me/${toWhatsAppNumber(order.providerPhone)}?text=${encodeURIComponent(
        `Olá! Sou cliente CLYON, pedido #${order.id}.`,
      )}`
    : supportWhatsapp;

  async function handleRate(stars: number) {
    setRatingSaving(true);
    setRatingError("");
    try {
      const res = await fetch(`/api/users/me/orders/${order.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: stars }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Erro ao guardar avaliação");
      setRating(stars);
    } catch (err: any) {
      setRatingError(err.message ?? "Erro ao guardar avaliação");
    } finally {
      setRatingSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {SERVICE_LABELS[order.serviceType] ?? order.serviceType}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">Pedido #{order.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Estado:</span>
            <StatusBadge status={order.status} />
          </div>
          {order.address && (
            <div>
              <span className="font-medium text-slate-700">Morada: </span>
              <span className="text-slate-600">
                {[order.address, order.city, order.postalCode].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
          {order.description && (
            <div>
              <span className="font-medium text-slate-700">Descrição: </span>
              <span className="text-slate-600">{order.description}</span>
            </div>
          )}
          {order.mensagemCliente && (
            <div>
              <span className="font-medium text-slate-700">Mensagem: </span>
              <span className="text-slate-600">{order.mensagemCliente}</span>
            </div>
          )}
          {order.scheduledDate && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <CalendarDays className="h-4 w-4 text-[#00B4D8]" />
              Agendado para{" "}
              {new Date(order.scheduledDate).toLocaleDateString("pt-PT", {
                weekday: "long", day: "2-digit", month: "long",
              })}
              {order.scheduledStartTime ? ` às ${order.scheduledStartTime}` : ""}
            </div>
          )}

          {professionalName && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Profissional atribuído</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{professionalName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={professionalWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1ebe5d]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Contactar
                </a>
                <a
                  href={swapWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Pedir troca
                </a>
              </div>
            </div>
          )}

          {order.status === "concluido" && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">
                {rating ? "A sua avaliação" : "Como correu o serviço?"}
              </p>
              <div className="mt-1.5 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={ratingSaving || rating != null}
                    onClick={() => handleRate(star)}
                    className="disabled:cursor-default"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        rating != null && star <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {ratingError && <p className="mt-1 text-xs text-red-500">{ratingError}</p>}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-400">Criado a {formatDate(order.createdAt)}</span>
            {preco != null && (
              <span className="text-base font-bold text-slate-900">{Number(preco).toFixed(2)} € s/IVA</span>
            )}
            {preco == null && order.estimateMin != null && order.estimateMax != null && (
              <span className="text-sm font-semibold text-slate-700">
                {Number(order.estimateMin).toFixed(0)}–{Number(order.estimateMax).toFixed(0)} € estimativa
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MeusPedidos() {
  const [filter, setFilter]   = useState("todos");
  const [page, setPage]       = useState(1);
  const [orders, setOrders]   = useState<Order[]>([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);

  const fetchOrders = useCallback(async (f: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/me/orders?status=${f}&page=${p}`, { credentials: "include" });
      const data = await res.json() as { orders: Order[]; total: number; pages: number };
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchOrders(filter, page); }, [filter, page, fetchOrders]);

  const handleFilter = (f: string) => { setFilter(f); setPage(1); };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Os meus pedidos</h2>
        <p className="mt-0.5 text-sm text-slate-500">{total} {total === 1 ? "pedido" : "pedidos"} no total</p>
      </div>

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
              <p className="mb-4 text-sm text-slate-400">Ainda não fizeste nenhum pedido.</p>
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
              const preco = o.precoFinalIva ?? o.precoFinal ?? o.estimateTotal;
              const local = o.city ?? o.address?.split(",").pop()?.trim();
              return (
                <li
                  key={o.id}
                  className="rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:border-slate-200 hover:shadow"
                >
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {SERVICE_LABELS[o.serviceType] ?? o.serviceType}
                        </span>
                        <StatusBadge status={o.status} />
                      </div>
                      {local && <p className="mt-0.5 text-xs text-slate-400">{local}</p>}
                      {o.scheduledDate && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <CalendarDays className="h-3 w-3 text-[#00B4D8]" />
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
                        <p className="text-xs text-slate-400">{formatDate(o.createdAt)}</p>
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

      {selected && <OrderModal order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
