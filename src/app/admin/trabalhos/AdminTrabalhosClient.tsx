"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { tService } from "@/lib/translations";
import type { TrabalhoRealizadoData } from "@/lib/db";

// ─── Tipos ────────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { value: "recolha_moveis",           label: "Recolha de móveis" },
  { value: "recolha_monos",            label: "Recolha de monos" },
  { value: "recolha_entulho",          label: "Recolha de entulho" },
  { value: "esvaziamento_casa",        label: "Esvaziamento de casa" },
  { value: "esvaziamento_apartamento", label: "Esvaziamento de apartamento" },
  { value: "mudanca",                  label: "Mudança" },
  { value: "outro",                    label: "Outro serviço" },
];

// ─── Estilos base ─────────────────────────────────────────────────────────────

const inputCls   = "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition";
const selectCls  = inputCls + " cursor-pointer";
const labelCls   = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5";

// ─── Formulário inline ────────────────────────────────────────────────────────

interface FormState {
  fotos: string[];
  tipoServico: string;
  localidade: string;
  descricao: string;
  publicado: boolean;
}

const EMPTY_FORM: FormState = {
  fotos: [],
  tipoServico: "",
  localidade: "",
  descricao: "",
  publicado: false,
};

interface TrabalhoFormProps {
  initial?: TrabalhoRealizadoData;
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
}

function TrabalhoForm({ initial, onSave, onCancel }: TrabalhoFormProps) {
  const [form, setForm]         = useState<FormState>(
    initial
      ? { fotos: initial.fotos, tipoServico: initial.tipoServico, localidade: initial.localidade, descricao: initial.descricao ?? "", publicado: initial.publicado }
      : EMPTY_FORM
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof FormState, v: FormState[typeof k]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("fotos", f));
      const res = await fetch("/api/admin/trabalhos/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");
      set("fotos", [...form.fotos, ...data.urls]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto(url: string) {
    set("fotos", form.fotos.filter((u) => u !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fotos.length)  { setError("Adiciona pelo menos uma foto."); return; }
    if (!form.tipoServico)   { setError("Selecciona o tipo de serviço."); return; }
    if (!form.localidade.trim()) { setError("Preenche a localidade."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Fotos */}
      <div>
        <label className={labelCls}>Fotos</label>
        <div className="flex flex-wrap gap-3 mb-3">
          {form.fotos.map((url) => (
            <div key={url} className="relative h-24 w-24 rounded-2xl overflow-hidden border border-white/10 group">
              <Image src={url} alt="Foto do trabalho" fill className="object-cover" sizes="96px" />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition text-white text-lg"
                title="Remover"
              >
                &times;
              </button>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-slate-500 hover:border-cyan-400/40 hover:text-cyan-400 transition">
            {uploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Tipo de serviço */}
      <div>
        <label className={labelCls}>Tipo de serviço</label>
        <select value={form.tipoServico} onChange={(e) => set("tipoServico", e.target.value)} className={selectCls}>
          <option value="">Seleccionar...</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Localidade */}
      <div>
        <label className={labelCls}>Localidade</label>
        <input
          type="text"
          value={form.localidade}
          onChange={(e) => set("localidade", e.target.value)}
          className={inputCls}
          placeholder="Ex: Seixal, Lisboa..."
          maxLength={120}
        />
      </div>

      {/* Descrição */}
      <div>
        <label className={labelCls}>Descrição (opcional)</label>
        <textarea
          rows={3}
          value={form.descricao}
          onChange={(e) => set("descricao", e.target.value)}
          className={inputCls}
          placeholder="Breve descrição do trabalho realizado..."
          maxLength={500}
        />
      </div>

      {/* Publicado */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => set("publicado", !form.publicado)}
          className={`relative h-6 w-11 rounded-full transition-colors ${form.publicado ? "bg-cyan-500" : "bg-white/10"}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.publicado ? "translate-x-5" : ""}`} />
        </div>
        <span className="text-sm text-slate-300">Publicado — visível em clyon.pt/trabalhos</span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || uploading}
          className="flex-1 rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-50 transition"
        >
          {saving ? "A guardar..." : initial ? "Guardar alterações" : "Adicionar trabalho"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:border-white/20 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Card de trabalho na lista ────────────────────────────────────────────────

interface TrabalhoCardProps {
  trabalho: TrabalhoRealizadoData;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}

function TrabalhoCard({ trabalho, onEdit, onDelete, onTogglePublish }: TrabalhoCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Eliminar este trabalho?")) return;
    setDeleting(true);
    onDelete();
  }

  const thumb = trabalho.fotos[0];

  return (
    <article className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col">
      {/* Thumb */}
      <div className="relative h-44 bg-white/[0.03] flex-shrink-0">
        {thumb ? (
          <Image src={thumb} alt={tService(trabalho.tipoServico)} fill className="object-cover" sizes="(max-width: 768px) 100vw, 400px" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {/* Badge publicado */}
        <button
          onClick={onTogglePublish}
          className={`absolute top-3 right-3 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition ${
            trabalho.publicado
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
              : "bg-slate-500/20 text-slate-400 border border-white/10 hover:bg-white/10"
          }`}
          title={trabalho.publicado ? "Clica para ocultar" : "Clica para publicar"}
        >
          {trabalho.publicado ? "Publicado" : "Rascunho"}
        </button>
        {/* Contador fotos */}
        {trabalho.fotos.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-xl bg-black/50 px-2 py-0.5 text-[11px] text-slate-300">
            {trabalho.fotos.length} fotos
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{tService(trabalho.tipoServico)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{trabalho.localidade}</p>
          </div>
        </div>
        {trabalho.descricao && (
          <p className="text-xs text-slate-400 leading-5 line-clamp-2">{trabalho.descricao}</p>
        )}
        <div className="flex gap-2 mt-auto pt-3">
          <button
            onClick={onEdit}
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-white/20 transition"
          >
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition"
          >
            {deleting ? "..." : "Eliminar"}
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminTrabalhosClient() {
  const [trabalhos, setTrabalhos] = useState<TrabalhoRealizadoData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<TrabalhoRealizadoData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trabalhos");
      const data = await res.json();
      setTrabalhos(data.trabalhos ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(form: FormState) {
    const res = await fetch("/api/admin/trabalhos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
    setShowForm(false);
    await load();
  }

  async function handleUpdate(id: number, form: FormState) {
    const res = await fetch(`/api/admin/trabalhos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao actualizar");
    setEditing(null);
    await load();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/admin/trabalhos/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleTogglePublish(t: TrabalhoRealizadoData) {
    await fetch(`/api/admin/trabalhos/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicado: !t.publicado }),
    });
    await load();
  }

  const publishedCount = trabalhos.filter((t) => t.publicado).length;

  return (
    <div className="min-h-screen bg-[#0A1220] px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Trabalhos Realizados</h1>
          <p className="mt-1 text-sm text-slate-500">
            {trabalhos.length} total &middot; {publishedCount} publicados
          </p>
        </div>
        {!showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar trabalho
          </button>
        )}
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <section className="mb-8 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="mb-5 text-base font-semibold text-white">Novo trabalho</h2>
          <TrabalhoForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </section>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="w-8 h-8 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : trabalhos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.04] text-slate-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-500">Ainda não há trabalhos. Adiciona o primeiro.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trabalhos.map((t) =>
            editing?.id === t.id ? (
              <div key={t.id} className="sm:col-span-2 lg:col-span-3 xl:col-span-4 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-5 text-base font-semibold text-white">Editar trabalho</h2>
                <TrabalhoForm
                  initial={editing}
                  onSave={(form) => handleUpdate(t.id, form)}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <TrabalhoCard
                key={t.id}
                trabalho={t}
                onEdit={() => setEditing(t)}
                onDelete={() => handleDelete(t.id)}
                onTogglePublish={() => handleTogglePublish(t)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
