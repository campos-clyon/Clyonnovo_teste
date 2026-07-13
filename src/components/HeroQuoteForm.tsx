"use client";

import { useState, useRef } from "react";

const SERVICE_OPTIONS = [
  { value: "recolha_moveis",           label: "Recolha de móveis" },
  { value: "recolha_monos",            label: "Recolha de monos" },
  { value: "recolha_entulho",          label: "Recolha de entulho" },
  { value: "esvaziamento_casa",        label: "Esvaziamento de casa" },
  { value: "esvaziamento_apartamento", label: "Esvaziamento de apartamento" },
  { value: "mudanca",                  label: "Mudança" },
  { value: "outro",                    label: "Outro" },
];

const ELEVATOR_OPTIONS = [
  { value: "yes",     label: "Sim" },
  { value: "small",   label: "Pequeno" },
  { value: "no",      label: "Não" },
  { value: "unknown", label: "Não sei" },
];

const ANDAR_OPTIONS = [
  { value: "",    label: "Rés-do-chão" },
  { value: "1",   label: "1.º andar" },
  { value: "2",   label: "2.º andar" },
  { value: "3",   label: "3.º andar" },
  { value: "4",   label: "4.º andar" },
  { value: "4+",  label: "5.º ou superior" },
];

function fmtEur(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── field primitives ──────────────────────────────────────────────────────────

function inputCls(error?: string) {
  return `w-full rounded-lg border bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/25 ${error ? "border-red-400/70" : "border-white/10"}`;
}

function selectCls(error?: string) {
  return `w-full rounded-lg border bg-[#0c1e32] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/25 ${error ? "border-red-400/70" : "border-white/10"}`;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </label>
  );
}

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-0.5 text-[10px] text-red-400">{msg}</p>;
}

// ── types ─────────────────────────────────────────────────────────────────────

type FormData = {
  primeiroNome: string;
  ultimoNome: string;
  indicativo: string;
  telefone: string;
  tipoServico: string;
  rua: string;
  codigoPostal: string;
  numeroPosta: string;
  andar: string;
  elevador: "yes" | "small" | "no" | "unknown";
  descricao: string;
};

type Errors = Partial<Record<keyof FormData, string>>;

type EstimateResult = {
  estimatedPriceWithVat: number | null;
  estimatedPriceWithoutVat: number | null;
  estimateMinWithVat: number | null;
  estimateMaxWithVat: number | null;
  status: string;
  confidence: string;
  customerMessage: string;
};

// ── main component ────────────────────────────────────────────────────────────

export default function HeroQuoteForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormData>({
    primeiroNome: "",
    ultimoNome: "",
    indicativo: "+351",
    telefone: "",
    tipoServico: "",
    rua: "",
    codigoPostal: "",
    numeroPosta: "",
    andar: "",
    elevador: "unknown",
    descricao: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [serverError, setServerError] = useState("");

  // image upload state
  const [images, setImages] = useState<File[]>([]);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    setImages((prev) => [...prev, ...Array.from(files)].slice(0, 5));
    setShowUploadMenu(false);
  }

  // ── validation ──────────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const e: Errors = {};
    if (form.primeiroNome.trim().length < 2) e.primeiroNome = "Mínimo 2 caracteres";
    if (form.ultimoNome.trim().length < 2)   e.ultimoNome   = "Mínimo 2 caracteres";
    if (!form.indicativo.trim())              e.indicativo   = "Obrigatório";
    if (form.telefone.trim().length < 6)      e.telefone     = "Número inválido";
    if (!form.tipoServico)                    e.tipoServico  = "Escolha um serviço";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Errors = {};
    if (form.rua.trim().length < 3)          e.rua          = "Mínimo 3 caracteres";
    if (form.codigoPostal.trim().length < 4) e.codigoPostal = "Código postal inválido";
    if (form.descricao.length > 300)         e.descricao    = "Máximo 300 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep(ev: React.FormEvent) {
    ev.preventDefault();
    if (validateStep1()) setStep(2);
  }

  // ── submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);
    setServerError("");

    try {
      const res = await fetch("/api/hero-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pagePath: typeof window !== "undefined" ? window.location.pathname : "/",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Erro ao enviar. Tente novamente.");
        return;
      }

      setEstimate(data.estimate);
      setSent(true);
    } catch {
      setServerError("Erro de rede. Verifique a sua ligação e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ── success state ────────────────────────────────────────────────────────────

  if (sent) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-center backdrop-blur-md">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 text-2xl text-cyan-400">
          ✓
        </div>
        <h3 className="mt-3 text-lg font-bold text-white">Pedido recebido!</h3>
        <p className="mt-1 text-xs text-slate-400">
          Contactamos em breve para confirmar data e valor.
        </p>

        {estimate && estimate.estimatedPriceWithVat && (
          <div className="mt-5 w-full rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-left">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-cyan-400/80">
              Estimativa rápida
            </p>
            {estimate.estimateMinWithVat && estimate.estimateMaxWithVat ? (
              <p className="mt-1 text-xl font-bold text-white">
                {fmtEur(estimate.estimateMinWithVat)} – {fmtEur(estimate.estimateMaxWithVat)}
                <span className="ml-1 text-xs font-normal text-slate-400">c/IVA</span>
              </p>
            ) : (
              <p className="mt-1 text-xl font-bold text-white">
                {fmtEur(estimate.estimatedPriceWithVat)}
                <span className="ml-1 text-xs font-normal text-slate-400">c/IVA</span>
              </p>
            )}
            <p className="mt-2 text-[11px] text-slate-400">{estimate.customerMessage}</p>
          </div>
        )}

        <p className="mt-4 text-[10px] text-slate-500">
          Sem compromisso · Confirmação antes de qualquer trabalho
        </p>
      </div>
    );
  }

  // ── shared form wrapper ──────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md">
      {/* progress bar */}
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
        <div className="flex flex-1 items-center gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-cyan-400" />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step === 2 ? "bg-cyan-400" : "bg-white/10"}`} />
        </div>
        <span className="text-[10px] text-slate-500">
          {step === 1 ? "Passo 1/2 · Contacto" : "Passo 2/2 · Localização"}
        </span>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <form onSubmit={nextStep} noValidate className="space-y-3 p-5">
          {/* Nome */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Primeiro nome</Label>
              <input className={inputCls(errors.primeiroNome)} placeholder="Ana"
                value={form.primeiroNome} onChange={(e) => set("primeiroNome", e.target.value)}
                autoComplete="given-name" />
              <Err msg={errors.primeiroNome} />
            </div>
            <div>
              <Label>Último nome</Label>
              <input className={inputCls(errors.ultimoNome)} placeholder="Silva"
                value={form.ultimoNome} onChange={(e) => set("ultimoNome", e.target.value)}
                autoComplete="family-name" />
              <Err msg={errors.ultimoNome} />
            </div>
          </div>

          {/* Telefone */}
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <div>
              <Label>Ind.</Label>
              <input className={inputCls(errors.indicativo)} placeholder="+351"
                value={form.indicativo} onChange={(e) => set("indicativo", e.target.value)}
                autoComplete="tel-country-code" maxLength={6} />
              <Err msg={errors.indicativo} />
            </div>
            <div>
              <Label>Telemóvel</Label>
              <input className={inputCls(errors.telefone)} placeholder="912 345 678"
                value={form.telefone} onChange={(e) => set("telefone", e.target.value)}
                type="tel" autoComplete="tel-national" maxLength={20} />
              <Err msg={errors.telefone} />
            </div>
          </div>

          {/* Serviço */}
          <div>
            <Label>Tipo de serviço</Label>
            <select className={selectCls(errors.tipoServico)}
              value={form.tipoServico} onChange={(e) => set("tipoServico", e.target.value)}>
              <option value="">Escolha o serviço…</option>
              {SERVICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Err msg={errors.tipoServico} />
          </div>

          <button type="submit"
            className="mt-1 w-full rounded-xl bg-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400">
            Próximo →
          </button>

          <p className="text-center text-[10px] text-slate-500">
            Sem compromisso · Gratuito · Resposta &lt;24&nbsp;h
          </p>
        </form>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <form onSubmit={handleSubmit} noValidate className="space-y-3 p-5">
          {/* Rua */}
          <div>
            <Label>Rua / Avenida</Label>
            <input className={inputCls(errors.rua)} placeholder="Rua das Flores"
              value={form.rua} onChange={(e) => set("rua", e.target.value)}
              autoComplete="street-address" />
            <Err msg={errors.rua} />
          </div>

          {/* CP + porta */}
          <div className="grid grid-cols-[1fr_76px] gap-2">
            <div>
              <Label>Código postal</Label>
              <input className={inputCls(errors.codigoPostal)} placeholder="2840-123"
                value={form.codigoPostal} onChange={(e) => set("codigoPostal", e.target.value)}
                autoComplete="postal-code" maxLength={12} />
              <Err msg={errors.codigoPostal} />
            </div>
            <div>
              <Label>Nº porta</Label>
              <input className={inputCls()} placeholder="12"
                value={form.numeroPosta} onChange={(e) => set("numeroPosta", e.target.value)}
                maxLength={10} />
            </div>
          </div>

          {/* Andar + elevador */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Andar</Label>
              <select className={selectCls()} value={form.andar}
                onChange={(e) => set("andar", e.target.value)}>
                {ANDAR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Elevador</Label>
              <select className={selectCls()} value={form.elevador}
                onChange={(e) => set("elevador", e.target.value as FormData["elevador"])}>
                {ELEVATOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição + upload */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Descrição <span className="normal-case text-slate-500">(opcional)</span></Label>
              <span className={`text-[10px] ${form.descricao.length > 280 ? "text-amber-400" : "text-slate-600"}`}>
                {form.descricao.length}/300
              </span>
            </div>

            <div className={`relative rounded-lg border bg-white/[0.06] transition focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/25 ${errors.descricao ? "border-red-400/70" : "border-white/10"}`}>
              <textarea
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                maxLength={310}
                rows={3}
                placeholder="Ex: 1 sofá de 3 lugares, 1 colchão de casal…"
                className="w-full resize-none rounded-lg bg-transparent px-3 pb-8 pt-2.5 text-sm text-white placeholder-slate-500 outline-none"
              />

              {/* upload bar */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-lg border-t border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
                {images.length > 0 ? (
                  <span className="text-[10px] text-slate-500">
                    {images.length} imagem{images.length > 1 ? "ns" : ""} selecionada{images.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600">Adicionar fotos</span>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUploadMenu((v) => !v)}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-400"
                    aria-label="Adicionar imagem"
                  >
                    +
                  </button>

                  {showUploadMenu && (
                    <div className="absolute bottom-8 right-0 z-20 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#0e2035] shadow-xl">
                      <button
                        type="button"
                        onClick={() => cameraRef.current?.click()}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
                      >
                        <span>📷</span> Câmera
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryRef.current?.click()}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
                      >
                        <span>🖼️</span> Galeria
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Err msg={errors.descricao} />
          </div>

          {/* hidden file inputs */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
          <input ref={galleryRef} type="file" accept="image/*"
            multiple className="hidden" onChange={(e) => addImages(e.target.files)} />

          {serverError && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {serverError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setStep(1); setErrors({}); }}
              className="rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-400 transition hover:border-white/30 hover:text-white"
            >
              ← Voltar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? "A enviar…" : "Pedir orçamento grátis →"}
            </button>
          </div>

          <p className="text-center text-[10px] text-slate-500">
            Sem compromisso · Gratuito · Resposta &lt;24&nbsp;h
          </p>
        </form>
      )}
    </div>
  );
}
