"use client";

import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { ArrowRight, CalendarDays, ClipboardList } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { SERVICE_LABELS, type UserProfile, type Order, type OrderSummary, type Section } from "./types";

interface Props {
  user: UserProfile;
  googleAvatar: string | null;
  orders: Order[];
  summary: OrderSummary | null;
  onSection: (s: Section) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function VisaoGeral({ user, googleAvatar, orders, summary, onSection }: Props) {
  const nome = user.name ?? user.email.split("@")[0];
  const primeiroNome = nome.split(" ")[0];
  const avatar = user.avatarUrl ?? googleAvatar;

  // Prioriza o resumo calculado no servidor (conta TODOS os pedidos, não só a página).
  // Fallback: calcula a partir dos pedidos carregados enquanto o resumo não chega.
  const totalPedidos = summary?.totalOrders ?? orders.length;

  const pedidosAtivos = summary
    ? summary.activeOrders
    : orders.filter((o) => !["concluido", "cancelado", "rejeitado"].includes(o.status)).length;

  const ultimoPedido = summary?.lastOrderDate
    ? formatDate(summary.lastOrderDate)
    : orders[0]
      ? formatDate(orders[0].createdAt)
      : "—";

  return (
    <div className="space-y-8">
      {/* Card de boas-vindas */}
      <div className="flex items-center gap-5 overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <UserAvatar
          src={avatar}
          name={nome}
          size={72}
          className="shrink-0 ring-2 ring-[#00B4D8]/20"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-400">Bem-vindo de volta</p>
          <h2 className="text-2xl font-bold text-slate-900">{primeiroNome}</h2>
          <p className="mt-0.5 truncate text-sm text-slate-500" title={user.email}>{user.email}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Membro desde {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="flex gap-4">
        <MetricCard label="Pedidos realizados" value={totalPedidos} />
        <MetricCard label="Pedidos activos"    value={pedidosAtivos} />
        <MetricCard label="Último pedido"      value={ultimoPedido} />
      </div>

      {/* Sem pedidos */}
      {totalPedidos === 0 && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-slate-300" />
          <p className="mb-1 text-base font-semibold text-slate-700">
            Ainda não tens pedidos.
          </p>
          <p className="mb-6 text-sm text-slate-500">
            Faz um orçamento gratuito e recebe uma proposta em 24h.
          </p>
          <Link
            href="/simulador"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0077B6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005f96]"
          >
            Fazer o primeiro orçamento
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Últimos pedidos */}
      {orders.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Últimos pedidos</h3>
            <button
              type="button"
              onClick={() => onSection("pedidos")}
              className="text-sm font-medium text-[#0077B6] hover:underline"
            >
              Ver todos
            </button>
          </div>
          <ul className="space-y-3">
            {orders.slice(0, 3).map((o) => {
              const preco = o.precoFinalIva ?? o.precoFinal ?? o.estimateTotal;
              return (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {SERVICE_LABELS[o.serviceType] ?? o.serviceType}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={o.status} />
                      {o.scheduledDate && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(o.scheduledDate).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {preco != null && (
                      <p className="text-sm font-bold text-slate-900">{Number(preco).toFixed(2)} €</p>
                    )}
                    <p className="text-xs text-slate-400">{formatDate(o.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
