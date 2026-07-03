"use client";

import type { ReactNode } from "react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearColaboradorStorage, getColaboradorItem } from "@/lib/colaborador-storage";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Images,
  LayoutGrid,
  Loader2,
  RefreshCcw,
  Save,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type GallerySection = "hero" | "showcase";
type GalleryPhase = "" | "before" | "during" | "after";

type GalleryItem = {
  id: string;
  section: GallerySection;
  title: string;
  subtitle?: string;
  description?: string;
  alt: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  projectKey?: string;
  phase?: GalleryPhase;
};

type GalleryFormState = {
  section: GallerySection;
  title: string;
  subtitle: string;
  description: string;
  alt: string;
  imageUrl: string;
  order: string;
  projectKey: string;
  phase: GalleryPhase;
  isActive: boolean;
};

const defaultForm: GalleryFormState = {
  section: "hero",
  title: "",
  subtitle: "",
  description: "",
  alt: "",
  imageUrl: "",
  order: "1",
  projectKey: "",
  phase: "",
  isActive: true,
};

const uploadTargets: Record<GallerySection, { maxDimension: number; quality: number }> = {
  hero: { maxDimension: 1800, quality: 0.8 },
  showcase: { maxDimension: 1600, quality: 0.78 },
};

async function readResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text }; }
}

function phaseLabel(phase?: GalleryPhase) {
  if (phase === "before") return "Antes";
  if (phase === "during") return "Durante";
  if (phase === "after") return "Depois";
  return "—";
}

function previewLabel(value: string) {
  if (!value) return "Sem imagem definida";
  if (value.startsWith("data:image/")) return "Imagem interna (base64)";
  if (value.length > 80) return `${value.slice(0, 77)}...`;
  return value;
}

function canOptimizeFile(file: File) {
  return file.type.startsWith("image/") && file.type !== "image/gif" && file.type !== "image/svg+xml";
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new window.Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      nextImage.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function optimizeImageFile(file: File, section: GallerySection) {
  if (typeof window === "undefined" || !canOptimizeFile(file)) return file;
  const { maxDimension, quality } = uploadTargets[section];
  const image = await loadImageElement(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
  if (!blob) return file;
  const shouldKeepOriginal = blob.size >= file.size * 0.95 && scale === 1;
  if (shouldKeepOriginal) return file;
  const baseName = file.name.replace(/\.[^.]+$/, "") || "imagem";
  return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
}

export default function ImageManagerClient() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [optimizingUpload, setOptimizingUpload] = useState(false);
  const [filterSection, setFilterSection] = useState<"all" | GallerySection>("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "hidden">("all");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<GalleryFormState>(defaultForm);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [replacementFiles, setReplacementFiles] = useState<Record<string, File | null>>({});

  useEffect(() => {
    const token = getColaboradorItem("token");
    if (!token) { router.push("/colaboradores"); return; }
    void loadGallery(token);
  }, [router]);

  async function loadGallery(token: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/media/gallery?_=${Date.now()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readResponsePayload(response);
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a galeria.");
      setItems(data.items || []);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "Erro ao carregar a galeria.";
      setError(nextError);
      if (nextError.includes("Não autorizado") || nextError.includes("Acesso negado")) {
        clearColaboradorStorage();
        router.push("/colaboradores");
      }
    } finally {
      setLoading(false);
    }
  }

  async function reloadAfterMutation(token: string) {
    router.refresh();
    await loadGallery(token);
  }

  async function handleRefresh() {
    const token = getColaboradorItem("token");
    if (!token) { router.push("/colaboradores"); return; }
    setRefreshing(true); setMessage(""); setError("");
    try { await reloadAfterMutation(token); setMessage("Galeria atualizada."); }
    finally { setRefreshing(false); }
  }

  function updateNewItem<Field extends keyof GalleryFormState>(field: Field, value: GalleryFormState[Field]) {
    setNewItem((current) => ({ ...current, [field]: value }));
  }

  function updateItem(id: string, field: keyof GalleryItem, value: string | boolean | number) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  async function handleNewFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) { setNewFile(null); return; }
    setOptimizingUpload(true); setError("");
    try {
      const optimizedFile = await optimizeImageFile(file, newItem.section);
      setNewFile(optimizedFile);
      setMessage(optimizedFile === file ? "Imagem pronta para upload." : "Imagem otimizada antes do upload.");
    } catch (err) {
      setNewFile(file);
      setError(err instanceof Error ? err.message : "Não foi possível otimizar a imagem.");
    } finally {
      setOptimizingUpload(false);
      event.target.value = "";
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getColaboradorItem("token");
    if (!token) { router.push("/colaboradores"); return; }
    if (!newFile && !newItem.imageUrl.trim()) { setError("Escolha uma imagem ou indique um URL público."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      let response: Response;
      if (newFile) {
        const formData = new FormData();
        formData.append("file", newFile);
        formData.append("section", newItem.section);
        formData.append("title", newItem.title);
        formData.append("subtitle", newItem.subtitle);
        formData.append("description", newItem.description);
        formData.append("alt", newItem.alt);
        formData.append("order", newItem.order || "1");
        formData.append("projectKey", newItem.projectKey);
        formData.append("phase", newItem.phase);
        formData.append("isActive", String(newItem.isActive));
        response = await fetch("/api/media/gallery", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      } else {
        response = await fetch("/api/media/gallery", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ section: newItem.section, title: newItem.title, subtitle: newItem.subtitle, description: newItem.description, alt: newItem.alt, imageUrl: newItem.imageUrl, order: Number(newItem.order || "1"), projectKey: newItem.projectKey, phase: newItem.phase, isActive: newItem.isActive }),
        });
      }
      const data = await readResponsePayload(response);
      if (!response.ok) throw new Error(data.error || "Não foi possível guardar a imagem.");
      setMessage("Imagem adicionada com sucesso.");
      setNewItem(defaultForm);
      setNewFile(null);
      setShowForm(false);
      await reloadAfterMutation(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar imagem.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveItem(item: GalleryItem) {
    const token = getColaboradorItem("token");
    if (!token) { router.push("/colaboradores"); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const replacementFile = replacementFiles[item.id];
      let response: Response;
      if (replacementFile) {
        const formData = new FormData();
        formData.append("file", replacementFile);
        formData.append("section", item.section);
        formData.append("title", item.title);
        formData.append("subtitle", item.subtitle || "");
        formData.append("description", item.description || "");
        formData.append("alt", item.alt);
        formData.append("order", String(item.order));
        formData.append("projectKey", item.projectKey || "");
        formData.append("phase", item.phase || "");
        formData.append("isActive", String(item.isActive));
        response = await fetch(`/api/media/gallery/${item.id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: formData });
      } else {
        response = await fetch(`/api/media/gallery/${item.id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ section: item.section, title: item.title, subtitle: item.subtitle || "", description: item.description || "", alt: item.alt, imageUrl: item.imageUrl, order: item.order, projectKey: item.projectKey || "", phase: item.phase || "", isActive: item.isActive }),
        });
      }
      const data = await readResponsePayload(response);
      if (!response.ok) throw new Error(data.error || "Não foi possível guardar as alterações.");
      setReplacementFiles((current) => ({ ...current, [item.id]: null }));
      setMessage("Imagem atualizada com sucesso.");
      setExpandedId(null);
      await reloadAfterMutation(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar imagem.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(id: string) {
    const token = getColaboradorItem("token");
    if (!token) { router.push("/colaboradores"); return; }
    if (!window.confirm("Apagar esta imagem da galeria?")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/media/gallery/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await readResponsePayload(response);
      if (!response.ok) throw new Error(data.error || "Não foi possível apagar a imagem.");
      setMessage("Imagem apagada com sucesso.");
      setExpandedId(null);
      await reloadAfterMutation(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar imagem.");
    } finally {
      setSaving(false);
    }
  }

  async function onReplacementChange(id: string, section: GallerySection, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) { setReplacementFiles((current) => ({ ...current, [id]: null })); return; }
    setOptimizingUpload(true); setError("");
    try {
      const optimizedFile = await optimizeImageFile(file, section);
      setReplacementFiles((current) => ({ ...current, [id]: optimizedFile }));
      setMessage(optimizedFile === file ? "Nova imagem pronta para guardar." : "Nova imagem otimizada.");
    } catch (err) {
      setReplacementFiles((current) => ({ ...current, [id]: file }));
      setError(err instanceof Error ? err.message : "Não foi possível otimizar a imagem.");
    } finally {
      setOptimizingUpload(false);
      event.target.value = "";
    }
  }

  const heroItems = items.filter((i) => i.section === "hero");
  const showcaseItems = items.filter((i) => i.section === "showcase");
  const activeCount = items.filter((i) => i.isActive).length;

  const filteredItems = items.filter((i) => {
    if (filterSection !== "all" && i.section !== filterSection) return false;
    if (filterActive === "active" && !i.isActive) return false;
    if (filterActive === "hidden" && i.isActive) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#060f1a_0%,#07111c_100%)] px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/colaboradores/admin")}
              className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 hover:text-cyan-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao painel
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Gestor de imagens</p>
            <h1 className="mt-1.5 text-3xl font-semibold text-white">
              Carrossel e galeria de trabalhos
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-300">
              Carregue, substitua, ordene e oculte imagens do site sem editar código.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={loading || refreshing || saving}
              className="h-11 rounded-2xl border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "A atualizar..." : "Atualizar"}
            </Button>
            <Button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="h-11 rounded-2xl bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300"
            >
              <ImagePlus className="mr-1.5 h-4 w-4" />
              Nova imagem
            </Button>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={LayoutGrid} label="Carrossel topo" value={heroItems.length} tone="cyan" />
          <SummaryCard icon={Images} label="Galeria de trabalhos" value={showcaseItems.length} tone="emerald" />
          <SummaryCard icon={UploadCloud} label="Imagens ativas" value={activeCount} tone="slate" />
        </div>

        {/* Alertas */}
        {error && (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-400/[0.1] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/[0.1] px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        )}
        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100">
          Em produção no Vercel, ficheiros guardados apenas no disco local podem ser perdidos. Use o upload ou indique um URL público estável.
        </div>

        {/* Formulário nova imagem */}
        {showForm && (
          <div className="rounded-[28px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(9,25,40,0.96)_0%,rgba(11,30,47,0.94)_100%)] p-6 shadow-[0_20px_70px_rgba(3,10,18,0.22)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Nova entrada</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Adicionar imagem</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.1]"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
            <form className="space-y-5" onSubmit={handleCreate}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DField label="Secção">
                  <select
                    value={newItem.section}
                    onChange={(event) => updateNewItem("section", event.target.value as GallerySection)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300"
                  >
                    <option value="hero">Carrossel topo</option>
                    <option value="showcase">Galeria de trabalhos</option>
                  </select>
                </DField>
                <DField label="Título">
                  <input type="text" required value={newItem.title} onChange={(e) => updateNewItem("title", e.target.value)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300" />
                </DField>
                <DField label="Alt (acessibilidade)">
                  <input type="text" required value={newItem.alt} onChange={(e) => updateNewItem("alt", e.target.value)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300" />
                </DField>
                <DField label="Ordem">
                  <input type="number" min="1" value={newItem.order} onChange={(e) => updateNewItem("order", e.target.value)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300" />
                </DField>
                <DField label="Subtítulo">
                  <input type="text" value={newItem.subtitle} onChange={(e) => updateNewItem("subtitle", e.target.value)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300" />
                </DField>
                <DField label="Grupo do trabalho">
                  <input type="text" placeholder="ex: recolha-monos" value={newItem.projectKey} onChange={(e) => updateNewItem("projectKey", e.target.value)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300" />
                </DField>
                <DField label="Fase">
                  <select value={newItem.phase} onChange={(e) => updateNewItem("phase", e.target.value as GalleryPhase)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300">
                    <option value="">Sem fase</option>
                    <option value="before">Antes</option>
                    <option value="during">Durante</option>
                    <option value="after">Depois</option>
                  </select>
                </DField>
                <DField label="URL da imagem (alternativo)">
                  <input type="text" placeholder="https://..." value={newItem.imageUrl} onChange={(e) => updateNewItem("imageUrl", e.target.value)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300" />
                </DField>
              </div>

              <DField label="Descrição">
                <Textarea value={newItem.description} onChange={(e) => updateNewItem("description", e.target.value)} className="min-h-24 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
              </DField>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <DField label="Carregar ficheiro">
                  <Input type="file" accept="image/*" onChange={(e) => void handleNewFileChange(e)} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-slate-300" />
                </DField>
                <label className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-300">
                  <input type="checkbox" checked={newItem.isActive} onChange={(e) => updateNewItem("isActive", e.target.checked)} className="h-4 w-4" />
                  Ativa no site
                </label>
                <Button type="submit" disabled={saving || loading || optimizingUpload} className="h-11 rounded-2xl bg-cyan-400 px-6 text-slate-950 hover:bg-cyan-300">
                  {saving || optimizingUpload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Guardar imagem
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Filtros:</span>
          {(["all", "hero", "showcase"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterSection(s)}
              className={`rounded-[12px] px-3 py-1.5 text-xs font-semibold transition ${
                filterSection === s ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              {s === "all" ? "Todos" : s === "hero" ? "Carrossel topo" : "Galeria de trabalhos"}
            </button>
          ))}
          <span className="mx-1 text-slate-600">|</span>
          {(["all", "active", "hidden"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setFilterActive(a)}
              className={`rounded-[12px] px-3 py-1.5 text-xs font-semibold transition ${
                filterActive === a ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              {a === "all" ? "Todos" : a === "active" ? "Ativos" : "Ocultos"}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400">{filteredItems.length} item(s)</span>
        </div>

        {/* Lista de imagens */}
        <div className="rounded-[28px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(9,25,40,0.96)_0%,rgba(11,30,47,0.94)_100%)] shadow-[0_20px_70px_rgba(3,10,18,0.22)]">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-slate-400">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-400" />
              A carregar galeria...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-400">
              Nenhuma imagem corresponde aos filtros selecionados.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filteredItems
                .slice()
                .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order)
                .map((item) => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <div key={item.id}>
                      {/* Linha compacta */}
                      <div className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02]">
                        {/* Thumbnail */}
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.04]">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.alt} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-600">
                              <ImagePlus className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        {/* Info principal */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-white">{item.title || "Sem título"}</span>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              item.section === "hero"
                                ? "border-cyan-300/30 bg-cyan-400/[0.12] text-cyan-100"
                                : "border-emerald-300/30 bg-emerald-400/[0.12] text-emerald-100"
                            }`}>
                              {item.section === "hero" ? "Carrossel" : "Trabalho"}
                            </span>
                            {!item.isActive && (
                              <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">
                                Oculta
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
                            <span>Ordem: {item.order}</span>
                            {item.projectKey && <span>Grupo: {item.projectKey}</span>}
                            {item.phase && <span>Fase: {phaseLabel(item.phase)}</span>}
                            <span className="hidden truncate sm:inline" title={item.imageUrl}>{previewLabel(item.imageUrl)}</span>
                          </div>
                        </div>
                        {/* Ações rápidas */}
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            title={item.isActive ? "Ocultar" : "Mostrar"}
                            onClick={() => {
                              updateItem(item.id, "isActive", !item.isActive);
                              const updatedItem = { ...item, isActive: !item.isActive };
                              void handleSaveItem(updatedItem);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.1]"
                          >
                            {item.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            title="Expandir / Editar"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.1]"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Painel de edição expansível */}
                      {isExpanded && (
                        <div className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-5">
                          <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
                            {/* Pré-visualização + substituição */}
                            <div className="space-y-3">
                              <div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04]">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.alt} className="aspect-[4/3] h-full w-full object-cover" />
                                ) : (
                                  <div className="flex aspect-[4/3] items-center justify-center text-slate-600">
                                    <ImagePlus className="h-8 w-8" />
                                  </div>
                                )}
                              </div>
                              <DField label="Substituir imagem">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => void onReplacementChange(item.id, item.section, e)}
                                  className="h-10 rounded-[14px] border-white/10 bg-white/[0.04] text-slate-300 text-xs"
                                />
                              </DField>
                              <button
                                type="button"
                                title="Apagar imagem"
                                onClick={() => void handleDeleteItem(item.id)}
                                disabled={saving}
                                className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-rose-300/20 bg-rose-400/[0.08] px-3 py-2.5 text-xs font-semibold text-rose-100 hover:bg-rose-400/[0.14] disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Apagar imagem
                              </button>
                            </div>

                            {/* Campos de edição */}
                            <div className="space-y-4">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <DField label="Título">
                                  <input value={item.title} onChange={(e) => updateItem(item.id, "title", e.target.value)} className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-cyan-300" />
                                </DField>
                                <DField label="Subtítulo">
                                  <input value={item.subtitle || ""} onChange={(e) => updateItem(item.id, "subtitle", e.target.value)} className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-cyan-300" />
                                </DField>
                                <DField label="Alt">
                                  <input value={item.alt} onChange={(e) => updateItem(item.id, "alt", e.target.value)} className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-cyan-300" />
                                </DField>
                                <DField label="Ordem">
                                  <input type="number" min="1" value={String(item.order)} onChange={(e) => updateItem(item.id, "order", Number(e.target.value || 1))} className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-cyan-300" />
                                </DField>
                                <DField label="URL da imagem">
                                  <input value={item.imageUrl} onChange={(e) => updateItem(item.id, "imageUrl", e.target.value)} className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-cyan-300" />
                                </DField>
                                <DField label="Grupo do trabalho">
                                  <input value={item.projectKey || ""} onChange={(e) => updateItem(item.id, "projectKey", e.target.value)} className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-cyan-300" />
                                </DField>
                                <DField label="Secção">
                                  <select value={item.section} onChange={(e) => updateItem(item.id, "section", e.target.value as GallerySection)} className="h-10 w-full rounded-[14px] border border-white/10 bg-[#0a1a28] px-3 text-sm text-white outline-none transition focus:border-cyan-300">
                                    <option value="hero">Carrossel topo</option>
                                    <option value="showcase">Galeria de trabalhos</option>
                                  </select>
                                </DField>
                                <DField label="Fase">
                                  <select value={item.phase || ""} onChange={(e) => updateItem(item.id, "phase", e.target.value)} className="h-10 w-full rounded-[14px] border border-white/10 bg-[#0a1a28] px-3 text-sm text-white outline-none transition focus:border-cyan-300">
                                    <option value="">Sem fase</option>
                                    <option value="before">Antes</option>
                                    <option value="during">Durante</option>
                                    <option value="after">Depois</option>
                                  </select>
                                </DField>
                              </div>

                              <DField label="Descrição">
                                <Textarea value={item.description || ""} onChange={(e) => updateItem(item.id, "description", e.target.value)} className="min-h-20 rounded-[14px] border-white/10 bg-white/[0.04] text-white" />
                              </DField>

                              <div className="flex flex-wrap items-center gap-3">
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                                  <input type="checkbox" checked={item.isActive} onChange={(e) => updateItem(item.id, "isActive", e.target.checked)} className="h-4 w-4" />
                                  Ativa no site
                                </label>
                                <Button
                                  type="button"
                                  onClick={() => void handleSaveItem(item)}
                                  disabled={saving}
                                  className="ml-auto h-10 rounded-[14px] bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300"
                                >
                                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                  Guardar alterações
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: typeof LayoutGrid;
  label: string;
  value: number;
  tone?: "cyan" | "emerald" | "slate";
}) {
  const toneClass = {
    cyan: "border-cyan-300/20 text-cyan-100",
    emerald: "border-emerald-300/20 text-emerald-100",
    slate: "border-white/10 text-white",
  }[tone];

  return (
    <div className={`flex items-center gap-4 rounded-[20px] border bg-[linear-gradient(180deg,rgba(12,34,52,0.96)_0%,rgba(9,27,43,0.94)_100%)] px-5 py-4 ${toneClass}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15">
        <Icon className="h-5 w-5 text-cyan-300" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function DField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
