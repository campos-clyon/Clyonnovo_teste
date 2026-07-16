"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Order = {
  id: number;
  serviceType?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  estimateMin?: string | null;
  estimateMax?: string | null;
  estimateTotal?: string | null;
  precoFinal?: string | null;
  precoFinalIva?: string | null;
  status: string;
  priority?: string | null;
  notasInternas?: string | null;
  mensagemCliente?: string | null;
  createdAt: string;
};

const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis: "Recolha de móveis",
  recolha_monos: "Recolha de monos",
  recolha_entulho: "Recolha de entulho",
  esvaziamento_casa: "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca: "Mudança",
  outro: "Outro",
};

const ELEVATOR_LABELS: Record<string, string> = {
  yes: "Sim (normal)",
  small: "Sim (pequeno/monta-cargas)",
  no: "Não",
  unknown: "Desconhecido",
};

export default function AprovarPedidoClient() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { ready, authHeader } = useAdminAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval form state
  const [precoFinal, setPrecoFinal] = useState("");
  const [precoFinalIva, setPrecoFinalIva] = useState("");
  const [mensagemCliente, setMensagemCliente] = useState("");
  const [notasInternas, setNotasInternas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Auto-fill IVA when precoFinal changes
  useEffect(() => {
    const val = parseFloat(precoFinal.replace(",", "."));
    if (!isNaN(val)) {
      setPrecoFinalIva((val * 1.23).toFixed(2));
    } else {
      setPrecoFinalIva("");
    }
  }, [precoFinal]);

  // Fetch order once auth is ready
  useEffect(() => {
    if (!ready) return;
    fetch(`/api/admin/pedidos/by-token/${token}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        const o: Order = data.order;
        setOrder(o);
        // Pre-fill form from existing values
        setPrecoFinal(o.precoFinal ?? o.estimateTotal ?? "");
        setPrecoFinalIva(o.precoFinalIva ?? "");
        setMensagemCliente(o.mensagemCliente ?? "");
        setNotasInternas(o.notasInternas ?? "");
      })
      .catch(() => setError("Erro ao carregar pedido."))
      .finally(() => setLoading(false));
  }, [ready, token, authHeader]);

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader },
        body: JSON.stringify({ precoFinal, precoFinalIva, mensagemCliente, notasInternas }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao aprovar pedido.");
        return;
      }
      setDone(true);
    } catch {
      setError("Erro de rede ao aprovar pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628] p-6">
        <div className="w-full max-w-md rounded-xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-300">{error}</p>
          <Link href="/admin/pedidos" className="mt-6 inline-block text-sm text-white/60 underline hover:text-white">
            Voltar aos pedidos
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628] p-6">
        <div className="w-full max-w-md rounded-xl border border-green-500/20 bg-green-500/10 p-8 text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-20" />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/30">
              <svg className="h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="mb-1 text-xl font-semibold text-white">Pedido aprovado</h2>
          <p className="text-sm text-white/60">
            O orçamento foi aprovado{order?.contactEmail ? " e o e-mail foi enviado ao cliente." : "."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href={`/admin/pedidos/${order?.id}`}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              Ver pedido #{order?.id}
            </Link>
            <Link href="/admin/pedidos" className="text-sm text-white/50 hover:text-white">
              Todos os pedidos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const serviceLabel = order ? (SERVICE_LABELS[order.serviceType ?? ""] ?? order.serviceType ?? "—") : "—";
  const isAlreadyApproved = order?.status === "aprovado" || order?.status === "confirmado" || order?.status === "em_execucao" || order?.status === "concluido";

  return (
    <div className="min-h-screen bg-[#0a1628] pb-16 pt-8">
      <div className="mx-auto max-w-2xl px-4">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin/pedidos" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/40">CLYON Admin</p>
            <h1 className="text-lg font-semibold text-white">Aprovar Pedido #{order?.id}</h1>
          </div>
        </div>

        {isAlreadyApproved && (
          <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            Este pedido já está com o estado <strong>{order?.status}</strong>. Podes continuar a editar e reenviar o orçamento.
          </div>
        )}

        {/* Order Details Card */}
        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">Detalhes do Pedido</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-white/40">Serviço</dt>
              <dd className="font-medium text-white">{serviceLabel}</dd>
            </div>
            <div>
              <dt className="text-white/40">Data</dt>
              <dd className="text-white/80">
                {order?.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-PT") : "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-white/40">Morada</dt>
              <dd className="text-white/80">{order?.address ?? "—"}{order?.postalCode ? ` — ${order.postalCode}` : ""}</dd>
            </div>
            {order?.floor && (
              <div>
                <dt className="text-white/40">Andar</dt>
                <dd className="text-white/80">{order.floor}</dd>
              </div>
            )}
            {order?.hasElevator && (
              <div>
                <dt className="text-white/40">Elevador</dt>
                <dd className="text-white/80">{ELEVATOR_LABELS[order.hasElevator] ?? order.hasElevator}</dd>
              </div>
            )}
            <div>
              <dt className="text-white/40">Cliente</dt>
              <dd className="font-medium text-white">{order?.contactName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-white/40">Telefone</dt>
              <dd className="text-white/80">{order?.contactPhone ?? "—"}</dd>
            </div>
            {order?.contactEmail && (
              <div className="col-span-2">
                <dt className="text-white/40">E-mail</dt>
                <dd className="text-white/80">{order.contactEmail}</dd>
              </div>
            )}
            {order?.description && (
              <div className="col-span-2">
                <dt className="text-white/40">Descrição</dt>
                <dd className="text-white/70">{order.description}</dd>
              </div>
            )}
          </dl>

          {/* Estimate row */}
          {(order?.estimateMin || order?.estimateTotal) && (
            <div className="mt-4 rounded-lg bg-white/5 px-4 py-3">
              <p className="mb-1 text-xs text-white/40">Estimativa automática</p>
              <p className="text-base font-semibold text-white">
                {order.estimateMin && order.estimateMax
                  ? `${Number(order.estimateMin).toFixed(0)} € — ${Number(order.estimateMax).toFixed(0)} € (c/IVA)`
                  : `${Number(order.estimateTotal).toFixed(0)} € (c/IVA)`}
              </p>
            </div>
          )}
        </div>

        {/* Approval Form */}
        <form onSubmit={handleApprove} className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-white/40">Definir Orçamento</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-white/50">Preço final (s/IVA) *</label>
              <div className="flex items-center rounded-lg border border-white/10 bg-white/5 px-3">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={precoFinal}
                  onChange={(e) => setPrecoFinal(e.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm text-white placeholder-white/20 outline-none"
                  required
                />
                <span className="text-sm text-white/30">€</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">Preço final (c/IVA 23%)</label>
              <div className="flex items-center rounded-lg border border-white/10 bg-white/5 px-3">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={precoFinalIva}
                  onChange={(e) => setPrecoFinalIva(e.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm text-white placeholder-white/20 outline-none"
                />
                <span className="text-sm text-white/30">€</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-white/50">
              Mensagem para o cliente
              {!order?.contactEmail && <span className="ml-2 text-yellow-400/70">(sem e-mail — não será enviado)</span>}
            </label>
            <textarea
              value={mensagemCliente}
              onChange={(e) => setMensagemCliente(e.target.value)}
              rows={3}
              placeholder="Ex: O orçamento inclui transporte e mão de obra. Pagamento no dia do serviço."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/30"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-white/50">Notas internas (não visíveis ao cliente)</label>
            <textarea
              value={notasInternas}
              onChange={(e) => setNotasInternas(e.target.value)}
              rows={2}
              placeholder="Ex: Confirmar disponibilidade de equipa. Possível acesso difícil."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/30"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !precoFinal}
            className="mt-6 w-full rounded-lg bg-[#26C6DA] py-3 text-sm font-semibold text-[#0a1628] transition hover:bg-[#00bcd4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0a1628]/30 border-t-[#0a1628]" />
                A aprovar...
              </span>
            ) : (
              order?.contactEmail ? "Aprovar e enviar orçamento por e-mail" : "Aprovar pedido"
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
