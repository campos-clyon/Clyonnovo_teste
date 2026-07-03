"use client";

import type { EstimateResult } from "../types";
import { AlertCircle, CheckCircle } from "lucide-react";

interface AnalysisResultCardProps {
  analysis: EstimateResult;
  isLoading?: boolean;
  onConfirm: () => void;
  isSubmitting?: boolean;
  /** true quando o pedido já foi guardado automaticamente na BD */
  alreadySaved?: boolean;
}

export default function AnalysisResultCard({
  analysis,
  isLoading = false,
  onConfirm,
  isSubmitting = false,
  alreadySaved = false,
}: AnalysisResultCardProps) {
  const statusConfig = {
    estimated: {
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      title: "Orçamento Disponível",
      subtitle: "Preço estimado com base nos dados fornecidos",
    },
    onsite_required: {
      icon: AlertCircle,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      title: "Encaminhamento ao Assistente",
      subtitle: "Não foi possível identificar a quantidade exata de itens",
    },
    needs_more_info: {
      icon: AlertCircle,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      title: "Mais Informações Necessárias",
      subtitle: "Faltam dados para criar um orçamento preciso",
    },
  };

  const config = statusConfig[analysis.status];
  const StatusIcon = config.icon;

  return (
    <div className={`rounded-2xl border-2 ${config.borderColor} ${config.bgColor} p-6 space-y-6`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <StatusIcon className={`w-6 h-6 ${config.color} flex-shrink-0 mt-1`} />
        <div>
          <h3 className={`text-lg font-semibold ${config.color}`}>{config.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{config.subtitle}</p>
        </div>
      </div>

      {/* Price Section (se estimated) */}
      {analysis.status === "estimated" && analysis.estimatedPriceWithVat && (
        <div className="bg-white rounded-xl p-4 space-y-3">
          {/* Total em destaque */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              €{analysis.estimatedPriceWithVat.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500">IVA incluído</span>
          </div>

          {/* Breakdown detalhado */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            {/* Sem IVA */}
            {analysis.estimatedPriceWithoutVat && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal sem IVA</span>
                <span className="font-medium text-gray-700">€{analysis.estimatedPriceWithoutVat.toFixed(2)}</span>
              </div>
            )}
            {/* IVA */}
            {analysis.vatAmount && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>IVA (23%)</span>
                <span className="font-medium text-gray-700">€{analysis.vatAmount.toFixed(2)}</span>
              </div>
            )}
            {/* Total */}
            <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1.5 border-t border-gray-200">
              <span>Total com IVA</span>
              <span className="text-green-700">€{analysis.estimatedPriceWithVat.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Missing Fields Warning */}
      {analysis.missingFields && analysis.missingFields.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-amber-900">Campos que Faltam</p>
          <ul className="space-y-1">
            {analysis.missingFields.map((field, idx) => (
              <li key={idx} className="text-sm text-amber-800 flex gap-2">
                <span className="text-amber-600">•</span>
                <span>{field}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      {analysis.status === "estimated" && (
        alreadySaved ? (
          <div className="flex items-center justify-center gap-2 w-full bg-green-100 border border-green-300 text-green-800 font-semibold py-3 px-4 rounded-xl">
            <CheckCircle className="w-4 h-4" />
            Pedido Registado
          </div>
        ) : (
          <button
            onClick={onConfirm}
            disabled={isSubmitting || isLoading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            {isSubmitting ? "A enviar pedido..." : "Enviar Pedido"}
          </button>
        )
      )}

      {analysis.status === "onsite_required" && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-900">
              Este pedido será encaminhado a um assistente CLYON para análise detalhada e confirmação final de valores.
            </p>
          </div>
          {alreadySaved ? (
            <div className="flex items-center justify-center gap-2 w-full bg-cyan-100 border border-cyan-300 text-cyan-800 font-semibold py-3 px-4 rounded-xl">
              <CheckCircle className="w-4 h-4" />
              Encaminhado ao Assistente
            </div>
          ) : (
            <button
              onClick={onConfirm}
              disabled={isSubmitting || isLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              {isSubmitting ? "A encaminhar..." : "Encaminhar ao Assistente"}
            </button>
          )}
        </div>
      )}

      {analysis.status === "needs_more_info" && (
        alreadySaved ? (
          <div className="flex items-center justify-center gap-2 w-full bg-blue-100 border border-blue-300 text-blue-800 font-semibold py-3 px-4 rounded-xl">
            <CheckCircle className="w-4 h-4" />
            Pedido Registado
          </div>
        ) : (
          <p className="text-sm text-center text-gray-600">
            Por favor, forneça mais informações para obter um orçamento preciso.
          </p>
        )
      )}
    </div>
  );
}
