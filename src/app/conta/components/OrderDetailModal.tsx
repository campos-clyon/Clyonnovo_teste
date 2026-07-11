"use client";

import { useMemo, useState } from "react";
import { CalendarDays, MessageCircle, Send, Star, X } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { SERVICE_LABELS, type Order, type OrderHistoryEntry } from "./types";
import { BUSINESS_PHONE } from "@/lib/seo-data";

function toWhatsAppNumber(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function parseHistory(json: string | null): OrderHistoryEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// Só entradas relevantes para o cliente aparecem como conversa
const CONVERSATION_TYPES = new Set(["info_requested", "client_reply", "message_to_client"]);

interface Props {
  order: Order;
  onClose: () => void;
  onOrderChange?: (updated: Partial<Order>) => void;
}

export default function OrderDetailModal({ order, onClose, onOrderChange }: Props) {
  const preco = order.precoFinalIva ?? order.precoFinal ?? order.estimateTotal;
  const [rating, setRating] = useState<number | null>(order.clientRating);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState("");

  const [historyJson, setHistoryJson] = useState<string | null>(order.historyJson);
  const [reply, setReply] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");

  const conversation = useMemo(() =>
    parseHistory(historyJson).filter((e) => CONVERSATION_TYPES.has(e.type)),
    [historyJson]
  );

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
      onOrderChange?.({ clientRating: stars });
    } catch (err: any) {
      setRatingError(err.message ?? "Erro ao guardar avaliação");
    } finally {
      setRatingSaving(false);
    }
  }

  async function handleSendReply() {
    const msg = reply.trim();
    if (!msg) return;
    setReplySending(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/users/me/orders/${order.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Erro ao enviar resposta");
      setHistoryJson(data?.historyJson ?? historyJson);
      onOrderChange?.({ historyJson: data?.historyJson ?? historyJson });
      setReply("");
    } catch (err: any) {
      setReplyError(err.message ?? "Erro ao enviar resposta");
    } finally {
      setReplySending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
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

          {/* ── Conversa cliente ↔ assistente ── */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#0077B6]" />
              <p className="text-xs font-semibold text-slate-700">Mensagens</p>
            </div>
            {conversation.length === 0 && !order.mensagemCliente ? (
              <p className="text-xs text-slate-400">Ainda não há mensagens neste pedido.</p>
            ) : (
              <ul className="space-y-2">
                {order.mensagemCliente && conversation.length === 0 && (
                  <li className="rounded-lg bg-white p-2.5 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Equipa CLYON</p>
                    <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{order.mensagemCliente}</p>
                  </li>
                )}
                {conversation.map((e, i) => {
                  const isClient = e.type === "client_reply";
                  return (
                    <li
                      key={i}
                      className={`rounded-lg p-2.5 shadow-sm ${isClient ? "ml-6 bg-blue-50" : "mr-6 bg-white"}`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {isClient ? "Tu" : (e.by?.nome ?? "Equipa CLYON")}
                        <span className="ml-1 text-slate-300 normal-case tracking-normal">· {formatDateTime(e.createdAt)}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{e.message}</p>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escreve uma resposta ou pergunta à equipa..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0077B6] focus:outline-none focus:ring-2 focus:ring-[#0077B6]/20"
              />
              <div className="mt-1.5 flex items-center justify-between gap-3">
                {replyError ? (
                  <p className="text-xs text-red-500 flex-1 truncate">{replyError}</p>
                ) : <span />}
                <button
                  type="button"
                  disabled={replySending || !reply.trim()}
                  onClick={handleSendReply}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077B6] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#005f96] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  {replySending ? "A enviar..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>

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
