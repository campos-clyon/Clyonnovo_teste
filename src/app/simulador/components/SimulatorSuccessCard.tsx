"use client";

import { CheckCircle2 } from "lucide-react";

export default function SimulatorSuccessCard({
  orderId,
  onNewOrder,
}: {
  orderId: number | null;
  onNewOrder: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] flex items-center justify-center px-4 py-12">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-6 flex justify-center">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-pulse" />
            <CheckCircle2 className="w-20 h-20 text-green-600 relative" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-green-900 mb-3">
          Pedido Enviado com Sucesso
        </h1>

        <p className="text-green-800 mb-8 leading-relaxed">
          A equipa CLYON recebeu os seus dados e irá analisar o pedido. 
          Entraremos em contacto em breve para confirmar o orçamento e o agendamento.
        </p>

        {orderId && (
          <div className="bg-white rounded-lg p-4 mb-8 border border-green-200">
            <p className="text-sm text-green-700 mb-1">Número do Pedido</p>
            <p className="text-2xl font-bold text-green-900">#{orderId}</p>
          </div>
        )}

        <div className="bg-white/80 rounded-lg p-4 mb-8 border border-green-100">
          <p className="text-sm text-green-800 mb-2 font-medium">Próximos Passos:</p>
          <ul className="text-sm text-green-700 space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">1.</span>
              <span>A equipa CLYON revê o seu pedido</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">2.</span>
              <span>Confirmamos o orçamento por telefone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">3.</span>
              <span>Agendamos a recolha no melhor dia para si</span>
            </li>
          </ul>
        </div>

        <button
          onClick={onNewOrder}
          className="w-full py-3 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
        >
          Criar Novo Pedido
        </button>

        <p className="text-sm text-green-700 mt-6">
          Pode contactar-nos directamente: <br />
          <span className="font-semibold">+351 XXX XXX XXX</span>
        </p>
      </div>
    </div>
  );
}
