"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface FormData {
  serviceType: string;
  description: string;
  volume: string;
  heavyItems: string[];
  needsDismantling: string;
  files: File[];
  address: {
    formattedAddress: string;
    city: string;
    postalCode: string;
    lat?: number;
    lng?: number;
    placeId?: string;
  };
  floor: string;
  hasElevator: string;
  parkingDistance: string;
  difficultAccess: string;
  accessNotes: string;
  urgency: string;
  preferredDate: string;
  preferredTime: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    contactPreference: string;
  };
}

interface AnalysisResult {
  ok: boolean;
  status: "estimated" | "needs_more_info" | "onsite_required";
  estimatedPriceWithoutVat: number | null;
  vatAmount: number | null;
  estimatedPriceWithVat: number | null;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  summary: string;
  assumptions: string[];
  missingFields: string[];
  customerMessage: string;
  internalNotes: string[];
}

const DIFFICULTY_COLORS: Record<number, string> = {
  1: "text-green-600 bg-green-50",
  2: "text-blue-600 bg-blue-50",
  3: "text-amber-600 bg-amber-50",
  4: "text-orange-600 bg-orange-50",
  5: "text-red-600 bg-red-50",
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Muito Fácil",
  2: "Fácil",
  3: "Médio",
  4: "Difícil",
  5: "Muito Difícil",
};

export default function SimulatorReviewCard({
  form,
  analysis,
  onConfirm,
  onEdit,
}: {
  form: FormData;
  analysis: AnalysisResult;
  onConfirm: (orderId: number) => void;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);

    try {

      const res = await fetch("/api/simulador/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: {
            serviceType: form.serviceType,
            description: form.description,
            receiver: {
              name: form.customer.name,
              phone: form.customer.phone,
              email: form.customer.email,
            },
            address: form.address,
            floor: form.floor,
            hasElevator: form.hasElevator,
            parkingDistance: form.parkingDistance,
            files: form.files,
          },
          estimate: {
            status: analysis.status,
            estimatedPriceWithoutVat: analysis.estimatedPriceWithoutVat,
            vatAmount: analysis.vatAmount,
            estimatedPriceWithVat: analysis.estimatedPriceWithVat,
            difficultyLevel: analysis.difficultyLevel,
            summary: analysis.summary,
            customerMessage: analysis.customerMessage,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao guardar pedido");
      }

      const result = await res.json();
      onConfirm(result.id);
    } catch (err: any) {
      console.error("[v0] SimulatorReviewCard: ❌ Error:", err);
      setError(err.message || "Erro ao confirmar pedido");
    } finally {
      setConfirming(false);
    }
  };

  const diffColor = DIFFICULTY_COLORS[analysis.difficultyLevel];
  const diffLabel = DIFFICULTY_LABELS[analysis.difficultyLevel];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] to-[#EFF8FF] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#102033] text-balance">
            Análise do Seu Pedido
          </h1>
          <p className="text-[#64748B] mt-3">
            Verifique os detalhes antes de confirmar
          </p>
        </div>

        {/* Status card */}
        <div className={`rounded-xl shadow-sm border p-6 mb-6 ${
          analysis.status === "estimated" 
            ? "bg-green-50 border-green-200"
            : analysis.status === "onsite_required"
            ? "bg-blue-50 border-blue-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-start gap-3">
            {analysis.status === "estimated" && (
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            )}
            {analysis.status === "onsite_required" && (
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            )}
            {analysis.status === "needs_more_info" && (
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`font-semibold mb-1 ${
                analysis.status === "estimated" 
                  ? "text-green-900"
                  : analysis.status === "onsite_required"
                  ? "text-blue-900"
                  : "text-amber-900"
              }`}>
                {analysis.status === "estimated" && "Pedido Analisado"}
                {analysis.status === "onsite_required" && "Análise Presencial Recomendada"}
                {analysis.status === "needs_more_info" && "Informações Incompletas"}
              </p>
              <p className={`text-sm ${
                analysis.status === "estimated" 
                  ? "text-green-800"
                  : analysis.status === "onsite_required"
                  ? "text-blue-800"
                  : "text-amber-800"
              }`}>
                {analysis.customerMessage}
              </p>
            </div>
          </div>
        </div>

        {/* Price breakdown */}
        {analysis.estimatedPriceWithVat !== null && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <h2 className="text-lg font-semibold text-[#102033] mb-4">
              Orçamento Estimado
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Subtotal (sem IVA)</span>
                <span className="font-medium text-[#102033]">
                  {analysis.estimatedPriceWithoutVat?.toFixed(2)}€
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">IVA (23%)</span>
                <span className="font-medium text-[#102033]">
                  {analysis.vatAmount?.toFixed(2)}€
                </span>
              </div>
              <div className="border-t border-[#E2E8F0] pt-3 flex justify-between">
                <span className="font-semibold text-[#102033]">Total</span>
                <span className="text-xl font-bold text-[#0487D9]">
                  {analysis.estimatedPriceWithVat?.toFixed(2)}€
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Difficulty level */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#102033] mb-4">
            Complexidade do Pedido
          </h2>
          <div className={`inline-block px-4 py-2 rounded-lg font-semibold ${diffColor}`}>
            {diffLabel} (Nível {analysis.difficultyLevel})
          </div>
        </div>

        {/* Summary and assumptions */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#102033] mb-3">Resumo</h2>
          <p className="text-[#475569] mb-4">{analysis.summary}</p>

          {analysis.assumptions.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[#64748B] mb-2">Pressupostos:</p>
              <ul className="text-sm text-[#64748B] space-y-1 list-disc list-inside">
                {analysis.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Order review */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#102033] mb-4">
            Detalhes do Pedido
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-[#E2E8F0] pb-3">
              <span className="text-[#64748B]">Serviço</span>
              <span className="font-medium text-[#102033]">{form.serviceType}</span>
            </div>
            <div className="flex justify-between border-b border-[#E2E8F0] pb-3">
              <span className="text-[#64748B]">Morada</span>
              <span className="font-medium text-[#102033]">{form.address.formattedAddress}</span>
            </div>
            <div className="flex justify-between border-b border-[#E2E8F0] pb-3">
              <span className="text-[#64748B]">Andar</span>
              <span className="font-medium text-[#102033]">{form.floor}</span>
            </div>
            <div className="flex justify-between border-b border-[#E2E8F0] pb-3">
              <span className="text-[#64748B]">Elevador</span>
              <span className="font-medium text-[#102033]">{form.hasElevator}</span>
            </div>
            <div className="flex justify-between border-b border-[#E2E8F0] pb-3">
              <span className="text-[#64748B]">Estacionamento</span>
              <span className="font-medium text-[#102033]">{form.parkingDistance}</span>
            </div>
            <div className="flex justify-between border-b border-[#E2E8F0] pb-3">
              <span className="text-[#64748B]">Cliente</span>
              <span className="font-medium text-[#102033]">{form.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Contacto</span>
              <span className="font-medium text-[#102033]">{form.customer.phone}</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full py-3 px-4 rounded-lg bg-[#0487D9] hover:bg-[#036BB0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {confirming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                A enviar pedido...
              </>
            ) : (
              "Enviar pedido para análise"
            )}
          </button>
          <button
            onClick={onEdit}
            disabled={confirming}
            className="w-full py-3 px-4 rounded-lg border border-[#E2E8F0] text-[#475569] hover:text-[#102033] hover:border-[#CBD5E1] font-medium transition-colors"
          >
            Corrigir informações
          </button>
        </div>
      </div>
    </div>
  );
}
