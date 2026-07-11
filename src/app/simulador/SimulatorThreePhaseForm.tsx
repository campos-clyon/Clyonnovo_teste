"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocation } from "@/contexts/LocationContext";
import type {
  OrderData,
  UploadedFile,
  AddressData,
  DistanceFromBase,
  DistanceStatus,
  EstimateResult,
  AddressStatus,
  MovingAccess,
  MovingDistance,
  ServiceType,
} from "./types";
import AddressAutocomplete from "./components/AddressAutocomplete";
import OrderSummaryCard from "./components/OrderSummaryCard";
import ServiceTypeCards from "./components/ServiceTypeCards";
import EntulhoDetails from "./components/EntulhoDetails";
import VolumeQuantitySelector from "./components/VolumeQuantitySelector";
import CompactOrderDetails from "./components/CompactOrderDetails";
import { ChevronRight, ChevronLeft, CheckCircle, Loader2 } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import {
  trackSimulatorStart,
  trackSimulatorContact,
  trackSimulatorEstimate,
  trackSimulatorOrderConfirmed,
} from "@/lib/analytics";

const DRAFT_KEY = "clyon_simulator_draft";
const PHASES = ["Serviço", "Local e acesso", "Contacto e envio"] as const;

interface FormState extends OrderData {
  distanceFromBase?: DistanceFromBase;
  distanceStatus?: DistanceStatus;
  addressStatus?: AddressStatus;
}

export default function SimulatorThreePhaseForm() {
  const { data: session } = useSession();
  const { location: savedLocation } = useLocation();
  const [phase, setPhase] = useState(1);
  const [formData, setFormData] = useState<FormState>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [countdown, setCountdown] = useState(0); // contagem regressiva do envio (20→0)
  const [successOrderId, setSuccessOrderId] = useState<number | null>(null);
  const [successAssignedTo] = useState<{ id: number; name: string } | null>(null);
  const [addressValue, setAddressValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase2Attempted, setPhase2Attempted] = useState(false);

  // Limpar localStorage ao inicializar (F5 sempre reseta)
  useEffect(() => {
    try {
      // Sempre limpar localStorage ao montar (F5 reseta o formulário)
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem("clyon_simulator_form_draft");
    } catch {
      // silencioso
    }
    // Registar início do simulador
    trackSimulatorStart();
  }, []);

  // Pré-preencher simplificado: nome, email da sessão Google e morada salva
  useEffect(() => {
    if (session?.user?.email || session?.user?.name || savedLocation) {
      // Localização aproximada (por IP): usar apenas a cidade, nunca uma morada
      // exata — o cliente deve escolher a morada precisa no passo "Local e acesso".
      const isApproximate = savedLocation?.isApproximate;
      const exactAddress =
        savedLocation && !isApproximate ? savedLocation : undefined;

      setFormData((prev) => ({
        ...prev,
        receiver: {
          ...prev.receiver,
          name: prev.receiver?.name || session?.user?.name || undefined,
          email: prev.receiver?.email || session?.user?.email || undefined,
        },
        address: prev.address || exactAddress || undefined,
        city: prev.city || savedLocation?.city || undefined,
      }));

      // Só preencher o campo de input com morada exata (não aproximada)
      if (exactAddress && !addressValue && exactAddress.formattedAddress) {
        setAddressValue(exactAddress.formattedAddress);
      }
    }
  }, [session?.user?.email, session?.user?.name, savedLocation]);

  // Pré-preencher telefone e morada a partir do PERFIL da conta (tabela users).
  // A sessão Google só traz nome/email — telefone e morada guardada vivem no
  // perfil e têm de ser buscados à parte. Só corre para utilizadores autenticados
  // e nunca sobrescreve o que o utilizador já escreveu.
  useEffect(() => {
    if (!session?.user?.email) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/users/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          user?: {
            name?: string | null;
            phone?: string | null;
            addressLine?: string | null;
            addressNumber?: string | null;
            postalCode?: string | null;
            addressCity?: string | null;
          };
        };
        const u = data.user;
        if (!u || cancelled) return;

        // Construir a morada formatada a partir dos campos do perfil.
        const linha = [u.addressLine, u.addressNumber].filter(Boolean).join(", ");
        const zona = [u.postalCode, u.addressCity].filter(Boolean).join(" ");
        const savedAddress = [linha, zona].filter(Boolean).join(", ").trim();

        setFormData((prev) => ({
          ...prev,
          receiver: {
            ...prev.receiver,
            name: prev.receiver?.name || u.name || undefined,
            phone: prev.receiver?.phone || u.phone || undefined,
          },
          address: prev.address?.formattedAddress
            ? prev.address
            : savedAddress
              ? {
                  ...prev.address,
                  formattedAddress: savedAddress,
                  city: u.addressCity || prev.address?.city || undefined,
                  postalCode: u.postalCode || prev.address?.postalCode || undefined,
                }
              : prev.address,
          city: prev.city || u.addressCity || undefined,
        }));

        if (savedAddress) setAddressValue((cur) => cur || savedAddress);
      } catch {
        /* silencioso — prefill é conveniência, não bloqueia o formulário */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.email]);

  // Salvar draft no localStorage
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
  }, [formData]);

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddressSelect = (data: AddressData) => {
    updateField("address", data);
    updateField("addressStatus", "selected");
    setAddressValue(data.formattedAddress || "");
  };

  const handleDistanceCalculated = (distance: DistanceFromBase, status: DistanceStatus) => {
    updateField("distanceFromBase", distance);
    updateField("distanceStatus", status);
  };

  // ── Mudança: handlers de morada de origem e destino ──────────────────────
  const handleOriginSelect = (data: AddressData) => {
    updateField("originAddress", data);
    updateField("originAddressValue", data.formattedAddress || "");
    updateField("originAddressStatus", "selected");
  };

  const handleDestinationSelect = (data: AddressData) => {
    updateField("destinationAddress", data);
    updateField("destinationAddressValue", data.formattedAddress || "");
    updateField("destinationAddressStatus", "selected");
  };

  const handleMovingDistanceCalculated = (distance: MovingDistance, status: DistanceStatus) => {
    updateField("movingDistance", distance);
    updateField("movingDistanceStatus", status);
  };

  const updateOriginAccess = (field: keyof MovingAccess, value: unknown) => {
    updateField("originAccess", { ...formData.originAccess, [field]: value });
  };

  const updateDestinationAccess = (field: keyof MovingAccess, value: unknown) => {
    updateField("destinationAccess", { ...formData.destinationAccess, [field]: value });
  };

  const isPhase1Valid = () => {
    // Deve ter serviço selecionado
    if (!formData.serviceType) return false;

    // Para entulho: precisa de estado + (quantidade OU "não tenho a certeza")
    if (formData.serviceType === "recolha_entulho") {
      const hasEntulhoData =
        formData.entulhoState &&
        (formData.entulhoQuantidade || formData.entulhoQuantidadeIncerta);
      if (!hasEntulhoData) return false;
      // Para entulho: tem dados suficientes (campo de descrição agora é opcional)
      return true;
    }

    // Para outros serviços: precisa de PELO MENOS UMA DAS:
    // 1. Descrição preenchida
    // 2. Fotos/vídeos adicionados
    const hasDescription = !!formData.description?.trim();
    const hasFiles = (formData.files || []).length > 0;

    return hasDescription || hasFiles;
  };

  const isPhase2Valid = () => {
    if (formData.serviceType === "mudanca") {
      // Mudança: obriga origem e destino com acesso completo nos dois lados
      const hasOrigin = !!(formData.originAddress?.formattedAddress);
      const hasDestination = !!(formData.destinationAddress?.formattedAddress);
      const originElevatorValid =
        formData.originAccess?.floor === "rés-do-chão" ? true : !!formData.originAccess?.hasElevator;
      const destElevatorValid =
        formData.destinationAccess?.floor === "rés-do-chão" ? true : !!formData.destinationAccess?.hasElevator;
      const originAccessOk = !!(formData.originAccess?.floor && originElevatorValid && formData.originAccess?.parkingDistance);
      const destAccessOk = !!(formData.destinationAccess?.floor && destElevatorValid && formData.destinationAccess?.parkingDistance);
      return hasOrigin && hasDestination && originAccessOk && destAccessOk;
    }
    // Outros serviços: apenas uma morada
    const elevatorValid = formData.floor === "rés-do-chão" ? true : !!formData.hasElevator;
    return formData.address?.formattedAddress && formData.floor && elevatorValid && formData.parkingDistance;
  };

  const isPhase3Valid = () => {
    return formData.receiver?.name && formData.receiver?.phone && formData.urgency;
  };

  const canProceedToPhase2 = isPhase1Valid();
  const canProceedToPhase3 = isPhase2Valid();
  const canAnalyze = isPhase3Valid();

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      setError("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setCountdown(20);

    // Contagem regressiva visível (20 → 0).
    const countdownInterval = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : 0));
    }, 1000);

    // Espera mínima de 20s — momento de "análise" antes do sucesso.
    // O trabalho real (estimativa + gravação) corre em paralelo.
    const minWait = new Promise<void>((resolve) => setTimeout(resolve, 20000));

    const work = (async () => {
      // 1) Estimativa (para o backoffice) — nunca mostrada ao cliente; falha não bloqueia.
      let apiResult: EstimateResult | null = null;
      try {
        const res = await fetch("/api/simulator/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: formData }),
        });
        if (res.ok) {
          apiResult = (await res.json()) as EstimateResult;
          trackSimulatorEstimate(
            formData.serviceType ?? "desconhecido",
            apiResult.estimatedPriceWithVat ?? apiResult.estimatedPriceWithoutVat ?? 0,
            formData.address?.city ?? formData.originAddress?.city,
            {
              estimateMin: apiResult.estimatedPriceWithoutVat,
              estimateMax: apiResult.estimatedPriceWithVat,
              difficultyLevel: apiResult.difficultyLevel,
              analysisSource: apiResult.analysisSource,
            },
          );
        }
      } catch {
        /* estimativa opcional — ignora falhas */
      }

      // 2) Upload das fotos/vídeos ao Vercel Blob (se existirem) antes de guardar o pedido.
      let uploadedFiles: Array<{ url: string; name: string; size: number; type?: string }> = [];
      const rawFiles = (formData.files ?? []).filter((f) => f?.file instanceof File);
      console.info(`[simulador] Tem ${rawFiles.length} ficheiros para upload`);
      if (rawFiles.length > 0) {
        try {
          const fd = new FormData();
          rawFiles.forEach((f) => fd.append("fotos", f.file as File, f.name));
          const upRes = await fetch("/api/simulador/upload-fotos", { method: "POST", body: fd });
          const upData = await upRes.json().catch(() => null);
          if (upRes.ok && upData) {
            uploadedFiles = (upData.files ?? []) as typeof uploadedFiles;
            console.info(`[simulador] Upload OK: ${uploadedFiles.length} URLs`);
          } else {
            console.error(`[simulador] Upload falhou (${upRes.status}):`, upData?.error ?? upData);
          }
        } catch (err) {
          console.error("[simulador] Erro de rede no upload:", err);
        }
      }

      // 3) Guardar o pedido (com a estimativa quando disponível).
      try {
        const estimate: EstimateResult = apiResult ?? {
          status: "estimated",
          estimatedPriceWithoutVat: null,
          vatAmount: null,
          estimatedPriceWithVat: null,
          difficultyLevel: 2,
          summary: "Aguarda análise da equipa",
          assumptions: [],
          missingFields: [],
          customerMessage: "",
          internalNotes: ["Estimativa não disponível no envio — análise pela equipa"],
          analysisSource: "timeout_fallback",
        };
        // Substituir os File objects por metadata + URL (o servidor recebe JSON puro).
        const orderPayload = {
          ...formData,
          files: uploadedFiles.length > 0
            ? uploadedFiles.map((f, i) => ({
                id: String(i),
                url: f.url,
                name: f.name,
                size: f.size,
                type: f.type,
                mimeType: f.type,
              }))
            : (formData.files ?? []).map((f) => ({
                id: f.id,
                name: f.name,
                size: f.size,
                type: f.type,
                mimeType: f.mimeType,
              })),
        };
        const saveRes = await fetch("/api/simulador/pedido", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: orderPayload, estimate }),
        });
        if (saveRes.ok) {
          const saved = await saveRes.json();
          return (saved.id as number) ?? null;
        }
      } catch {
        /* gravação falhou — mostramos sucesso na mesma */
      }
      return null;
    })();

    const [savedId] = await Promise.all([work, minWait]);
    clearInterval(countdownInterval);

    if (savedId) {
      trackSimulatorOrderConfirmed({
        service: formData.serviceType ?? undefined,
        name: formData.receiver?.name ?? undefined,
        phone: formData.receiver?.phone ?? undefined,
        email: formData.receiver?.email ?? undefined,
        city: formData.address?.city ?? formData.originAddress?.city,
        simulatorData: { orderId: savedId, serviceType: formData.serviceType },
      });
    }

    // Ir sempre para o ecrã de sucesso (savedId -1 = gravação falhou, sucesso mesmo assim).
    setSuccessOrderId(savedId ?? -1);
    setIsAnalyzing(false);
  };

  const handleReset = () => {
    setFormData({});
    setSuccessOrderId(null);
    setCountdown(0);
    setPhase(1);
    setAddressValue("");
    setError(null);

    // Limpar TODOS os localStorage keys (novos e antigos)
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem("clyon_simulator_form_draft");
    localStorage.removeItem("clyon_simulator_draft");

    // Limpar também qualquer outra chave do simulador antigo
    Object.keys(localStorage).forEach(key => {
      if (key.includes("simulador") || key.includes("simulator")) {
        localStorage.removeItem(key);
      }
    });
  };

  // Success Screen
  if (successOrderId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4 py-6 sm:py-10 flex items-center">
        <div className="mx-auto w-full max-w-md">
          {/* Success Icon */}
          <div className="flex justify-center mb-4 sm:mb-5">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full blur-md opacity-40 animate-pulse" />
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-5">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent leading-tight">
              Pedido enviado
            </h1>
            {successOrderId > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5">
                <span className="text-sm text-gray-500">Nº</span>
                <span className="inline-block bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm px-3 py-0.5 rounded-full">
                  #{successOrderId}
                </span>
              </div>
            )}
          </div>

          {/* Combined info card */}
          <div className="bg-white rounded-2xl border border-blue-100 p-4 sm:p-5 shadow-sm mb-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 bg-blue-50 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {successAssignedTo ? (
                  <>A equipa vai avaliar o pedido. Assistente responsável: <span className="font-semibold text-gray-900">{successAssignedTo.name}</span>. Entramos em contacto por telefone ou email.</>
                ) : (
                  <>A equipa CLYON vai avaliar o pedido em breve e entrar em contacto por telefone ou email.</>
                )}
              </p>
            </div>
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              Guarde o número <span className="font-mono font-semibold text-gray-700">#{successOrderId}</span> para referência.
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-shadow"
          >
            Novo pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7FBFF] to-white py-3 px-3 sm:py-6 sm:px-4">
      <div className="max-w-7xl mx-auto">
        {/* Barra de progresso — % concluído */}
        <div className="mx-auto mb-3 sm:mb-5 max-w-md">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500">Passo {phase} de {PHASES.length}</span>
            <span className="text-[11px] sm:text-xs font-semibold text-cyan-600">
              {Math.round((phase / PHASES.length) * 100)}% concluído
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-500"
              style={{ width: `${(phase / PHASES.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Progress Indicator — versão mobile mostra só ícones, versão desktop com labels */}
        <div className="flex items-center justify-center gap-1 sm:gap-3 mb-4 sm:mb-8 w-full overflow-hidden">
          {PHASES.map((phaseName, idx) => {
            const phaseNum = idx + 1;
            const isActive = phaseNum === phase;
            const isCompleted = phaseNum < phase || (phaseNum === 1 && isPhase1Valid()) || (phaseNum === 2 && isPhase2Valid()) || (phaseNum === 3 && isPhase3Valid());

            return (
              <div key={phaseNum} className="flex items-center min-w-0 shrink">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink">
                  <div
                    className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm transition-colors shrink-0 ${
                      isActive
                        ? "bg-cyan-600 text-white"
                        : isCompleted
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {isCompleted && phaseNum < phase ? "✓" : phaseNum}
                  </div>
                  {/* Em mobile só o passo activo mostra label */}
                  <p className={`text-[11px] sm:text-sm text-gray-600 leading-tight break-words min-w-0 ${isActive ? "block" : "hidden sm:block"}`}>{phaseName}</p>
                </div>
                {idx < PHASES.length - 1 && (
                  <div className={`w-3 sm:w-10 h-1 mx-1 sm:mx-2 shrink-0 rounded-full ${isCompleted ? "bg-green-600" : "bg-gray-300"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Main Content - 2 Columns on Desktop, 1 on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Form Section - 2 columns on desktop */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-6 space-y-4 sm:space-y-6">
              {/* Phase 1: Service */}
              {phase === 1 && (
                <Phase1Service
                  formData={formData}
                  updateField={updateField}
                />
              )}

              {/* Phase 2: Location & Access */}
              {phase === 2 && (
                <Phase2Location
                  formData={formData}
                  addressValue={addressValue}
                  setAddressValue={setAddressValue}
                  onAddressSelect={handleAddressSelect}
                  onDistanceCalculated={handleDistanceCalculated}
                  updateField={updateField}
                  onOriginSelect={handleOriginSelect}
                  onDestinationSelect={handleDestinationSelect}
                  onMovingDistanceCalculated={handleMovingDistanceCalculated}
                  updateOriginAccess={updateOriginAccess}
                  updateDestinationAccess={updateDestinationAccess}
                  showValidationErrors={phase2Attempted}
                />
              )}

              {/* Phase 3: Contact & Review — escondido durante o envio (loading) */}
              {phase === 3 && !isAnalyzing && (
                <Phase3Contact
                  formData={formData}
                  updateField={updateField}
                  session={session}
                />
              )}

              {/* Loading de envio — contagem regressiva de 20s até ao sucesso */}
              {phase === 3 && isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-cyan-400/30 blur-xl animate-pulse" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg">
                      <Loader2 className="h-10 w-10 animate-spin text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">A enviar o seu pedido…</h3>
                  <p className="mt-1.5 max-w-sm text-sm text-slate-500">
                    A preparar o seu pedido para análise da equipa CLYON. Não feche esta página.
                  </p>
                  <div className="mt-5 flex items-center gap-2 text-cyan-600">
                    <span className="text-3xl font-bold tabular-nums">{countdown}</span>
                    <span className="text-sm font-medium">segundos</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Navigation Buttons — escondidos durante o envio */}
              {!isAnalyzing && (
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  {phase > 1 && (
                    <button
                      onClick={() => setPhase(phase - 1)}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>
                  )}

                  {phase < 3 && (
                    <button
                      onClick={() => {
                        if (phase === 1) {
                          // Avança de fase 1 (serviço) para fase 2 (local)
                        } else if (phase === 2) {
                          // Marcar tentativa para mostrar erros de validação
                          if (!canProceedToPhase3) {
                            setPhase2Attempted(true);
                            return;
                          }
                          setPhase2Attempted(false);
                          trackSimulatorContact({
                            service: formData.serviceType ?? undefined,
                          });
                        }
                        setPhase(phase + 1);
                      }}
                      disabled={!canProceedToPhase2}
                      className="ml-auto flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:bg-gray-300 text-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 active:scale-95"
                    >
                      Seguinte
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  {phase === 3 && (
                    <button
                      onClick={handleAnalyze}
                      disabled={!canAnalyze}
                      className="ml-auto flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors min-w-[200px] justify-center"
                    >
                      Enviar Pedido
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Summary Sidebar - só no desktop (escondido no telemóvel) */}
          <div className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-8">
              <OrderSummaryCard
                order={formData}
                onEdit={() => setPhase(1)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Phase 1 Component
function Phase1Service({
  formData,
  updateField,
}: {
  formData: FormState;
  updateField: (field: string, value: unknown) => void;
}) {
  const services = SERVICE_CATEGORIES.map((category) => ({
    id: category.id as ServiceType,
    label: category.label,
    icon: category.emoji,
  }));

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">
          Que serviço precisa?
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 sm:mt-1">
          Escolha o serviço e adicione detalhes.
        </p>
      </div>

      {/* Service Cards */}
      <ServiceTypeCards
        services={services}
        selected={formData.serviceType}
        onSelect={(serviceType) => updateField("serviceType", serviceType)}
      />

      {/* Entulho Details (conditional) */}
      {formData.serviceType === "recolha_entulho" && (
        <EntulhoDetails
          state={formData.entulhoState}
          quantity={formData.entulhoQuantidade}
          quantidadeEnsacados={formData.entulhoQuantidadeEnsacados}
          quantidadePorEnsacar={formData.entulhoQuantidadePorEnsacar}
          quantidadeBigBags={formData.entulhoQuantidadeBigBags}
          volume={formData.entulhoVolume}
          onStateChange={(state) => updateField("entulhoState", state)}
          onQuantityChange={(quantity) => {
            updateField("entulhoQuantidade", quantity);
            // Número exato limpa a estimativa por volume e a incerteza.
            updateField("entulhoVolume", undefined);
            if (quantity) updateField("entulhoQuantidadeIncerta", false);
          }}
          onVolumeChange={(vol) => {
            updateField("entulhoVolume", vol);
            // Conversão escondida do cliente: cada tier de volume → nº de sacos.
            const map: Record<string, number> = { carrinha: 40, camiao_caixa: 120, camiao_lixo: 240 };
            if (vol === "incerto") {
              updateField("entulhoQuantidadeIncerta", true);
              updateField("entulhoQuantidade", "");
            } else {
              updateField("entulhoQuantidadeIncerta", false);
              updateField("entulhoQuantidade", String(map[vol] ?? ""));
            }
          }}
          onQuantidadeEnsacadosChange={(q) => {
            updateField("entulhoQuantidadeEnsacados", q);
            // Combinar misto: total = ensacados + por ensacar
            const total = (parseInt(q) || 0) + (parseInt(formData.entulhoQuantidadePorEnsacar ?? "0") || 0);
            if (total > 0) updateField("entulhoQuantidade", String(total));
          }}
          onQuantidadePorEnsacarChange={(q) => {
            updateField("entulhoQuantidadePorEnsacar", q);
            const total = (parseInt(formData.entulhoQuantidadeEnsacados ?? "0") || 0) + (parseInt(q) || 0);
            if (total > 0) updateField("entulhoQuantidade", String(total));
          }}
          onQuantidadeBigBagsChange={(q) => {
            updateField("entulhoQuantidadeBigBags", q);
            // Conversão escondida do cliente: 1 big bag = 42 sacos no chão.
            // O motor de preços recebe sempre sacos em entulhoQuantidade.
            const sacos = (parseInt(q.replace(/[^\d]/g, "")) || 0) * 42;
            updateField("entulhoQuantidade", sacos > 0 ? String(sacos) : "");
          }}
        />
      )}

      {/* Quantidade (volume) — categorias onde "quanto enche" é a pergunta certa.
          Entulho tem o seu próprio seletor acima (com conversão de sacos). */}
      {["recolha_moveis", "recolha_monos", "esvaziamento_casa", "esvaziamento_apartamento"].includes(
        formData.serviceType ?? "",
      ) && (
        <VolumeQuantitySelector
          volume={formData.volumeTier}
          exactValue={formData.quantityExact}
          exactLabel="Sei a quantidade exata"
          exactPlaceholder={
            formData.serviceType === "esvaziamento_casa" || formData.serviceType === "esvaziamento_apartamento"
              ? "Ex: 3 divisões"
              : "Ex: 5 móveis"
          }
          onVolumeChange={(vol) => {
            updateField("volumeTier", vol);
            const labels: Record<string, string> = {
              carrinha: "Enche uma carrinha (poucos itens)",
              camiao_caixa: "Enche a caixa de um camião (volume médio)",
              camiao_lixo: "Enche um camião (grande volume)",
              incerto: "Quantidade incerta — a confirmar com a equipa",
            };
            updateField("quantityExact", undefined);
            const label = `Quantidade estimada: ${labels[vol]}.`;
            const rest = (formData.description ?? "").replace(/^Quantidade( estimada)?:.*\n?/, "");
            updateField("description", [label, rest].filter(Boolean).join("\n").trim());
          }}
          onExactChange={(value) => {
            updateField("quantityExact", value);
            updateField("volumeTier", undefined);
            const label = value ? `Quantidade: ${value}.` : "";
            const rest = (formData.description ?? "").replace(/^Quantidade( estimada)?:.*\n?/, "");
            updateField("description", [label, rest].filter(Boolean).join("\n").trim());
          }}
        />
      )}

      {/* Order Details with integrated upload */}
      <CompactOrderDetails
        description={formData.description}
        files={formData.files || []}
        onDescriptionChange={(description) => updateField("description", description)}
        onFilesAdd={(files) => updateField("files", [...(formData.files || []), ...files])}
        onFileRemove={(id) => updateField("files", (formData.files || []).filter(f => f.id !== id))}
        maxFiles={10}
        maxSizeMB={50}
      />
    </div>
  );
}

// ── Selector de andar + elevador + estacionamento reutilizável ──────────────
function AccessFields({
  prefix,
  floor,
  hasElevator,
  parkingDistance,
  difficultAccess,
  onChange,
}: {
  prefix: string;
  floor?: string;
  hasElevator?: string;
  parkingDistance?: string;
  difficultAccess?: boolean;
  onChange: (field: keyof MovingAccess, value: unknown) => void;
}) {
  const selectCls = "w-full px-3 py-2 border-2 border-gray-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 shadow-sm";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">Andar *</label>
          <select
            value={floor || ""}
            onChange={(e) => {
              onChange("floor", e.target.value);
              if (e.target.value === "rés-do-chão") onChange("hasElevator", "");
            }}
            className={selectCls}
          >
            <option value="">Seleccione...</option>
            <option value="rés-do-chão">Rés-do-chão</option>
            <option value="1º">1º Andar</option>
            <option value="2º">2º Andar</option>
            <option value="3º">3º Andar</option>
            <option value="4º+">4º Andar ou superior</option>
          </select>
        </div>

        {floor && floor !== "rés-do-chão" && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">Elevador *</label>
            <select
              value={hasElevator || ""}
              onChange={(e) => onChange("hasElevator", e.target.value)}
              className={selectCls}
            >
              <option value="">Seleccione...</option>
              <option value="yes">Sim, funciona</option>
              <option value="small">Sim, mas é pequeno</option>
              <option value="no">Não tem</option>
              <option value="unknown">Não sei</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">Estacionamento *</label>
        <select
          value={parkingDistance || ""}
          onChange={(e) => onChange("parkingDistance", e.target.value)}
          className={selectCls}
        >
          <option value="">Seleccione...</option>
          <option value="door">Sim, mesmo à porta</option>
          <option value="under_20m">Sim, até 20 metros</option>
          <option value="over_30m">Mais de 30 metros</option>
          <option value="difficult">Estacionamento difícil</option>
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!difficultAccess}
          onChange={(e) => onChange("difficultAccess", e.target.checked)}
          className="rounded border-gray-400 accent-cyan-600"
        />
        <span className="text-sm text-gray-700">Acesso difícil ou desmontagem necessária</span>
      </label>
    </div>
  );
}

// Phase 2 Component
function Phase2Location({
  formData,
  addressValue,
  setAddressValue,
  onAddressSelect,
  onDistanceCalculated,
  updateField,
  onOriginSelect,
  onDestinationSelect,
  onMovingDistanceCalculated,
  updateOriginAccess,
  updateDestinationAccess,
  showValidationErrors,
}: {
  formData: FormState;
  addressValue: string;
  setAddressValue: (value: string) => void;
  onAddressSelect: (data: AddressData) => void;
  onDistanceCalculated: (distance: DistanceFromBase, status: DistanceStatus) => void;
  updateField: (field: string, value: unknown) => void;
  onOriginSelect: (data: AddressData) => void;
  onDestinationSelect: (data: AddressData) => void;
  onMovingDistanceCalculated: (distance: MovingDistance, status: DistanceStatus) => void;
  updateOriginAccess: (field: keyof MovingAccess, value: unknown) => void;
  updateDestinationAccess: (field: keyof MovingAccess, value: unknown) => void;
  showValidationErrors?: boolean;
}) {
  const isMudanca = formData.serviceType === "mudanca";

  // ── Percurso da mudança ─────────────────────────────────────────────────
  const [calcStatus, setCalcStatus] = useState<DistanceStatus>("idle");

  const calcSelectCls = "w-full px-4 py-2 border-2 border-gray-400 bg-white rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 shadow-sm";

  const calcMovingRoute = async () => {
    const origin = formData.originAddress;
    const dest = formData.destinationAddress;
    if (!origin || !dest) return;
    setCalcStatus("calculating");
    try {
      const res = await fetch("/api/maps/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination: dest }),
      });
      const data = await res.json();
      if (data.ok) {
        const result: MovingDistance = {
          distanceMeters: data.distanceMeters,
          distanceKm: data.distanceKm,
          durationSeconds: data.durationSeconds,
          durationText: data.durationText,
          calculatedAt: new Date().toISOString(),
        };
        setCalcStatus("calculated");
        onMovingDistanceCalculated(result, "calculated");
      } else {
        // Fallback Haversine
        if (origin.lat && origin.lng && dest.lat && dest.lng) {
          const R = 6371;
          const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
          const dLng = ((dest.lng - origin.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((origin.lat * Math.PI) / 180) * Math.cos((dest.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
          const km = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
          const mins = Math.round((km / 60) * 60);
          const result: MovingDistance = {
            distanceMeters: Math.round(km * 1000),
            distanceKm: km,
            durationSeconds: mins * 60,
            durationText: mins < 60 ? `~${mins} min` : `~${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}min` : ""}`,
            calculatedAt: new Date().toISOString(),
            isEstimate: true,
          };
          setCalcStatus("calculated");
          onMovingDistanceCalculated(result, "calculated");
        } else {
          setCalcStatus("error");
          onMovingDistanceCalculated({}, "error");
        }
      }
    } catch {
      setCalcStatus("error");
      onMovingDistanceCalculated({}, "error");
    }
  };

  // Auto-calcular percurso quando ambas as moradas estiverem selecionadas
  const originReady = !!(formData.originAddress?.formattedAddress);
  const destReady = !!(formData.destinationAddress?.formattedAddress);
  const autoCalcRef = useState(false);
  const [autoCalcDone, setAutoCalcDone] = useState(false);

  useEffect(() => {
    if (isMudanca && originReady && destReady && !autoCalcDone && calcStatus === "idle") {
      setAutoCalcDone(true);
      calcMovingRoute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMudanca, originReady, destReady]);

  // Reset autoCalc se as moradas mudarem
  useEffect(() => {
    setAutoCalcDone(false);
    setCalcStatus("idle");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.originAddress?.formattedAddress, formData.destinationAddress?.formattedAddress]);

  if (isMudanca) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Local e acesso da mudança</h2>

        {/* Card: Moradas */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-2xl">
            <h3 className="text-sm font-semibold text-gray-800">Moradas da mudança</h3>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Origem */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">A</span>
                <span className="text-sm font-semibold text-gray-800">Morada de origem</span>
              </div>
              <AddressAutocomplete
                value={formData.originAddressValue || ""}
                onChange={(v) => updateField("originAddressValue", v)}
                onSelect={onOriginSelect}
                placeholder="Rua, número, localidade de origem..."
              />
            </div>

            {/* Destino */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">B</span>
                <span className="text-sm font-semibold text-gray-800">Morada de destino</span>
              </div>
              <AddressAutocomplete
                value={formData.destinationAddressValue || ""}
                onChange={(v) => updateField("destinationAddressValue", v)}
                onSelect={onDestinationSelect}
                placeholder="Rua, número, localidade de destino..."
              />
            </div>
          </div>

          {/* Percurso */}
          {(originReady && destReady) && (
            <div className="px-5 pb-4">
              {calcStatus === "calculating" && (
                <p className="text-xs text-blue-600 flex items-center gap-1.5">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  A calcular percurso da mudança...
                </p>
              )}
              {calcStatus === "calculated" && formData.movingDistance?.distanceKm && (
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-800">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Percurso: {formData.movingDistance.distanceKm} km · {formData.movingDistance.durationText}
                  {formData.movingDistance.isEstimate && " (estimativa)"}
                </div>
              )}
              {(calcStatus === "error" || calcStatus === "idle") && (
                <button
                  type="button"
                  onClick={calcMovingRoute}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Calcular percurso da mudança
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card: Condições de acesso */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-2xl">
            <h3 className="text-sm font-semibold text-gray-800">Condições de acesso</h3>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Acesso na origem */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">A</span>
                <span className="text-sm font-semibold text-gray-700">Acesso na origem</span>
              </div>
              <AccessFields
                prefix="origin"
                floor={formData.originAccess?.floor}
                hasElevator={formData.originAccess?.hasElevator}
                parkingDistance={formData.originAccess?.parkingDistance}
                difficultAccess={formData.originAccess?.difficultAccess}
                onChange={updateOriginAccess}
              />
            </div>

            {/* Acesso no destino */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">B</span>
                <span className="text-sm font-semibold text-gray-700">Acesso no destino</span>
              </div>
              <AccessFields
                prefix="destination"
                floor={formData.destinationAccess?.floor}
                hasElevator={formData.destinationAccess?.hasElevator}
                parkingDistance={formData.destinationAccess?.parkingDistance}
                difficultAccess={formData.destinationAccess?.difficultAccess}
                onChange={updateDestinationAccess}
              />
            </div>
          </div>
        </div>

        {/* Validation hint */}
        {(!originReady || !destReady) && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Preencha a origem e o destino da mudança para continuar.
          </p>
        )}
      </div>
    );
  }

  // ── Outros serviços: layout original ────────────────────────────────────
  const missingAddress = showValidationErrors && !formData.address?.formattedAddress;
  const missingFloor = showValidationErrors && !formData.floor;
  const missingElevator = showValidationErrors && formData.floor && formData.floor !== "rés-do-chão" && !formData.hasElevator;
  const missingParking = showValidationErrors && !formData.parkingDistance;

  // Calcular lista de campos em falta para mostrar mensagem única
  const missingFields: string[] = [];
  if (!formData.address?.formattedAddress) missingFields.push("Morada");
  if (!formData.floor) missingFields.push("Andar");
  if (formData.floor && formData.floor !== "rés-do-chão" && !formData.hasElevator) missingFields.push("Elevador");
  if (!formData.parkingDistance) missingFields.push("Estacionamento");

  const errorBorderCls = "border-2 border-red-400 focus:ring-red-400 focus:border-red-400";

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Morada e condições de acesso</h2>

      {/* Validation summary */}
      {showValidationErrors && missingFields.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm font-semibold text-red-800 mb-1">Campos obrigatórios por preencher:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {missingFields.map((f) => (
              <li key={f} className="text-sm text-red-700">{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <AddressAutocomplete
          value={addressValue}
          onChange={setAddressValue}
          onSelect={onAddressSelect}
          onDistanceCalculated={onDistanceCalculated}
          placeholder="Escreva a rua, número e localidade..."
        />
        {missingAddress && <p className="text-xs text-red-600 mt-1">Morada obrigatória</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">Andar *</label>
          <select
            value={formData.floor || ""}
            onChange={(e) => {
              const newFloor = e.target.value;
              updateField("floor", newFloor);
              if (newFloor === "rés-do-chão") {
                updateField("hasElevator", "");
              }
            }}
            className={`${calcSelectCls} ${missingFloor ? errorBorderCls : ""}`}
          >
            <option value="">Seleccione...</option>
            <option value="rés-do-chão">Rés-do-chão</option>
            <option value="1º">1º Andar</option>
            <option value="2º">2º Andar</option>
            <option value="3º">3º Andar</option>
            <option value="4º+">4º Andar ou superior</option>
          </select>
        </div>

        {formData.floor !== "rés-do-chão" && formData.floor && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">Elevador *</label>
            <select
              value={formData.hasElevator || ""}
              onChange={(e) => updateField("hasElevator", e.target.value)}
              className={`${calcSelectCls} ${missingElevator ? errorBorderCls : ""}`}
            >
              <option value="">Seleccione...</option>
              <option value="yes">Sim, funciona</option>
              <option value="small">Sim, mas é pequeno</option>
              <option value="no">Não tem</option>
              <option value="unknown">Não sei</option>
            </select>
            {missingElevator && <p className="text-xs text-red-600 mt-1">Elevador obrigatório</p>}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-900">Estacionamento *</label>
        <select
          value={formData.parkingDistance || ""}
          onChange={(e) => updateField("parkingDistance", e.target.value)}
          className={`${calcSelectCls} ${missingParking ? errorBorderCls : ""}`}
        >
          <option value="">Seleccione...</option>
          <option value="door">Sim, mesmo à porta</option>
          <option value="under_20m">Sim, até 20 metros</option>
          <option value="over_30m">Mais de 30 metros</option>
          <option value="difficult">Estacionamento difícil</option>
        </select>
        {missingParking && <p className="text-xs text-red-600 mt-1">Estacionamento obrigatório</p>}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!formData.needsDismantling && formData.needsDismantling !== "no"}
            onChange={(e) => updateField("needsDismantling", e.target.checked ? "simple" : "no")}
            className="rounded border-gray-400"
          />
          <span className="text-sm text-gray-700">Acesso difícil ou desmontagem necessária</span>
        </label>
      </div>
    </div>
  );
}

// Phase 3 Component
function Phase3Contact({
  formData,
  updateField,
  session,
}: {
  formData: FormState;
  updateField: (field: string, value: unknown) => void;
  session: any;
}) {
  const isLoggedIn = !!session?.user?.email;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Contacto e revisão</h2>

      {/* Info Box: Not Logged In */}
      {!isLoggedIn && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-lg">ℹ️</span>
          <div className="flex-1">
            <p className="text-sm text-amber-900">
              Tem conta CLYON?{" "}
              <a
                href="/entrar"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-cyan-600 hover:text-cyan-700 underline"
              >
                Entrar com Google
              </a>{" "}
              para acompanhar o seu pedido online.
            </p>
          </div>
        </div>
      )}

      {/* Info Box: Logged In */}
      {isLoggedIn && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-lg">✓</span>
          <div>
            <p className="text-sm text-emerald-900">
              <strong>Sessão activa</strong> — poderá acompanhar este pedido em{" "}
              <a href="/conta" className="font-semibold text-cyan-600 hover:text-cyan-700 underline">
                clyon.pt/conta
              </a>{" "}
              após a conclusão.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">Nome completo *</label>
          <input
            type="text"
            value={formData.receiver?.name || ""}
            onChange={(e) => updateField("receiver", { ...formData.receiver, name: e.target.value })}
            placeholder="Ex: Eugênia Almeida"
            className="w-full px-4 py-2 border-2 border-gray-400 bg-white rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">Telefone *</label>
          <input
            type="tel"
            value={formData.receiver?.phone || ""}
            onChange={(e) => updateField("receiver", { ...formData.receiver, phone: e.target.value })}
            placeholder="Ex: 911 128 863"
            className="w-full px-4 py-2 border-2 border-gray-400 bg-white rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-900">Email (opcional)</label>
        <input
          type="email"
          value={formData.receiver?.email || ""}
          onChange={(e) => updateField("receiver", { ...formData.receiver, email: e.target.value })}
          placeholder="Ex: exemplo@email.com"
          className="w-full px-4 py-2 border-2 border-gray-400 bg-white rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 shadow-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-900">Quando precisa do serviço? *</label>
        <select
          value={formData.urgency || ""}
          onChange={(e) => updateField("urgency", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
        >
          <option value="">Seleccione...</option>
          <option value="today">Hoje</option>
          <option value="tomorrow">Amanhã</option>
          <option value="this_week">Esta semana</option>
          <option value="flexible">Flexível</option>
        </select>
      </div>

      {(formData.serviceType === "jardinagem" || formData.serviceType === "manutencao_casa") && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">
            Frequência do serviço <span className="text-gray-500 font-normal">(opcional — poupe com marcação recorrente)</span>
          </label>
          <select
            value={formData.recurrenceFrequency || ""}
            onChange={(e) => updateField("recurrenceFrequency", e.target.value || null)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-600 focus:border-transparent"
          >
            <option value="">Pontual (serviço único)</option>
            <option value="semanal">Semanal — poupe 15%</option>
            <option value="quinzenal">Quinzenal — poupe 10%</option>
          </select>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Nota:</strong> Após enviar o pedido, a equipa CLYON irá analisar os dados e entrar em contacto através do telefone ou email fornecido.
        </p>
      </div>
    </div>
  );
}
