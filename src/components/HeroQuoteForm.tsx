"use client";

import { useState, useRef, useEffect } from "react";

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


function inputCls(error?: string) {
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/25 ${error ? "border-red-400" : "border-slate-200"}`;
}

function selectCls(error?: string) {
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/25 ${error ? "border-red-400" : "border-slate-200"}`;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </label>
  );
}

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-0.5 text-[10px] text-red-400">{msg}</p>;
}

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

// Fixed card height matches phase 2 (the bigger one)
const CARD_MIN_HEIGHT = 530;

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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [serverError, setServerError] = useState("");

  const [images, setImages] = useState<File[]>([]);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown ticker
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(15);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    setImages((prev) => [...prev, ...Array.from(files)].slice(0, 5));
    setShowUploadMenu(false);
  }

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

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);
    setServerError("");
    startCountdown();

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
        setLoading(false);
        setCountdown(null);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setServerError(data.error ?? "Erro ao enviar. Tente novamente.");
        return;
      }

      setEstimate(data.estimate);
      setSent(true);
    } catch {
      setLoading(false);
      setCountdown(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setServerError("Erro de rede. Verifique a sua ligação e tente novamente.");
    }
  }

  // ── auto-reset after 60s ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => {
      setSent(false);
      setEstimate(null);
      setStep(1);
      setForm({
        primeiroNome: "", ultimoNome: "", indicativo: "+351", telefone: "",
        tipoServico: "", rua: "", codigoPostal: "", numeroPosta: "",
        andar: "", elevador: "unknown", descricao: "",
      });
      setImages([]);
      setErrors({});
      setServerError("");
    }, 60_000);
    return () => clearTimeout(t);
  }, [sent]);

  // ── success ───────────────────────────────────────────────────────────────────

  if (sent) {
    return (
      <div
        className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50"
        style={{ minHeight: CARD_MIN_HEIGHT }}
      >
        {/* top accent bar */}
        <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500" />

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
          {/* animated check */}
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-cyan-500/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan-400/40 bg-cyan-50">
              <svg className="h-7 w-7 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h3 className="mt-5 text-xl font-bold text-[#0B1929]">Pedido enviado com sucesso!</h3>

          <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-slate-500">
            A nossa equipa irá entrar em contacto em breve para confirmar data, horário e detalhes do serviço.
          </p>

          {/* info pills */}
          <div className="mt-6 flex flex-col gap-2 w-full max-w-[300px]">
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-lg">📞</span>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-[#0B1929]">Resposta em &lt;24&nbsp;h</p>
                <p className="text-[10px] text-slate-500">Via chamada ou WhatsApp</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-lg">📋</span>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-[#0B1929]">Orçamento confirmado antes de avançar</p>
                <p className="text-[10px] text-slate-500">Nenhum trabalho sem a sua aprovação</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-lg">✅</span>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-[#0B1929]">Sem custos ocultos</p>
                <p className="text-[10px] text-slate-500">O preço fechado é o preço final</p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-[10px] text-slate-400">
            Este formulário irá reiniciar automaticamente em 1 minuto.
          </p>
        </div>
      </div>
    );
  }

  // ── form card (fixed height) ───────────────────────────────────────────────

  return (
    <div
      className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50"
      style={{ minHeight: CARD_MIN_HEIGHT }}
    >
      {/* progress bar */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="flex flex-1 items-center gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-cyan-500" />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step === 2 ? "bg-cyan-500" : "bg-slate-200"}`} />
        </div>
        <span className="text-[10px] text-slate-500">
          {step === 1 ? "Passo 1/2 · Contacto" : "Passo 2/2 · Localização"}
        </span>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <form onSubmit={nextStep} noValidate className="flex flex-1 flex-col p-5">
          <div className="flex flex-1 flex-col justify-between space-y-3">
            <div className="space-y-3">
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
            </div>

            {/* spacer + CTA at bottom to match phase 2 height */}
            <div className="mt-auto space-y-3 pt-3">
              <button type="submit"
                className="w-full rounded-xl bg-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400">
                Próximo
              </button>
              <p className="text-center text-[10px] text-slate-500">
                Sem compromisso · Gratuito · Resposta &lt;24&nbsp;h
              </p>
            </div>
          </div>
        </form>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col p-5">
          <div className="flex flex-1 flex-col justify-between space-y-3">
            <div className="space-y-3">
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
                  <span className={`text-[10px] ${form.descricao.length > 280 ? "text-amber-500" : "text-slate-400"}`}>
                    {form.descricao.length}/300
                  </span>
                </div>

                <div className={`relative rounded-lg border bg-white transition focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/25 ${errors.descricao ? "border-red-400" : "border-slate-200"}`}>
                  <textarea
                    value={form.descricao}
                    onChange={(e) => set("descricao", e.target.value)}
                    maxLength={310}
                    rows={3}
                    placeholder="Ex: 1 sofá de 3 lugares, 1 colchão de casal…"
                    className="w-full resize-none rounded-lg bg-transparent px-3 pb-8 pt-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none"
                  />
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-lg border-t border-slate-100 bg-slate-50 px-3 py-1.5">
                    {images.length > 0 ? (
                      <span className="text-[10px] text-slate-500">
                        {images.length} imagem{images.length > 1 ? "ns" : ""} selecionada{images.length > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Adicionar fotos</span>
                    )}
                    <div className="relative">
                      <button type="button"
                        onClick={() => setShowUploadMenu((v) => !v)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-400 transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-500"
                        aria-label="Adicionar imagem">
                        +
                      </button>
                      {showUploadMenu && (
                        <div className="absolute bottom-8 right-0 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                          <button type="button" onClick={() => cameraRef.current?.click()}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                            <span>📷</span> Câmera
                          </button>
                          <button type="button" onClick={() => galleryRef.current?.click()}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                            <span>🖼️</span> Galeria
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Err msg={errors.descricao} />
              </div>
            </div>

            {/* hidden inputs */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
            <input ref={galleryRef} type="file" accept="image/*"
              multiple className="hidden" onChange={(e) => addImages(e.target.files)} />

            {serverError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {serverError}
              </p>
            )}

            {/* CTA at bottom */}
            <div className="mt-auto space-y-3 pt-3">
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setStep(1); setErrors({}); }}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-40">
                  ← Voltar
                </button>
                <button type="submit" disabled={loading}
                  className="relative flex-1 overflow-hidden rounded-xl bg-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-600">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Calculando e enviando
                      {countdown !== null && (
                        <span className="tabular-nums text-white/70">{countdown}s</span>
                      )}
                    </span>
                  ) : (
                    "Pedir orçamento grátis"
                  )}
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-500">
                Sem compromisso · Gratuito · Resposta &lt;24&nbsp;h
              </p>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
