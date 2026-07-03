"use client";

import { useState } from "react";
import type { UserProfile } from "./types";

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  saving: boolean;
}

function Toggle({ id, label, description, checked, onChange, saving }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={saving}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4D8]/40 disabled:opacity-50 ${
          checked ? "bg-[#00B4D8]" : "bg-slate-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

interface Props {
  user: UserProfile;
  onUpdate: (updated: Partial<UserProfile>) => void;
}

export default function Notificacoes({ user, onUpdate }: Props) {
  const [notifOrderStatus,  setNotifOrderStatus]  = useState(!!user.notifOrderStatus);
  const [notifWeeklyDigest, setNotifWeeklyDigest] = useState(!!user.notifWeeklyDigest);
  const [notifWhatsapp,     setNotifWhatsapp]      = useState(!!user.notifWhatsapp);
  const [saving, setSaving] = useState(false);

  const save = async (patch: Partial<UserProfile>) => {
    setSaving(true);
    try {
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      onUpdate(patch);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Notificações</h2>
        <p className="mt-0.5 text-sm text-slate-500">Gere como queres ser notificado sobre os teus pedidos.</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white px-6 shadow-sm divide-y divide-slate-100">
        <Toggle
          id="notif-order"
          label="Estado do pedido"
          description="Recebe um email quando o estado do teu pedido mudar."
          checked={notifOrderStatus}
          saving={saving}
          onChange={(v) => {
            setNotifOrderStatus(v);
            void save({ notifOrderStatus: v ? 1 : 0 });
          }}
        />
        <Toggle
          id="notif-weekly"
          label="Resumo semanal"
          description="Um email semanal com o resumo dos teus pedidos activos."
          checked={notifWeeklyDigest}
          saving={saving}
          onChange={(v) => {
            setNotifWeeklyDigest(v);
            void save({ notifWeeklyDigest: v ? 1 : 0 });
          }}
        />
        <Toggle
          id="notif-whatsapp"
          label="WhatsApp"
          description="Actualizações do pedido via WhatsApp (requer número verificado)."
          checked={notifWhatsapp}
          saving={saving}
          onChange={(v) => {
            setNotifWhatsapp(v);
            void save({ notifWhatsapp: v ? 1 : 0 });
          }}
        />
      </div>
    </div>
  );
}
