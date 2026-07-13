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

function fmtEur(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function Field({ label, error, className = "", ...props }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </label>
      <input
        {...props}
        className={`w-full rounded-lg border bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 ${error ? "border-red-400/70" : "border-white/10"} ${className}`}
      />
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

function Select({ label, error, children, className = "", ...props }: SelectProps) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </label>
      <select
        {...props}
        className={`w-full rounded-lg border bg-[#0e2035] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 ${error ? "border-red-400/70" : "border-white/10"} ${className}`}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

type FormData = {
  primeiroNome: string;
  ultimoNome: string;
  indicativo: string;
  telefone: string;
  rua: string;
  codigoPostal: string;
  numeroPosta: string;
  andar: string;
  elevador: "yes" | "small" | "no" | "unknown";
  tipoServico: string;
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

export default function HeroQuoteForm() {
  const [form, setForm] = useState<FormData>({
    primeiroNome: "",
    ultimoNome: "",
    indicativo: "+351",
    telefone: "",
    rua: "",
    codigoPostal: "",
    numeroPosta: "",
    andar: "",
    elevador: "unknown",
    tipoServico: "",
    descricao: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [serverError, setServerError] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Errors = {};
    if (form.primeiroNome.trim().length < 2) e.primeiroNome = "Mínimo 2 caracteres";
    if (form.ultimoNome.trim().length < 2)   e.ultimoNome   = "Mínimo 2 caracteres";
    if (!form.indicativo.trim())              e.indicativo   = "Obrigatório";
    if (form.telefone.trim().length < 6)      e.telefone     = "Número inválido";
    if (form.rua.trim().length < 3)           e.rua          = "Mínimo 3 caracteres";
    if (form.codigoPostal.trim().length < 4)  e.codigoPostal = "Código postal inválido";
    if (!form.tipoServico)                    e.tipoServico  = "Escolha um serviço";
    if (form.descricao.length > 300)          e.descricao    = "Máximo 300 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
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

  if (sent) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-8 text-center backdrop-blur-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/20 text-3xl">
          ✓
        </div>
        <h3 className="mt-4 text-xl font-bold text-white">Pedido recebido!</h3>
        <p className="mt-2 text-sm text-slate-400">
          A nossa equipa irá contactá-lo em breve para confirmar data e valor.
        </p>

        {estimate && estimate.estimatedPriceWithVat && (
          <div className="mt-6 w-full rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/80">
              Estimativa rápida
            </p>
            {estimate.estimateMinWithVat && estimate.estimateMaxWithVat ? (
              <p className="mt-1 text-2xl font-bold text-white">
                {fmtEur(estimate.estimateMinWithVat)} – {fmtEur(estimate.estimateMaxWithVat)}
                <span className="ml-1 text-sm font-normal text-slate-400">c/IVA</span>
              </p>
            ) : (
              <p className="mt-1 text-2xl font-bold text-white">
                {fmtEur(estimate.estimatedPriceWithVat)}
                <span className="ml-1 text-sm font-normal text-slate-400">c/IVA</span>
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">{estimate.customerMessage}</p>
          </div>
        )}

        <p className="mt-5 text-xs text-slate-500">
          Referência criada · A equipa confirma data e preço final antes de qualquer trabalho.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md sm:p-6"
    >
      <p className="mb-4 text-sm font-semibold text-white">
        Orçamento gratuito em 24&nbsp;h
      </p>

      {/* Nome */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Primeiro nome"
          placeholder="Ana"
          value={form.primeiroNome}
          onChange={(e) => set("primeiroNome", e.target.value)}
          error={errors.primeiroNome}
          autoComplete="given-name"
        />
        <Field
          label="Último nome"
          placeholder="Silva"
          value={form.ultimoNome}
          onChange={(e) => set("ultimoNome", e.target.value)}
          error={errors.ultimoNome}
          autoComplete="family-name"
        />
      </div>

      {/* Telefone */}
      <div className="mt-3 grid grid-cols-[80px_1fr] gap-2">
        <Field
          label="Indicativo"
          placeholder="+351"
          value={form.indicativo}
          onChange={(e) => set("indicativo", e.target.value)}
          error={errors.indicativo}
          autoComplete="tel-country-code"
          maxLength={6}
        />
        <Field
          label="Telemóvel / Telefone"
          placeholder="912 345 678"
          value={form.telefone}
          onChange={(e) => set("telefone", e.target.value)}
          error={errors.telefone}
          type="tel"
          autoComplete="tel-national"
          maxLength={20}
        />
      </div>

      {/* Morada */}
      <div className="mt-3">
        <Field
          label="Rua / Avenida"
          placeholder="Rua das Flores"
          value={form.rua}
          onChange={(e) => set("rua", e.target.value)}
          error={errors.rua}
          autoComplete="street-address"
        />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_80px] gap-2">
        <Field
          label="Código postal"
          placeholder="2840-123"
          value={form.codigoPostal}
          onChange={(e) => set("codigoPostal", e.target.value)}
          error={errors.codigoPostal}
          autoComplete="postal-code"
          maxLength={12}
        />
        <Field
          label="Nº porta"
          placeholder="12"
          value={form.numeroPosta}
          onChange={(e) => set("numeroPosta", e.target.value)}
          autoComplete="address-line2"
          maxLength={10}
        />
      </div>

      {/* Andar + Elevador */}
      <div className="mt-3 grid grid-cols-[1fr_1fr] gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Andar
          </label>
          <select
            value={form.andar}
            onChange={(e) => set("andar", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0e2035] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="">Rés-do-chão</option>
            <option value="1">1.º andar</option>
            <option value="2">2.º andar</option>
            <option value="3">3.º andar</option>
            <option value="4">4.º andar</option>
            <option value="4+">5.º ou superior</option>
          </select>
        </div>
        <Select
          label="Elevador"
          value={form.elevador}
          onChange={(e) => set("elevador", e.target.value as FormData["elevador"])}
          error={errors.elevador}
        >
          {ELEVATOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      {/* Tipo de serviço */}
      <div className="mt-3">
        <Select
          label="Tipo de serviço"
          value={form.tipoServico}
          onChange={(e) => set("tipoServico", e.target.value)}
          error={errors.tipoServico}
        >
          <option value="">Escolha o serviço...</option>
          {SERVICE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      {/* Descrição */}
      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Descrição <span className="normal-case text-slate-500">(opcional · máx. 300 car.)</span>
        </label>
        <textarea
          ref={descRef}
          value={form.descricao}
          onChange={(e) => set("descricao", e.target.value)}
          maxLength={310}
          rows={3}
          placeholder="Ex: 1 sofá de 3 lugares, 1 colchão de casal, sem elevador…"
          className={`w-full resize-none rounded-lg border bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 ${errors.descricao ? "border-red-400/70" : "border-white/10"}`}
        />
        <div className="mt-0.5 flex items-center justify-between">
          {errors.descricao
            ? <p className="text-[11px] text-red-400">{errors.descricao}</p>
            : <span />
          }
          <span className={`ml-auto text-[11px] ${form.descricao.length > 280 ? "text-amber-400" : "text-slate-600"}`}>
            {form.descricao.length}/300
          </span>
        </div>
      </div>

      {serverError && (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-xl bg-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:opacity-60"
      >
        {loading ? "A enviar…" : "Pedir orçamento grátis →"}
      </button>

      <p className="mt-3 text-center text-[11px] text-slate-500">
        Sem compromisso · Resposta em menos de 24&nbsp;h · Gratuito
      </p>
    </form>
  );
}
