"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Upload, X, MapPin, Phone, CheckCircle } from "lucide-react";
import type { UploadedFile } from "./types";

interface FormData {
  serviceType: string;
  description: string;
  volume: string;
  heavyItems: string[];
  needsDismantling: string;
  photos: UploadedFile[];
  address: string;
  city: string;
  floor: string;
  hasElevator: string;
  parkingDistance: string;
  difficultAccess: string;
  urgency: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

const SERVICES = [
  "Recolha de móveis",
  "Recolha de monos/volumosos",
  "Recolha de entulho",
  "Esvaziamento de casa",
  "Esvaziamento de apartamento",
  "Mudança",
  "Limpeza de arrecadação",
  "Outro serviço",
];

const VOLUMES = [
  "Poucos objetos",
  "1/4 de carrinha",
  "1/2 carrinha",
  "3/4 de carrinha",
  "Carrinha cheia",
  "Mais de uma carrinha",
];

const HEAVY_ITEMS = [
  "Sofá grande",
  "Roupeiro",
  "Frigorífico",
  "Máquina de lavar",
  "Entulho pesado",
  "Vasos/terra/pedra",
];

const FLOORS = [
  "Rés-do-chão",
  "1.º andar",
  "2.º andar",
  "3.º andar",
  "4.º andar ou superior",
  "Cave",
  "Garagem",
];

const URGENCIES = ["Hoje", "Amanhã", "Esta semana", "Tenho flexibilidade"];

export default function SimulatorMultiStepForm() {
  const [formData, setFormData] = useState<FormData>({
    serviceType: "",
    description: "",
    volume: "",
    heavyItems: [],
    needsDismantling: "",
    photos: [],
    address: "",
    city: "",
    floor: "",
    hasElevator: "",
    parkingDistance: "",
    difficultAccess: "",
    urgency: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [expandedSummary, setExpandedSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem("clyon_simulator_form_draft");
    if (draft) {
      try {
        setFormData(JSON.parse(draft));
      } catch (e) {
        console.error("[v0] Failed to load form draft:", e);
      }
    }
  }, []);

  // Save draft to localStorage on change
  useEffect(() => {
    localStorage.setItem("clyon_simulator_form_draft", JSON.stringify(formData));
  }, [formData]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleHeavyItemToggle = (item: string) => {
    setFormData((prev) => ({
      ...prev,
      heavyItems: prev.heavyItems.includes(item)
        ? prev.heavyItems.filter((i) => i !== item)
        : [...prev.heavyItems, item],
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      const newPhotos: UploadedFile[] = Array.from(files).map((file, idx) => ({
        id: `photo-${Date.now()}-${idx}`,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        previewUrl: URL.createObjectURL(file),
        file,
        type: file.type.startsWith("image") ? "image" : "video",
      }));
      setFormData((prev) => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos],
      }));
    }
  };

  const removePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) {
      return formData.serviceType && formData.description;
    }
    if (currentStep === 3) {
      return formData.address && formData.city;
    }
    if (currentStep === 6) {
      return formData.contactName && formData.contactPhone;
    }
    return true;
  };

  const handleConfirmOrder = async () => {
    if (!canProceedToNextStep()) return;

    setIsSubmitting(true);
    try {

      const res = await fetch("/api/simulador/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: {
            serviceType: formData.serviceType,
            description: formData.description,
            receiver: {
              name: formData.contactName,
              phone: formData.contactPhone,
              email: formData.contactEmail,
            },
            address: {
              formattedAddress: formData.address,
              city: formData.city,
            },
            floor: formData.floor,
            hasElevator: formData.hasElevator,
            parkingDistance: formData.parkingDistance,
            urgency: formData.urgency,
            files: formData.photos,
          },
          estimate: {
            status: "estimated",
            estimatedPriceWithoutVat: 150,
            vatAmount: 34.5,
            estimatedPriceWithVat: 184.5,
            difficultyLevel: 2,
            summary: `${formData.serviceType} - ${formData.description}`,
            customerMessage: "Pedido recebido com sucesso",
          },
          chatHistory: [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.removeItem("clyon_simulator_form_draft");
        setFormData({
          serviceType: "",
          description: "",
          volume: "",
          heavyItems: [],
          needsDismantling: "",
          photos: [],
          address: "",
          city: "",
          floor: "",
          hasElevator: "",
          parkingDistance: "",
          difficultAccess: "",
          urgency: "",
          contactName: "",
          contactPhone: "",
          contactEmail: "",
        });
        setCurrentStep(7); // Success screen
      } else {
        const error = await res.json();
        console.error("[v0] SimulatorMultiStepForm: ❌ Error", error);
        alert("Erro ao guardar pedido. Tente novamente.");
      }
    } catch (err) {
      console.error("[v0] SimulatorMultiStepForm: ❌ Network error", err);
      alert("Erro de conexão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    localStorage.removeItem("clyon_simulator_form_draft");
    setFormData({
      serviceType: "",
      description: "",
      volume: "",
      heavyItems: [],
      needsDismantling: "",
      photos: [],
      address: "",
      city: "",
      floor: "",
      hasElevator: "",
      parkingDistance: "",
      difficultAccess: "",
      urgency: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    });
    setCurrentStep(1);
  };

  // Success screen
  if (currentStep === 7) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-lg">
            <div className="flex justify-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Pedido Enviado com Sucesso</h2>
            <p className="text-slate-600 mb-6">
              A equipa CLYON recebeu os seus dados e irá analisar o pedido. Entraremos em contacto em breve para confirmar o orçamento.
            </p>
            <button
              onClick={resetForm}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Novo Pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-3 mb-4 bg-cyan-50 px-4 py-2 rounded-lg">
            <div className="w-8 h-8 bg-cyan-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              📋
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Simulador de Preços CLYON</h1>
          </div>
          <p className="text-slate-600">Preencha os dados do seu serviço, envie fotos e a CLYON analisa o pedido</p>
        </div>

        {/* Steps indicator */}
        <div className="mb-12 flex justify-between">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div key={step} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  currentStep >= step
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {step}
              </div>
              <div className="text-xs text-slate-600 mt-2 text-center">
                {["Serviço", "Fotos", "Morada", "Acesso", "Urgência", "Contacto"][step - 1]}
              </div>
              {step < 6 && (
                <div
                  className={`h-1 flex-1 mx-2 mt-4 rounded ${
                    currentStep > step ? "bg-cyan-600" : "bg-slate-200"
                  }`}
                  style={{ margin: "0 -0.5rem" }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              {/* Step 1: Service Type */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Que serviço precisa? <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.serviceType}
                      onChange={(e) => handleChange("serviceType", e.target.value)}
                      className="clyon-select w-full border border-slate-300 rounded-lg pl-4 py-2.5 text-sm"
                    >
                      <option value="">Seleccione um serviço</option>
                      {SERVICES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Descrição do que precisa recolher <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                      placeholder="Ex: sofá grande, cama com colchão, 20 sacos de entulho..."
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 h-24 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Volume aproximado
                      </label>
                      <select
                        value={formData.volume}
                        onChange={(e) => handleChange("volume", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Seleccione</option>
                        {VOLUMES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Desmontagem
                      </label>
                      <select
                        value={formData.needsDismantling}
                        onChange={(e) => handleChange("needsDismantling", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Seleccione</option>
                        <option value="Não">Não</option>
                        <option value="Simples">Sim, simples</option>
                        <option value="Média">Sim, média</option>
                        <option value="Demorada">Sim, demorada</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Existem objetos pesados?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {HEAVY_ITEMS.map((item) => (
                        <label key={item} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.heavyItems.includes(item)}
                            onChange={() => handleHeavyItemToggle(item)}
                            className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className="text-sm text-slate-700">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Photos */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Adicione fotos ou vídeos (opcional)
                    </label>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-500 transition">
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label htmlFor="photo-upload" className="cursor-pointer block">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-900">Clique para seleccionar ou arraste ficheiros</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG, MP4 (max 100MB cada)</p>
                      </label>
                    </div>
                    {formData.photos.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-slate-600 mb-3">{formData.photos.length} ficheiros enviados</p>
                        <div className="grid grid-cols-4 gap-3">
                          {formData.photos.map((photo, idx) => (
                            <div key={photo.id} className="relative group">
                              <img
                                src={photo.previewUrl || ""}
                                alt="preview"
                                className="w-full h-24 object-cover rounded-lg"
                              />
                              <button
                                onClick={() => removePhoto(idx)}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Address */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Morada completa <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        placeholder="Ex: Rua Principal, 123, Lisboa"
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Localidade <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="Ex: Lisboa"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Access */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Em que andar está o material?
                    </label>
                    <select
                      value={formData.floor}
                      onChange={(e) => handleChange("floor", e.target.value)}
                      className="clyon-select w-full border border-slate-300 rounded-lg pl-4 py-2.5 text-sm"
                    >
                      <option value="">Seleccione</option>
                      {FLOORS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">Tem elevador?</label>
                    <select
                      value={formData.hasElevator}
                      onChange={(e) => handleChange("hasElevator", e.target.value)}
                      className="clyon-select w-full border border-slate-300 rounded-lg pl-4 py-2.5 text-sm"
                    >
                      <option value="">Seleccione</option>
                      <option value="Sim, funciona">Sim, funciona</option>
                      <option value="Sim, mas é pequeno">Sim, mas é pequeno</option>
                      <option value="Não tem elevador">Não tem elevador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      A carrinha consegue estacionar perto?
                    </label>
                    <select
                      value={formData.parkingDistance}
                      onChange={(e) => handleChange("parkingDistance", e.target.value)}
                      className="clyon-select w-full border border-slate-300 rounded-lg pl-4 py-2.5 text-sm"
                    >
                      <option value="">Seleccione</option>
                      <option value="Sim, mesmo à porta">Sim, mesmo à porta</option>
                      <option value="Sim, até 20 metros">Sim, até 20 metros</option>
                      <option value="Mais de 30 metros">Mais de 30 metros</option>
                      <option value="Estacionamento difícil">Estacionamento difícil</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Há acesso complicado?
                    </label>
                    <select
                      value={formData.difficultAccess}
                      onChange={(e) => handleChange("difficultAccess", e.target.value)}
                      className="clyon-select w-full border border-slate-300 rounded-lg pl-4 py-2.5 text-sm"
                    >
                      <option value="">Seleccione</option>
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                      <option value="Não sei">Não sei</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 5: Urgency */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Quando precisa do serviço?
                    </label>
                    <select
                      value={formData.urgency}
                      onChange={(e) => handleChange("urgency", e.target.value)}
                      className="clyon-select w-full border border-slate-300 rounded-lg pl-4 py-2.5 text-sm"
                    >
                      <option value="">Seleccione</option>
                      {URGENCIES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Step 6: Contact */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Nome <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => handleChange("contactName", e.target.value)}
                      placeholder="Ex: Eugênia Almeida"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">
                      Telefone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) => handleChange("contactPhone", e.target.value)}
                        placeholder="Ex: 911128863"
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-3">E-mail (opcional)</label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => handleChange("contactEmail", e.target.value)}
                      placeholder="Ex: eugenia@example.com"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between gap-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep === 1}
                  className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => {
                    if (currentStep === 6) {
                      handleConfirmOrder();
                    } else if (canProceedToNextStep()) {
                      setCurrentStep(Math.min(6, currentStep + 1));
                    }
                  }}
                  disabled={!canProceedToNextStep() || isSubmitting}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {currentStep === 6 ? (isSubmitting ? "Guardando..." : "Enviar Pedido") : "Seguinte →"}
                </button>
              </div>
            </div>
          </div>

          {/* Summary sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <button
                onClick={() => setExpandedSummary(!expandedSummary)}
                className="w-full flex items-center justify-between mb-4 pb-4 border-b border-slate-200"
              >
                <h3 className="font-semibold text-slate-900">Resumo do Pedido</h3>
                <ChevronDown
                  className={`w-5 h-5 text-slate-600 transition ${expandedSummary ? "rotate-180" : ""}`}
                />
              </button>

              {expandedSummary && (
                <div className="space-y-3 text-sm">
                  {formData.serviceType && (
                    <div>
                      <p className="text-slate-600">Serviço</p>
                      <p className="font-medium text-slate-900">{formData.serviceType}</p>
                    </div>
                  )}
                  {formData.description && (
                    <div>
                      <p className="text-slate-600">Descrição</p>
                      <p className="font-medium text-slate-900 line-clamp-2">{formData.description}</p>
                    </div>
                  )}
                  {formData.address && (
                    <div>
                      <p className="text-slate-600">Morada</p>
                      <p className="font-medium text-slate-900">{formData.address}</p>
                    </div>
                  )}
                  {formData.contactName && (
                    <div>
                      <p className="text-slate-600">Contacto</p>
                      <p className="font-medium text-slate-900">{formData.contactName}</p>
                      <p className="text-slate-600">{formData.contactPhone}</p>
                    </div>
                  )}
                  {formData.photos.length > 0 && (
                    <div>
                      <p className="text-slate-600">{formData.photos.length} fotos</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
