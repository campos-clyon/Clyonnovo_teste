"use client";

import type { EstimateResult, OrderData } from "../types";
import { TAX_RATE } from "../pricingRules";

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Fácil",
  2: "Normal",
  3: "Médio",
  4: "Difícil",
  5: "Muito difícil",
};

const DIFFICULTY_COLORS: Record<number, string> = {
  1: "text-[#22C55E] bg-[#F0FDF4]",
  2: "text-[#0487D9] bg-[#EFF8FF]",
  3: "text-[#F59E0B] bg-[#FFFBEB]",
  4: "text-[#EF4444] bg-[#FEF2F2]",
  5: "text-[#991B1B] bg-[#FEF2F2]",
};

interface EstimateCardProps {
  estimate: EstimateResult | null;
  loading?: boolean;
  canGenerate?: boolean;
  onGenerate?: () => void;
  onReset?: () => void;
  onSaveOrder?: () => void;
  savingOrder?: boolean;
  orderSaved?: boolean;
  order: OrderData;
}

export default function EstimateCard({ estimate, loading, canGenerate, onGenerate, onReset, onSaveOrder, savingOrder, orderSaved, order }: EstimateCardProps) {
  const vatRate = Math.round(TAX_RATE * 100);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9]">
        <h3 className="text-sm font-semibold text-[#102033]">Estimativa de preço</h3>
        <p className="text-xs text-[#64748B] mt-0.5">Com base no preçário <span className="text-[#0487D9] font-medium">CLYON</span></p>
      </div>

      <div className="px-5 py-4">
        {/* Estado: sem dados suficientes */}
        {!estimate && !loading && (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#F0F9FF] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#0487D9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4.026 19.222A10.787 10.787 0 0012 21c2.695 0 5.17-.986 7.02-2.606l.1-.087A2.987 2.987 0 0020 17v-.5a2.5 2.5 0 00-2.5-2.5h-15A2.5 2.5 0 000 17v.5c0 .414.168.79.44 1.064" />
              </svg>
            </div>
            <p className="text-sm text-[#475569] leading-relaxed">
              Assim que recebermos os detalhes principais, calculamos uma estimativa personalizada com base no preçário CLYON.
            </p>
            <button
              disabled={!canGenerate}
              onClick={onGenerate}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0487D9] hover:bg-[#036BB0] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Gerar estimativa
            </button>
            {!canGenerate && (
              <p className="text-xs text-[#94A3B8] mt-2">Preencha os dados do chat para activar</p>
            )}
          </div>
        )}

        {/* Estado: a calcular */}
        {loading && (
          <div className="text-center py-6">
            <div className="flex items-center justify-center gap-2 text-[#0487D9]">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium">A calcular estimativa com base no preçário CLYON...</span>
            </div>
          </div>
        )}

        {/* Estado: mais info necessária */}
        {estimate?.status === "needs_more_info" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA]">
              <svg className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[#92400E]">Dados insuficientes</p>
                <p className="text-xs text-[#B45309] mt-1">Falta: {estimate.missingFields.join(", ")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Estado: visita presencial */}
        {estimate?.status === "onsite_required" && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[#EFF8FF] border border-[#BAE6FD]">
              <p className="text-sm font-semibold text-[#0369A1]">Orçamento presencial recomendado</p>
              <p className="text-xs text-[#0284C7] mt-1 leading-relaxed">{estimate.customerMessage}</p>
            </div>

            {/* Botões de ação */}
            {!orderSaved ? (
              <div className="space-y-2 pt-1">
                {/* Guardar pedido — envia para a equipa CLYON */}
                {onSaveOrder && (
                  <button
                    type="button"
                    onClick={onSaveOrder}
                    disabled={savingOrder}
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#0487D9] hover:bg-[#036BB0] text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingOrder ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        A enviar pedido...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Enviar pedido para análise
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onReset}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl border border-[#E2E8F0] text-[#94A3B8] hover:text-[#64748B] hover:border-[#CBD5E1] text-xs font-medium transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Começar novo pedido
                </button>
              </div>
            ) : (
              /* Card de sucesso após pedido enviado */
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-[#22C55E] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-semibold text-[#166534]">Pedido enviado com sucesso</p>
                      <p className="text-sm text-[#15803D] mt-1 leading-relaxed">
                        A equipa CLYON recebeu os seus dados e irá analisar o pedido. Entraremos em contacto em breve para confirmar o orçamento e o agendamento.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onReset}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl border border-[#E2E8F0] text-[#94A3B8] hover:text-[#64748B] hover:border-[#CBD5E1] text-xs font-medium transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Criar novo pedido
                </button>
              </div>
            )}
          </div>
        )}

        {/* Estado: estimativa gerada */}
        {estimate?.status === "estimated" && (
          <div className="space-y-4">
            {/* Breakdown de valores */}
            <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#166534]">Estimativa calculada</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[estimate.difficultyLevel]}`}>
                  {DIFFICULTY_LABELS[estimate.difficultyLevel]}
                </span>
              </div>

              {/* Linha de mão de obra */}
              {estimate.labor && (
                <div className="flex justify-between text-xs text-[#475569]">
                  <span>
                    Mão de obra&nbsp;
                    <span className="text-[#94A3B8]">
                      ({estimate.labor.estimatedHours}h &times; {estimate.labor.peopleCount}p &times; {estimate.labor.hourlyRatePerPerson}€/h)
                    </span>
                  </span>
                  <span className="font-medium text-[#102033]">{estimate.labor.laborCost.toFixed(2)}€</span>
                </div>
              )}

              {/* Separador */}
              <div className="border-t border-[#BBF7D0] pt-2 space-y-1.5">
                <div className="flex justify-between text-sm text-[#475569]">
                  <span>Valor sem IVA</span>
                  <span className="font-medium text-[#102033]">{estimate.estimatedPriceWithoutVat?.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-sm text-[#475569]">
                  <span>IVA ({vatRate}%)</span>
                  <span className="font-medium text-[#102033]">{estimate.vatAmount?.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-[#102033] pt-1.5 border-t border-[#BBF7D0]">
                  <span>Total estimado</span>
                  <span className="text-[#16A34A]">{estimate.estimatedPriceWithVat?.toFixed(2)}€</span>
                </div>
              </div>
            </div>

            {/* Mensagem ao cliente */}
            <p className="text-xs text-[#64748B] leading-relaxed">{estimate.customerMessage}</p>

            {/* Condições consideradas */}
            {estimate.assumptions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#475569] mb-1.5">Condições consideradas</p>
                <ul className="space-y-1">
                  {estimate.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-[#22C55E] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs text-[#64748B]">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Botões de ação */}
            {!orderSaved ? (
              <div className="space-y-2 pt-1">
                {/* Guardar pedido — envia para a equipa CLYON */}
                {onSaveOrder && (
                  <button
                    type="button"
                    onClick={onSaveOrder}
                    disabled={savingOrder}
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#0487D9] hover:bg-[#036BB0] text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingOrder ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        A enviar pedido...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Enviar pedido para análise
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onReset}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl border border-[#E2E8F0] text-[#94A3B8] hover:text-[#64748B] hover:border-[#CBD5E1] text-xs font-medium transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Começar novo pedido
                </button>
              </div>
            ) : (
              /* Card de sucesso após pedido enviado */
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-[#22C55E] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-semibold text-[#166534]">Pedido enviado com sucesso</p>
                      <p className="text-sm text-[#15803D] mt-1 leading-relaxed">
                        A equipa CLYON recebeu os seus dados e irá analisar o pedido. Entraremos em contacto em breve para confirmar o orçamento e o agendamento.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onReset}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl border border-[#E2E8F0] text-[#94A3B8] hover:text-[#64748B] hover:border-[#CBD5E1] text-xs font-medium transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Criar novo pedido
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aviso de privacidade */}
      <div className="px-5 pb-4">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
          <svg className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-[10px] text-[#94A3B8] leading-relaxed">
            Os seus dados serão usados apenas para analisar este pedido e organizar o contacto da equipa CLYON.
          </p>
        </div>
      </div>
    </div>
  );
}
