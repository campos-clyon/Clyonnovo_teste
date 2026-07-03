"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import type { UserProfile } from "./types";

interface Props {
  user: UserProfile;
  onUpdate: (updated: Partial<UserProfile>) => void;
}

function Field({
  label, id, value, onChange, placeholder, maxLength,
}: {
  label: string; id: string; value: string;
  onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <input
        id={id} type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-[#00B4D8] focus:ring-2 focus:ring-[#00B4D8]/10"
      />
    </div>
  );
}

export default function Faturacao({ user, onUpdate }: Props) {
  const [billingName,      setBillingName]      = useState(user.billingName ?? "");
  const [billingNif,       setBillingNif]        = useState(user.billingNif ?? "");
  const [billingAddress,   setBillingAddress]   = useState(user.billingAddress ?? "");
  const [billingPostalCode,setBillingPostalCode] = useState(user.billingPostalCode ?? "");
  const [billingCity,      setBillingCity]      = useState(user.billingCity ?? "");
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  /* ---- sincronizar campos com user prop (quando os dados são carregados da API) ---- */
  useEffect(() => {
    setBillingName(user.billingName ?? "");
    setBillingNif(user.billingNif ?? "");
    setBillingAddress(user.billingAddress ?? "");
    setBillingPostalCode(user.billingPostalCode ?? "");
    setBillingCity(user.billingCity ?? "");
  }, [user]);

  const handleSave = async () => {
    if (billingNif && !/^\d{9}$/.test(billingNif)) {
      setError("O NIF deve ter exactamente 9 dígitos.");
      return;
    }
    setSaving(true); setSuccess(false); setError("");
    try {
      const payload = {
        billingName: billingName || null,
        billingNif: billingNif || null,
        billingAddress: billingAddress || null,
        billingPostalCode: billingPostalCode || null,
        billingCity: billingCity || null,
      };
      console.log("[v0] Faturacao: enviando PATCH com payload:", payload);
      
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      console.log("[v0] Faturacao: resposta status:", res.status, "ok:", res.ok);
      
      const data = await res.json() as { success?: boolean; error?: string };
      console.log("[v0] Faturacao: resposta JSON:", JSON.stringify(data, null, 2));
      
      if (!res.ok || !data.success) {
        const errorMsg = data.error ?? `Erro ao guardar (status ${res.status}).`;
        console.error("[v0] Faturacao: erro na resposta:", errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log("[v0] Faturacao: sucesso! A guardar no estado local.");
      setSuccess(true);
      onUpdate({
        billingName: billingName || null,
        billingNif: billingNif || null,
        billingAddress: billingAddress || null,
        billingPostalCode: billingPostalCode || null,
        billingCity: billingCity || null,
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Não foi possível guardar. Tenta novamente.";
      console.error("[v0] Faturacao: erro catch:", errorMsg);
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Faturação</h2>
        <p className="mt-0.5 text-sm text-slate-500">Dados para emissão de faturas.</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[#00B4D8]/20 bg-[#00B4D8]/5 px-5 py-4 text-sm text-[#0077B6]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Estes dados são usados para emitir faturas dos teus pedidos. Se a morada de faturação for igual à pessoal, deixa em branco.
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome ou empresa" id="billingName" value={billingName} onChange={setBillingName} placeholder="Nome Completo ou Empresa Lda." />
          </div>
          <div className="sm:col-span-2">
            <Field label="NIF (9 dígitos)" id="billingNif" value={billingNif} onChange={setBillingNif} placeholder="123456789" maxLength={9} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Morada de faturação" id="billingAddress" value={billingAddress} onChange={setBillingAddress} placeholder="Rua e número" />
          </div>
          <div>
            <Field label="Código postal" id="billingPostalCode" value={billingPostalCode} onChange={setBillingPostalCode} placeholder="1000-001" />
          </div>
          <div>
            <Field label="Cidade" id="billingCity" value={billingCity} onChange={setBillingCity} placeholder="Lisboa" />
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Dados de faturação guardados.
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-xl bg-[#0077B6] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005f96] disabled:opacity-60"
          >
            {saving ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
