"use client";

import { useState } from "react";
import type { ReceiverData, AddressData, DistanceFromBase, DistanceStatus } from "../types";
import AddressAutocomplete from "./AddressAutocomplete";

interface ContactAccessFormProps {
  onSubmit: (data: {
    receiver: ReceiverData;
    address: AddressData;
    addressText: string;
    distanceFromBase?: DistanceFromBase;
    distanceStatus?: DistanceStatus;
  }) => void;
  loading?: boolean;
  // Pré-preenchimento do Gemini
  initialReceiver?: ReceiverData;
  initialAddress?: AddressData;
}

export default function ContactAccessForm({ onSubmit, loading, initialReceiver, initialAddress }: ContactAccessFormProps) {
  const [name, setName] = useState(initialReceiver?.name ?? "");
  const [phone, setPhone] = useState(initialReceiver?.phone ?? "");
  const [email, setEmail] = useState(initialReceiver?.email ?? "");
  const [addressText, setAddressText] = useState((initialAddress?.formattedAddress || initialAddress?.city) ?? "");
  const [addressData, setAddressData] = useState<AddressData>(initialAddress ?? {});
  const [distanceFromBase, setDistanceFromBase] = useState<DistanceFromBase | undefined>();
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome obrigatório";
    if (!phone.trim()) e.phone = "Telefone obrigatório";
    else if (!/^[+\d\s\-()]{9,}$/.test(phone)) e.phone = "Número inválido";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "E-mail inválido";
    if (!addressText.trim()) e.address = "Morada obrigatória";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      receiver: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined },
      address: addressData,
      addressText: addressText.trim(),
      distanceFromBase: distanceStatus === "calculated" ? distanceFromBase : undefined,
      distanceStatus,
    });
  };

  const inputCls =
    "w-full pl-8 pr-3 py-2 rounded-xl border border-[#E2E8F0] text-[13px] text-[#102033] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0487D9]/30 focus:border-[#0487D9] transition-colors bg-white";

  return (
    <div className="mt-2 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
      <p className="text-[13px] font-semibold text-[#102033] mb-0.5">
        Dados para contacto e acesso
      </p>
      <p className="text-[11px] text-[#64748B] mb-3">
        Usados para confirmar o orçamento, localizar a morada e organizar a equipa.
      </p>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Row 1: Nome | Telefone | Email */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Nome */}
          <div>
            <label className="block text-[11px] font-medium text-[#475569] mb-1">Nome *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome"
                className={inputCls}
              />
            </div>
            {errors.name && <p className="text-[11px] text-red-500 mt-0.5">{errors.name}</p>}
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-[11px] font-medium text-[#475569] mb-1">Telefone *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="912 345 678"
                className={inputCls}
              />
            </div>
            {errors.phone && <p className="text-[11px] text-red-500 mt-0.5">{errors.phone}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-medium text-[#475569] mb-1">
              E-mail <span className="text-[#94A3B8]">(opcional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className={inputCls}
              />
            </div>
            {errors.email && <p className="text-[11px] text-red-500 mt-0.5">{errors.email}</p>}
          </div>
        </div>

        {/* Row 2: Morada (largura total) com autocomplete + botão distância */}
        <div>
          <label className="block text-[11px] font-medium text-[#475569] mb-1">
            Morada do serviço *
          </label>
          <AddressAutocomplete
            value={addressText}
            onChange={(v) => {
              setAddressText(v);
              if (errors.address) setErrors((prev) => ({ ...prev, address: "" }));
            }}
            onSelect={(data) => {
              setAddressData(data);
              setAddressText(data.formattedAddress ?? addressText);
            }}
            onDistanceCalculated={(dist, status) => {
              setDistanceFromBase(dist);
              setDistanceStatus(status);
            }}
            placeholder="Escreva a rua, número e localidade..."
          />
          {errors.address && <p className="text-[11px] text-red-500 mt-0.5">{errors.address}</p>}
        </div>

        {/* Botão enviar */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-[#0487D9] hover:bg-[#036BB0] text-white text-[13px] font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                A processar...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Enviar detalhes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
