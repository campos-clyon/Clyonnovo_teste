"use client";

import { useState } from "react";

const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis:            "Recolha de móveis",
  recolha_monos:             "Recolha de monos",
  recolha_entulho:           "Recolha de entulho",
  esvaziamento_casa:         "Esvaziamento de casa",
  esvaziamento_apartamento:  "Esvaziamento de apartamento",
  mudanca:                   "Mudança",
  outro:                     "Outro serviço",
};

function fmt(iso: string | null): string {
  if (!iso) return "A definir";
  try {
    return new Date(iso).toLocaleDateString("pt-PT", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

interface OrderData {
  id: number;
  serviceType: string | null;
  address: string | null;
  city: string | null;
  description: string | null;
  precoFinalIva: number | null;
  dataAgendada: string | null;
  mensagemCliente: string | null;
  status: string;
  confirmadoPeloCliente: boolean;
  canceladoPeloCliente: boolean;
}

export default function OrcamentoClient({
  token,
  order: initial,
}: {
  token: string;
  order: OrderData;
}) {
  const [order, setOrder] = useState(initial);
  const [loading, setLoading] = useState<"confirmar" | "cancelar" | null>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const servico = SERVICE_LABELS[order.serviceType ?? ""] ?? order.serviceType ?? "Serviço";
  const preco   = order.precoFinalIva != null
    ? order.precoFinalIva.toFixed(2).replace(".", ",") + " €"
    : "Em análise";

  async function doAction(action: "confirmar" | "cancelar") {
    setLoading(action);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orcamento/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Ocorreu um erro. Por favor tente novamente.");
      } else {
        setOrder((prev) => ({
          ...prev,
          confirmadoPeloCliente: action === "confirmar" ? true : prev.confirmadoPeloCliente,
          canceladoPeloCliente:  action === "cancelar"  ? true : prev.canceladoPeloCliente,
          status: action === "confirmar" ? "confirmado" : "cancelado",
        }));
      }
    } catch {
      setErrorMsg("Erro de rede. Por favor tente novamente.");
    } finally {
      setLoading(null);
      setConfirmandoCancelar(false);
    }
  }

  // --- Estado: já confirmado ---
  if (order.confirmadoPeloCliente || order.status === "confirmado") {
    return (
      <div className="text-center py-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#06D6A0]/15">
          <svg className="h-8 w-8 text-[#06D6A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Orçamento confirmado!</h2>
        <p className="text-slate-600 max-w-sm mx-auto leading-relaxed">
          Obrigado pela sua confirmação. A equipa CLYON irá entrar em contacto para dar seguimento ao seu pedido.
        </p>
        <p className="mt-4 text-sm text-slate-400">Pedido #{order.id}</p>
      </div>
    );
  }

  // --- Estado: cancelado ---
  if (order.canceladoPeloCliente || order.status === "cancelado") {
    return (
      <div className="text-center py-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Pedido cancelado</h2>
        <p className="text-slate-600 max-w-sm mx-auto leading-relaxed">
          O seu pedido foi cancelado. Se tiver alguma dúvida, contacte-nos directamente.
        </p>
        <p className="mt-4 text-sm text-slate-400">Pedido #{order.id}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Mensagem personalizada da equipa */}
      {order.mensagemCliente && (
        <div className="mb-6 rounded-xl bg-[#00B4D8]/10 border border-[#00B4D8]/30 px-5 py-4">
          <p className="text-sm font-semibold text-[#0077B6] mb-1">Mensagem da equipa CLYON</p>
          <p className="text-sm text-slate-700 leading-relaxed">{order.mensagemCliente}</p>
        </div>
      )}

      {/* Card de resumo */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-8">
        {/* Header do card */}
        <div className="bg-[#0077B6] px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#90e0ef] mb-1">
            Pedido #{order.id}
          </p>
          <p className="text-xl font-bold text-white">{servico}</p>
        </div>

        {/* Detalhes */}
        <div className="px-6 py-5 space-y-3">
          {order.address && (
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0077B6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Morada</p>
                <p className="text-sm text-slate-800">{order.address}</p>
              </div>
            </div>
          )}
          {order.description && (
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0077B6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Descrição</p>
                <p className="text-sm text-slate-800 leading-relaxed">{order.description}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0077B6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Data prevista</p>
              <p className="text-sm text-slate-800">{fmt(order.dataAgendada)}</p>
            </div>
          </div>
        </div>

        {/* Preço destaque */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Total aprovado (c/ IVA)</p>
            <p className="text-3xl font-bold text-[#00B4D8] mt-1">{preco}</p>
          </div>
          <div className="rounded-full bg-[#00B4D8]/10 px-3 py-1">
            <p className="text-xs font-semibold text-[#0077B6]">IVA incluído</p>
          </div>
        </div>
      </div>

      {/* Erro */}
      {errorMsg && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Modal de confirmação de cancelamento */}
      {confirmandoCancelar ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 mb-4">
          <p className="text-sm font-semibold text-red-700 mb-2">Confirmar cancelamento</p>
          <p className="text-sm text-red-600 mb-4 leading-relaxed">
            Tem a certeza que quer cancelar este pedido? Esta acção não pode ser desfeita. Se precisar de ajuda, contacte-nos primeiro.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => doAction("cancelar")}
              disabled={loading === "cancelar"}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {loading === "cancelar" ? "A cancelar..." : "Cancelar mesmo assim"}
            </button>
            <button
              onClick={() => setConfirmandoCancelar(false)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Voltar atrás
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => doAction("confirmar")}
            disabled={loading !== null}
            className="w-full rounded-xl bg-[#06D6A0] px-6 py-4 text-base font-bold text-white hover:bg-[#05c493] disabled:opacity-60 transition-colors shadow-sm"
          >
            {loading === "confirmar" ? "A confirmar..." : "Confirmar orçamento"}
          </button>
          <button
            onClick={() => setConfirmandoCancelar(true)}
            disabled={loading !== null}
            className="w-full rounded-xl border-2 border-red-300 bg-white px-6 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
          >
            Cancelar pedido
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400 leading-relaxed">
        Tem dúvidas? Contacte-nos antes de confirmar ou cancelar.
      </p>
    </div>
  );
}
