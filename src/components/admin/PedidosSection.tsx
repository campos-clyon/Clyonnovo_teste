"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Euro,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";
import { BUSINESS_PHONE } from "@/lib/seo-data";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "pendente"
  | "aprovado"
  | "rejeitado"
  | "em_execucao"
  | "concluido"
  | "cancelado";

type SimulatorOrder = {
  id: number;
  serviceType?: string | null;
  description?: string | null;
  filesJson?: string | null;
  address?: string | null;
  city?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  urgency?: string | null;
  estimateMin?: string | null;
  estimateMax?: string | null;
  estimateTotal?: string | null;
  distanceKm?: string | null;
  distanceText?: string | null;
  status: OrderStatus;
  notasInternas?: string | null;
  precoFinal?: string | null;
  colaboradorId?: number | null;
  dataAgendada?: string | null;
  createdAt: string;
  updatedAt: string;
};

type StatusCounts = Partial<Record<OrderStatus | "todos", number>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  pendente: {
    label: "Pendente",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/30",
    dot: "bg-amber-400",
  },
  aprovado: {
    label: "Aprovado",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/30",
    dot: "bg-cyan-400",
  },
  rejeitado: {
    label: "Rejeitado",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/30",
    dot: "bg-red-400",
  },
  em_execucao: {
    label: "Em execucao",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/30",
    dot: "bg-blue-400",
  },
  concluido: {
    label: "Concluido",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/30",
    dot: "bg-emerald-400",
  },
  cancelado: {
    label: "Cancelado",
    color: "text-slate-400",
    bg: "bg-slate-400/10 border-slate-400/30",
    dot: "bg-slate-400",
  },
};

const ALL_STATUSES: OrderStatus[] = [
  "pendente",
  "aprovado",
  "rejeitado",
  "em_execucao",
  "concluido",
  "cancelado",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEuro(val?: string | null) {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : `${n.toFixed(0)}\u20ac`;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── InfoChip ─────────────────────────────────────────────────────────────────

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-200 truncate">{value}</p>
    </div>
  );
}

// ─── EditField ────────────────────────────────────────────────────────────────

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({
  order,
  token,
  onClose,
  onSaved,
}: {
  order: SimulatorOrder;
  token: string;
  onClose: () => void;
  onSaved: (updated: SimulatorOrder) => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [precoFinal, setPrecoFinal] = useState(order.precoFinal ?? "");
  const [notasInternas, setNotasInternas] = useState(order.notasInternas ?? "");
  const [dataAgendada, setDataAgendada] = useState(
    order.dataAgendada ? order.dataAgendada.slice(0, 16) : ""
  );
  const [contactName, setContactName] = useState(order.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(order.contactPhone ?? "");
  const [description, setDescription] = useState(order.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const waApprovalMsg = encodeURIComponent(
    `Ola ${order.contactName ?? "cliente"}, o seu pedido CLYON foi aprovado!\n\nServico: ${order.serviceType ?? "a definir"}\nMorada: ${order.address ?? "a confirmar"}${precoFinal ? `\nPreco final: ${precoFinal}EUR` : ""}${dataAgendada ? `\nData prevista: ${new Date(dataAgendada).toLocaleDateString("pt-PT")}` : ""}\n\nEntraremos em contacto brevemente para confirmar todos os detalhes.`
  );

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: order.id,
          status,
          precoFinal: precoFinal || null,
          notasInternas: notasInternas || null,
          dataAgendada: dataAgendada || null,
          contactName: contactName || null,
          contactPhone: contactPhone || null,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao guardar");
      onSaved(data.order as SimulatorOrder);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(9,25,40,0.99)_0%,rgba(11,30,47,0.97)_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Pedido #{order.id}
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              {order.serviceType ?? "Servico nao especificado"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Info resumo */}
          <div className="grid grid-cols-2 gap-3">
            <InfoChip icon={MapPin} label="Morada" value={order.address ?? order.city ?? "—"} />
            <InfoChip icon={User} label="Contacto" value={order.contactName ?? "—"} />
            <InfoChip icon={Phone} label="Telefone" value={order.contactPhone ?? "—"} />
            <InfoChip
              icon={Euro}
              label="Estimativa"
              value={
                formatEuro(order.estimateTotal) ??
                (order.estimateMin
                  ? `${formatEuro(order.estimateMin) ?? "—"} – ${formatEuro(order.estimateMax) ?? "—"}`
                  : "—")
              }
            />
          </div>

          {order.description && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Descricao do pedido
              </p>
              <p className="text-sm leading-relaxed text-slate-200">{order.description}</p>
            </div>
          )}

          {/* Detalhes extras */}
          {(order.floor || order.hasElevator || order.distanceText) && (
            <div className="grid grid-cols-3 gap-2">
              {order.floor && (
                <InfoChip icon={MapPin} label="Andar" value={order.floor} />
              )}
              {order.hasElevator && (
                <InfoChip icon={Check} label="Elevador" value={order.hasElevator} />
              )}
              {order.distanceText && (
                <InfoChip icon={CalendarClock} label="Distancia" value={order.distanceText} />
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Estado do pedido
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex items-center gap-2 rounded-[14px] border px-3 py-2.5 text-sm font-semibold transition ${
                      status === s
                        ? `${cfg.bg} ${cfg.color} border-transparent`
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${
                        status === s ? cfg.dot : "bg-slate-600"
                      }`}
                    />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preco final */}
          <EditField label="Preco final (EUR)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={precoFinal}
              onChange={(e) => setPrecoFinal(e.target.value)}
              placeholder="ex: 250.00"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
            />
          </EditField>

          {/* Data agendada */}
          <EditField label="Data agendada">
            <input
              type="datetime-local"
              value={dataAgendada}
              onChange={(e) => setDataAgendada(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none"
            />
          </EditField>

          {/* Contacto */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditField label="Nome do cliente">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
              />
            </EditField>
            <EditField label="Telefone">
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
              />
            </EditField>
          </div>

          {/* Descricao */}
          <EditField label="Descricao do servico">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
            />
          </EditField>

          {/* Notas internas */}
          <EditField label="Notas internas (apenas admins)">
            <textarea
              rows={3}
              value={notasInternas}
              onChange={(e) => setNotasInternas(e.target.value)}
              placeholder="Anotacoes internas sobre este pedido..."
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
            />
          </EditField>

          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4">
          {order.contactPhone && (
            <a
              href={`https://wa.me/${order.contactPhone.replace(/\D/g, "")}?text=${waApprovalMsg}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/20 transition"
            >
              <MessageCircle className="h-4 w-4" />
              Notificar cliente (WhatsApp)
            </a>
          )}
          <div className="flex flex-1 justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 transition"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving ? "A guardar..." : "Guardar alteracoes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({
  order,
  token,
  onClose,
  onDeleted,
}: {
  order: SimulatorOrder;
  token: string;
  onClose: () => void;
  onDeleted: (id: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/pedidos?id=${order.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao apagar");
      onDeleted(order.id);
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[28px] border border-red-400/20 bg-[linear-gradient(180deg,rgba(9,25,40,0.99)_0%,rgba(11,30,47,0.97)_100%)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Apagar pedido #{order.id}?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Esta accao e permanente. O pedido de{" "}
          <span className="font-semibold text-slate-200">
            {order.contactName ?? "cliente desconhecido"}
          </span>{" "}
          sera removido da base de dados.
        </p>
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60 transition"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {deleting ? "A apagar..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QuickStatusButton ────────────────────────────────────────────────────────

function QuickStatusButton({
  orderId,
  newStatus,
  token,
  onUpdated,
}: {
  orderId: number;
  newStatus: OrderStatus;
  token: string;
  onUpdated: (id: number, status: OrderStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CONFIG[newStatus];

  async function handle() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      if (res.ok) onUpdated(orderId, newStatus);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      title={cfg.label}
      className={`flex h-7 w-7 items-center justify-center rounded-xl border transition disabled:opacity-50 ${cfg.bg} ${cfg.color} hover:brightness-110`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : newStatus === "aprovado" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ─── OrderRow ─────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  token,
  onEdit,
  onDelete,
  onStatusUpdate,
}: {
  order: SimulatorOrder;
  token: string;
  onEdit: (o: SimulatorOrder) => void;
  onDelete: (o: SimulatorOrder) => void;
  onStatusUpdate: (id: number, status: OrderStatus) => void;
}) {
  const estimateDisplay =
    formatEuro(order.estimateTotal) ??
    (order.estimateMin
      ? `${formatEuro(order.estimateMin) ?? "—"} – ${formatEuro(order.estimateMax) ?? "—"}`
      : null);

  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] px-4 py-4 hover:border-cyan-300/20 hover:bg-white/[0.05] transition">
      <div className="flex flex-wrap items-start gap-3">
        {/* Informacao principal */}
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-cyan-400/70">#{order.id}</span>
            <StatusBadge status={order.status} />
            {order.urgency === "urgente" && (
              <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                Urgente
              </span>
            )}
          </div>
          <p className="truncate text-sm font-semibold text-white">
            {order.serviceType ?? "Servico nao especificado"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {order.contactName && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <User className="h-3 w-3" />
                {order.contactName}
              </span>
            )}
            {order.contactPhone && (
              <a
                href={`tel:${order.contactPhone}`}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300 transition"
              >
                <Phone className="h-3 w-3" />
                {order.contactPhone}
              </a>
            )}
            {(order.address || order.city) && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="max-w-[200px] truncate">{order.address ?? order.city}</span>
              </span>
            )}
          </div>
        </div>

        {/* Preco / estimativa */}
        <div className="flex-shrink-0 text-right">
          {order.precoFinal ? (
            <>
              <p className="text-xs text-slate-500">Preco final</p>
              <p className="text-base font-bold text-emerald-400">
                {formatEuro(order.precoFinal)}
              </p>
            </>
          ) : estimateDisplay ? (
            <>
              <p className="text-xs text-slate-500">Estimativa</p>
              <p className="text-sm font-semibold text-cyan-300">{estimateDisplay}</p>
            </>
          ) : null}
          <p className="mt-1 text-[11px] text-slate-600">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      {/* Acoes */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
        {order.status === "pendente" && (
          <>
            <QuickStatusButton
              orderId={order.id}
              newStatus="aprovado"
              token={token}
              onUpdated={onStatusUpdate}
            />
            <QuickStatusButton
              orderId={order.id}
              newStatus="rejeitado"
              token={token}
              onUpdated={onStatusUpdate}
            />
            <span className="h-4 w-px bg-white/10" />
          </>
        )}
        {order.contactPhone && (
          <a
            href={`https://wa.me/${order.contactPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
              `Ola ${order.contactName ?? "cliente"}, a CLYON esta a contactar relativamente ao seu pedido de ${order.serviceType ?? "servico"}.`
            )}`}
            target="_blank"
            rel="noreferrer"
            title="WhatsApp"
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 transition hover:brightness-110"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onEdit(order)}
          title="Editar"
          className="flex h-7 w-7 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300 transition hover:brightness-110"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(order)}
          title="Apagar"
          className="flex h-7 w-7 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-400 transition hover:brightness-110"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {order.notasInternas && (
          <span className="ml-auto max-w-[200px] truncate text-[11px] italic text-slate-500">
            {order.notasInternas}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── PedidosSection (main) ────────────────────────────────────────────────────

export default function PedidosSection({ token }: { token: string }) {
  const [orders, setOrders] = useState<SimulatorOrder[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "todos">("todos");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [editingOrder, setEditingOrder] = useState<SimulatorOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<SimulatorOrder | null>(null);

  const loadOrders = useCallback(
    async (status: OrderStatus | "todos", q: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ status, search: q });
        const res = await fetch(`/api/admin/pedidos?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao carregar pedidos");
        setOrders(data.orders ?? []);
        setCounts(data.counts ?? {});
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void loadOrders(statusFilter, search);
  }, [loadOrders, statusFilter, search]);

  function handleStatusUpdate(id: number, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    void loadOrders(statusFilter, search);
  }

  function handleSaved(updated: SimulatorOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setEditingOrder(null);
    void loadOrders(statusFilter, search);
  }

  function handleDeleted(id: number) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setDeletingOrder(null);
    void loadOrders(statusFilter, search);
  }

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalPendentes = counts.pendente ?? 0;

  const filterTabs: Array<{ id: OrderStatus | "todos"; label: string }> = [
    { id: "todos", label: `Todos (${totalCount})` },
    { id: "pendente", label: `Pendentes (${counts.pendente ?? 0})` },
    { id: "aprovado", label: `Aprovados (${counts.aprovado ?? 0})` },
    { id: "em_execucao", label: `Em execucao (${counts.em_execucao ?? 0})` },
    { id: "concluido", label: `Concluidos (${counts.concluido ?? 0})` },
    { id: "rejeitado", label: `Rejeitados (${counts.rejeitado ?? 0})` },
    { id: "cancelado", label: `Cancelados (${counts.cancelado ?? 0})` },
  ];

  return (
    <>
      <section className="space-y-4 rounded-[28px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(9,25,40,0.94)_0%,rgba(11,30,47,0.92)_100%)] p-5 shadow-[0_20px_70px_rgba(3,10,18,0.22)]">
        {/* Cabecalho */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Gestao de pedidos
            </p>
            <h2 className="mt-2 text-[1.85rem] font-semibold text-white">
              Pedidos do simulador
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-300">
              Pedidos enviados pelos clientes. Aprove, edite, atribua preco final ou elimine cada pedido.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {totalPendentes > 0 && (
              <span className="flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-slate-950">
                  {totalPendentes}
                </span>
                Aguardam aprovacao
              </span>
            )}
            <button
              type="button"
              onClick={() => loadOrders(statusFilter, search)}
              title="Actualizar"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-white/[0.04] text-cyan-300 hover:bg-white/[0.08] transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filtros de status */}
        <div className="flex flex-wrap gap-2 rounded-[20px] border border-white/10 bg-white/[0.02] p-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-[14px] px-3.5 py-2 text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Barra de pesquisa */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(searchInput);
            }}
            placeholder="Pesquisar por nome, telefone, morada ou descricao... (Enter)"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-5 py-4 text-sm text-red-300">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.04]">
              <ClipboardList className="h-7 w-7 text-slate-500" />
            </div>
            <p className="text-base font-semibold text-slate-300">Sem pedidos</p>
            <p className="mt-1 text-sm text-slate-500">
              {statusFilter === "todos"
                ? "Ainda nao foram submetidos pedidos pelo simulador."
                : `Nao ha pedidos com o estado "${STATUS_CONFIG[statusFilter as OrderStatus]?.label ?? statusFilter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                token={token}
                onEdit={setEditingOrder}
                onDelete={setDeletingOrder}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
          </div>
        )}
      </section>

      {editingOrder && (
        <EditModal
          order={editingOrder}
          token={token}
          onClose={() => setEditingOrder(null)}
          onSaved={handleSaved}
        />
      )}
      {deletingOrder && (
        <DeleteConfirmModal
          order={deletingOrder}
          token={token}
          onClose={() => setDeletingOrder(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
