"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  LockKeyhole,
  CheckCircle2,
  AlertCircle,
  Camera,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { UserProfile } from "./types";

/* ------------------------------------------------------------------ */
/* Utilitário: gerar imagem cortada a partir do canvas                  */
/* ------------------------------------------------------------------ */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width  = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas vazio"))), "image/png"),
  );
}

/* ------------------------------------------------------------------ */
/* Validação async de telefone único (substituir por chamada real)      */
/* ------------------------------------------------------------------ */
async function checkPhoneUnique(phone: string, currentEmail: string): Promise<boolean> {
  if (!phone.trim()) return true;
  const res = await fetch(
    `/api/users/check-unique?phone=${encodeURIComponent(phone)}&excludeEmail=${encodeURIComponent(currentEmail)}`,
  );
  if (!res.ok) return true; // em caso de erro, não bloquear
  const data = await res.json() as { available: boolean };
  return data.available;
}

/* ------------------------------------------------------------------ */
/* Campo de formulário reutilizável                                     */
/* ------------------------------------------------------------------ */
function Field({
  label, id, value, onChange, type = "text", placeholder, readOnly, hint, error,
}: {
  label: string; id: string; value: string;
  onChange?: (v: string) => void; type?: string;
  placeholder?: string; readOnly?: boolean; hint?: string; error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          placeholder={placeholder}
          className={`h-11 w-full min-w-0 rounded-xl border px-4 text-sm outline-none transition ${
            readOnly
              ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
              : error
              ? "border-red-300 bg-white text-slate-800 focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "border-slate-200 bg-white text-slate-800 focus:border-[#00B4D8] focus:ring-2 focus:ring-[#00B4D8]/10"
          } ${readOnly ? "pr-10" : ""}`}
          style={{ overflow: "hidden", textOverflow: "ellipsis" }}
        />
        {readOnly && (
          <LockKeyhole className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
        )}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
      {hint && !error && (
        <p className="mt-1 break-words text-xs leading-snug text-slate-400">{hint}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal de crop                                                        */
/* ------------------------------------------------------------------ */
function AvatarCropModal({
  imageSrc,
  onCancel,
  onSave,
}: {
  imageSrc: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  const [crop,      setCrop]      = useState({ x: 0, y: 0 });
  const [zoom,      setZoom]      = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixelCrop: Area) => {
    setCroppedArea(pixelCrop);
  }, []);

  const handleSave = async () => {
    if (!croppedArea) return;
    const blob = await getCroppedImg(imageSrc, croppedArea);
    onSave(blob);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Ajustar foto</h3>
          <button type="button" onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Área de crop */}
        <div className="relative h-64 w-full overflow-hidden rounded-xl bg-slate-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Controlo de zoom */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-[#0077B6]"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={1} max={3} step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#00B4D8]"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-[#0077B6]"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-[#0077B6] py-2.5 text-sm font-semibold text-white transition hover:bg-[#005f96]"
          >
            Guardar foto
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                 */
/* ------------------------------------------------------------------ */
interface Props {
  user: UserProfile;
  googleAvatar: string | null;
  onUpdate: (updated: Partial<UserProfile>) => void;
}

export default function DadosPessoais({ user, googleAvatar, onUpdate }: Props) {
  /* ---- estado do formulário ---- */
  const [name,          setName]          = useState(user.name ?? "");
  const [phone,         setPhone]         = useState(user.phone ?? "");
  const [addressLine,   setAddressLine]   = useState(user.addressLine ?? "");
  const [addressNumber, setAddressNumber] = useState(user.addressNumber ?? "");
  const [postalCode,    setPostalCode]    = useState(user.postalCode ?? "");
  const [addressCity,   setAddressCity]   = useState(user.addressCity ?? "");

  /* ---- sincronizar campos com user prop (quando os dados são carregados da API) ---- */
  useEffect(() => {
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
    setAddressLine(user.addressLine ?? "");
    setAddressNumber(user.addressNumber ?? "");
    setPostalCode(user.postalCode ?? "");
    setAddressCity(user.addressCity ?? "");
    setAvatarPreview(user.avatarUrl ?? googleAvatar ?? null);
  }, [user, googleAvatar]);

  /* ---- avatar ---- */
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatarUrl ?? googleAvatar ?? null,
  );
  const [cropSrc,    setCropSrc]    = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- feedback ---- */
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /* ---- abrir seletor de ficheiro ---- */
  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    // Limpar o input para permitir seleccionar o mesmo ficheiro duas vezes
    e.target.value = "";
  };

  /* ---- guardar avatar após crop ---- */
  const handleAvatarSave = async (blob: Blob) => {
    setCropSrc(null);
    setAvatarSaving(true);
    const previewUrl = URL.createObjectURL(blob);
    setAvatarPreview(previewUrl);

    try {
      const fd = new FormData();
      fd.append("file", blob, "avatar.png");
      
      const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
      const data = await res.json() as { url?: string; error?: string; message?: string };
      
      // Status 501 significa endpoint desativado (temporariamente)
      if (res.status === 501) {
        const msg = data.message || "Alteração de foto temporariamente indisponível. A foto da tua conta Google continuará a ser usada.";
        throw new Error(msg);
      }
      
      if (!res.ok || !data.url) {
        const errorMsg = data.error ?? `Erro ao guardar foto (status ${res.status}).`;
        throw new Error(errorMsg);
      }
      
      setAvatarPreview(data.url);
      onUpdate({ avatarUrl: data.url });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao guardar foto.";
      setErrorGlobal(errorMsg);
      // Reverter para avatar anterior em caso de erro
      setAvatarPreview(user.avatarUrl ?? googleAvatar ?? null);
    } finally {
      setAvatarSaving(false);
    }
  };

  /* ---- validação e guardar formulário ---- */
  const handleSave = async () => {
    setSaving(true); setSuccess(false); setErrorGlobal(""); setFieldErrors({});

    // Validação de nome
    if (!name.trim()) {
      setFieldErrors({ name: "O nome é obrigatório." });
      setSaving(false);
      return;
    }

    // Validar telefone único
    if (phone.trim() && phone.trim() !== (user.phone ?? "")) {
      const phoneOk = await checkPhoneUnique(phone.trim(), user.email);
      if (!phoneOk) {
        setFieldErrors({ phone: "Este número já está associado a outra conta." });
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        addressLine: addressLine.trim() || null,
        addressNumber: addressNumber.trim() || null,
        postalCode: postalCode.trim() || null,
        addressCity: addressCity.trim() || null,
      };
      
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json() as { success?: boolean; error?: string };
      
      if (!res.ok || !data.success) {
        const errorMsg = data.error ?? `Erro ao guardar (status ${res.status}).`;
        throw new Error(errorMsg);
      }
      setSuccess(true);
      onUpdate({
        name: name.trim(),
        phone: phone.trim() || null,
        addressLine: addressLine.trim() || null,
        addressNumber: addressNumber.trim() || null,
        postalCode: postalCode.trim() || null,
        addressCity: addressCity.trim() || null,
      });
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Não foi possível guardar. Tenta novamente.";
      console.error("[v0] DadosPessoais: erro catch:", errorMsg);
      setErrorGlobal(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const displayName = name.trim() || user.email;

  return (
    <>
      {/* Modal de crop — renderizado fora do fluxo normal */}
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onSave={handleAvatarSave}
        />
      )}

      {/* Input oculto para selecção de ficheiro */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />

      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dados pessoais</h2>
          <p className="mt-0.5 text-sm text-slate-500">Informações da tua conta CLYON.</p>
        </div>

        {/* Cartão de avatar */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="relative shrink-0">
            <UserAvatar src={avatarPreview} name={name || user.email} size={64} />
            {avatarSaving && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {user.avatarUrl ? "Foto personalizada" : "Foto sincronizada com a tua conta Google"}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePickFile}
            disabled={avatarSaving}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-500 transition hover:border-[#00B4D8] hover:text-[#0077B6] disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" />
            Alterar foto
          </button>
        </div>

        {/* Formulário */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">

            {/* Nome */}
            <div className="sm:col-span-2">
              <Field
                label="Nome completo"
                id="name"
                value={name}
                onChange={(v) => { setName(v); setFieldErrors((p) => ({ ...p, name: "" })); }}
                placeholder="O teu nome completo"
                error={fieldErrors.name}
              />
            </div>

            {/* Email — read-only com overflow corrigido */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </label>
              <div className="relative flex h-11 w-full min-w-0 items-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 px-4 pr-10">
                <span
                  className="flex-1 truncate text-sm text-slate-400"
                  title={user.email}
                >
                  {user.email}
                </span>
                <LockKeyhole className="absolute right-3 h-3.5 w-3.5 shrink-0 text-slate-300" />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Gerido pela tua conta Google — não pode ser alterado aqui.
              </p>
            </div>

            {/* Telefone */}
            <div className="sm:col-span-2">
              <Field
                label="Telefone"
                id="phone"
                type="tel"
                value={phone}
                onChange={(v) => { setPhone(v); setFieldErrors((p) => ({ ...p, phone: "" })); }}
                placeholder="+351 9xx xxx xxx"
                error={fieldErrors.phone}
              />
            </div>

            {/* Morada */}
            <div>
              <Field
                label="Rua / Avenida"
                id="addressLine"
                value={addressLine}
                onChange={setAddressLine}
                placeholder="Rua de exemplo"
              />
            </div>
            <div>
              <Field
                label="Número / Andar"
                id="addressNumber"
                value={addressNumber}
                onChange={setAddressNumber}
                placeholder="12, 2.º Esq."
              />
            </div>
            <div>
              <Field
                label="Código postal"
                id="postalCode"
                value={postalCode}
                onChange={setPostalCode}
                placeholder="1000-001"
              />
            </div>
            <div>
              <Field
                label="Cidade"
                id="addressCity"
                value={addressCity}
                onChange={setAddressCity}
                placeholder="Lisboa"
              />
            </div>
          </div>

          {/* Feedback */}
          {errorGlobal && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorGlobal}</span>
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Dados guardados com sucesso.
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-xl bg-gradient-to-r from-[#00B4D8] to-[#0077B6] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "A guardar..." : "Guardar alterações"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
