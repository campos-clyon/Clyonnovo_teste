"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppClyonShell from "../../AppClyonShell";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type AppStatus =
  | "draft" | "received" | "in_review" | "awaiting_deposit"
  | "assignment_pending" | "partner_selected" | "confirmed"
  | "in_route" | "arrived" | "in_execution" | "extra_review_requested"
  | "awaiting_confirmation" | "completed" | "in_dispute" | "canceled" | "rejected";

type OrderDetail = {
  id: string;
  status: AppStatus;
  urgency: string;
  details: string | null;
  notes: string | null;
  address_line: string | null;
  city: string | null;
  region: string | null;
  category_slug: string | null;
  estimated_price: number | null;
  scheduled_for: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  category_name: string | null;
  category_icon: string | null;
};

type OpsEntry = {
  id: string;
  action_type: string;
  status_from: string | null;
  status_to: string | null;
  reason: string | null;
  note: string | null;
  colab_nome: string;
  created_at: string;
};

const STATUS_CFG: Record<AppStatus, { label: string; color: string }> = {
  draft:                  { label: "Rascunho",            color: "text-slate-400" },
  received:               { label: "Recebido",            color: "text-amber-400" },
  in_review:              { label: "Em análise",          color: "text-amber-400" },
  awaiting_deposit:       { label: "Aguarda depósito",    color: "text-amber-400" },
  assignment_pending:     { label: "A atribuir",          color: "text-amber-400" },
  partner_selected:       { label: "Parceiro atribuído",  color: "text-amber-400" },
  confirmed:              { label: "Confirmado",          color: "text-sky-400" },
  in_route:               { label: "A caminho",           color: "text-sky-400" },
  arrived:                { label: "Chegou",              color: "text-sky-400" },
  in_execution:           { label: "Em execução",         color: "text-sky-400" },
  extra_review_requested: { label: "Revisão extra",       color: "text-sky-400" },
  awaiting_confirmation:  { label: "Aguarda confirmação", color: "text-sky-400" },
  completed:              { label: "Concluído",           color: "text-emerald-400" },
  in_dispute:             { label: "Em disputa",          color: "text-red-400" },
  canceled:               { label: "Cancelado",           color: "text-red-400" },
  rejected:               { label: "Rejeitado",           color: "text-red-400" },
};

const VALID_STATUSES = Object.keys(STATUS_CFG) as AppStatus[];
const CANCEL_STATUSES = new Set(["canceled", "rejected"]);

const LABEL = "text-[10px] uppercase tracking-wider text-slate-500 block mb-1";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon",
  });
}

export default function PedidoDetalheClient({ id }: { id: string }) {
  const { authHeader, ready } = useAdminAuth({ skip: false });
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [ops, setOps] = useState<OpsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Campos editáveis (apenas operacionais — dados originais do cliente são imutáveis)
  const [status, setStatus] = useState<AppStatus>("received");
  const [urgency, setUrgency] = useState("normal");
  const [price, setPrice] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [reason, setReason] = useState("");

  const needsReason = CANCEL_STATUSES.has(status);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const [orderRes, opsRes] = await Promise.all([
        fetch(`/api/admin/app-pedidos/${id}`, { headers: authHeader }),
        fetch(`/api/admin/app-clyon/pedidos/${id}/ops`, { headers: authHeader }),
      ]);

      if (orderRes.status === 404) { setError("Pedido não encontrado."); return; }
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setError(orderData.error ?? "Erro ao carregar."); return; }

      const opsData = await opsRes.json();
      const row = orderData.order;

      const enriched: OrderDetail = {
        id: row.id,
        status: row.status,
        urgency: row.urgency ?? "normal",
        details: row.details ?? null,
        notes: row.notes ?? null,
        address_line: row.address_line ?? null,
        city: row.city ?? null,
        region: row.region ?? null,
        category_slug: row.category_slug ?? null,
        estimated_price: row.estimated_price ?? null,
        scheduled_for: row.scheduled_for ?? null,
        photos: Array.isArray(row.photos) ? row.photos.filter((p: unknown) => typeof p === "string") : [],
        created_at: row.created_at,
        updated_at: row.updated_at ?? row.created_at,
        client_name: row.client_name ?? null,
        client_email: row.client_email ?? null,
        client_phone: row.client_phone ?? null,
        category_name: row.category_name ?? row.category_slug ?? null,
        category_icon: row.category_icon ?? null,
      };
      setOrder(enriched);
      setOps(opsData.ops ?? []);
      setStatus(enriched.status);
      setUrgency(enriched.urgency);
      setPrice(enriched.estimated_price != null ? String(enriched.estimated_price) : "");
      setScheduledFor(enriched.scheduled_for ? String(enriched.scheduled_for).slice(0, 16) : "");
      setAdminNote("");
      setReason("");
    } catch {
      setError("Erro de ligação.");
    } finally {
      setLoading(false);
    }
  }, [ready, authHeader, id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!order) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    const payload: Record<string, unknown> = {};
    if (status !== order.status) payload.status = status;
    if (urgency !== order.urgency) payload.urgency = urgency;
    const origPrice = order.estimated_price != null ? String(order.estimated_price) : "";
    if (price !== origPrice) payload.estimated_price = price === "" ? null : Number(price);
    const origDate = order.scheduled_for ? String(order.scheduled_for).slice(0, 16) : "";
    if (scheduledFor !== origDate) payload.scheduled_for = scheduledFor || null;
    if (adminNote.trim()) payload.admin_note = adminNote.trim();
    if (reason.trim()) payload.reason = reason.trim();

    if (Object.keys(payload).length === 0) {
      setSaveError("Nenhuma alteração detectada.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/app-pedidos/${id}`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Erro ao guardar."); return; }
      setSaveOk(true);
      await load();
    } catch {
      setSaveError("Erro de ligação.");
    } finally {
      setSaving(false);
    }
  }

  const INP = "mt-1 h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-cyan-400";
  const TA  = "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 resize-none";

  return (
    <AppClyonShell>
      <div className="px-5 py-6 md:px-8">
        {/* Breadcrumb */}
        <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/admin/app-clyon/pedidos" className="hover:text-cyan-400">
            ← Pedidos
          </Link>
          {order && (
            <>
              <span>/</span>
              <span className="font-mono text-slate-600">#{String(order.id).slice(0, 8)}</span>
            </>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="h-6 w-6 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {order && (
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            {/* Coluna principal */}
            <div className="space-y-5">

              {/* 1. Resumo */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-slate-600">#{order.id.slice(0, 8)}</p>
                    <h2 className="mt-1 text-base font-bold text-white">
                      {order.details || order.category_name || "Pedido"}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`text-xs font-semibold ${STATUS_CFG[order.status]?.color ?? "text-slate-400"}`}>
                        {STATUS_CFG[order.status]?.label ?? order.status}
                      </span>
                      {order.urgency === "urgent" && (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                          URGENTE
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-500">
                    <p>Criado: {fmt(order.created_at)}</p>
                    <p>Actualizado: {fmt(order.updated_at)}</p>
                  </div>
                </div>
              </div>

              {/* 2. Pedido original do cliente — só leitura */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pedido original do cliente
                  <span className="ml-2 font-normal normal-case text-slate-600">(só leitura)</span>
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className={LABEL}>Título / detalhes</span>
                    <p className="text-sm text-white">{order.details || "—"}</p>
                  </div>
                  <div>
                    <span className={LABEL}>Categoria</span>
                    <p className="text-sm text-white">
                      {order.category_icon && <span className="mr-1">{order.category_icon}</span>}
                      {order.category_name || order.category_slug || "—"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={LABEL}>Descrição</span>
                    <p className="whitespace-pre-wrap text-sm text-slate-300">{order.notes || "—"}</p>
                  </div>
                  <div>
                    <span className={LABEL}>Morada</span>
                    <p className="text-sm text-white">{order.address_line || "—"}</p>
                    <p className="text-xs text-slate-500">{[order.city, order.region].filter(Boolean).join(", ")}</p>
                  </div>
                  <div>
                    <span className={LABEL}>Data preferida</span>
                    <p className="text-sm text-white">
                      {order.scheduled_for ? fmt(String(order.scheduled_for)) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className={LABEL}>Orçamento indicativo</span>
                    <p className="text-sm text-white">
                      {order.estimated_price != null
                        ? new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(order.estimated_price)
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Fotografias */}
              {order.photos.length > 0 && (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Fotografias</h3>
                  <div className="flex flex-wrap gap-2">
                    {order.photos.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setLightbox(url)}
                        className="h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-cyan-400/40"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Foto ${i + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Histórico de operações */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <div className="border-b border-white/[0.05] px-5 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Histórico de operações</h3>
                </div>
                {ops.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-slate-600">Sem operações registadas.</p>
                ) : (
                  <div>
                    {ops.map((op) => (
                      <div key={op.id} className="border-b border-white/[0.03] px-5 py-3 last:border-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {op.action_type === "status_change" && (
                              <p className="text-sm text-white">
                                <span className="text-slate-500">
                                  {STATUS_CFG[op.status_from as AppStatus]?.label ?? op.status_from}
                                </span>
                                {" → "}
                                <span className={STATUS_CFG[op.status_to as AppStatus]?.color ?? "text-white"}>
                                  {STATUS_CFG[op.status_to as AppStatus]?.label ?? op.status_to}
                                </span>
                              </p>
                            )}
                            {op.action_type === "update" && (
                              <p className="text-sm text-slate-400">Campos operacionais actualizados</p>
                            )}
                            {op.action_type === "note" && (
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Nota</p>
                            )}
                            {op.reason && (
                              <p className="mt-0.5 text-xs text-amber-300/80">Motivo: {op.reason}</p>
                            )}
                            {op.note && (
                              <p className="mt-0.5 text-sm text-slate-300">{op.note}</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-[10px] text-slate-500">{op.colab_nome}</p>
                            <p className="text-[10px] text-slate-700">{fmt(op.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Coluna lateral — operação */}
            <div className="space-y-5">

              {/* Cliente */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Cliente</h3>
                <p className="text-sm font-medium text-white">{order.client_name || "—"}</p>
                {order.client_phone && (
                  <a
                    href={`tel:${order.client_phone}`}
                    className="mt-2 flex items-center gap-2 text-xs text-cyan-400 hover:underline"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {order.client_phone}
                  </a>
                )}
                {order.client_email && (
                  <a
                    href={`mailto:${order.client_email}`}
                    className="mt-1 flex items-center gap-2 text-xs text-cyan-400 hover:underline"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {order.client_email}
                  </a>
                )}
              </div>

              {/* Campos de operação — apenas operacionais, dados do cliente imutáveis */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Operação</h3>
                <div className="space-y-3">
                  <div>
                    <label className={LABEL}>Estado</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as AppStatus)}
                      className={INP}
                    >
                      {VALID_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-[#0F1729]">
                          {STATUS_CFG[s].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {needsReason && (
                    <div>
                      <label className={LABEL}>Motivo (obrigatório)</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder="Razão do cancelamento ou rejeição..."
                        className={TA}
                      />
                    </div>
                  )}

                  <div>
                    <label className={LABEL}>Urgência</label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value)}
                      className={INP}
                    >
                      <option value="normal" className="bg-[#0F1729]">Normal</option>
                      <option value="urgent" className="bg-[#0F1729]">Urgente</option>
                      <option value="flexible" className="bg-[#0F1729]">Flexível</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL}>Orçamento confirmado (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className={INP}
                    />
                  </div>

                  <div>
                    <label className={LABEL}>Data/hora agendada</label>
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className={INP}
                    />
                  </div>

                  <div>
                    <label className={LABEL}>Nota interna</label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                      placeholder="Nota registada no histórico de operações..."
                      className={TA}
                    />
                    <p className="mt-1 text-[10px] text-slate-600">Ficará registada no histórico e não altera os dados do cliente.</p>
                  </div>
                </div>

                {saveError && (
                  <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {saveError}
                  </div>
                )}
                {saveOk && (
                  <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    Guardado com sucesso.
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-4 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                >
                  {saving ? "A guardar..." : "Guardar alterações"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox de fotos */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white"
          >
            Fechar
          </button>
        </div>
      )}
    </AppClyonShell>
  );
}
