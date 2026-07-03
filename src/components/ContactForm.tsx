"use client";

import { useState, useCallback } from "react";
import { AlertCircle, Mail, MessageCircle, CheckCircle2 } from "lucide-react";
import { trackLeadFormStart, trackLeadFormSubmit, trackWhatsAppClick } from "@/lib/analytics";
import { BUSINESS_PHONE } from "@/lib/seo-data";

const SERVICES = [
  "Recolha de móveis",
  "Recolha de monos",
  "Recolha de entulho",
  "Mudanças",
  "Esvaziamento de casas",
  "Limpeza pós-obra",
  "Outro",
];

interface FormData {
  nome: string;
  telemovel: string;
  endereco: string;
  servico: string;
  mensagem: string;
}

interface FormErrors {
  nome?: string;
  telemovel?: string;
  endereco?: string;
  servico?: string;
}

function validatePhonePT(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  // Portuguese mobile numbers: 9 digits starting with 9 (91, 92, 93, 96)
  return /^9[1236]\d{7}$/.test(cleaned);
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
}

export default function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    telemovel: "",
    endereco: "",
    servico: "",
    mensagem: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFocus = useCallback((field: string) => {
    if (!touched[field]) {
      trackLeadFormStart("contactos_page");
    }
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, [touched]);

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === "telemovel") {
      const formatted = formatPhone(value);
      setFormData((prev) => ({ ...prev, [name]: formatted }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.nome.trim()) {
      newErrors.nome = "Nome é obrigatório";
    }

    const cleanedPhone = formData.telemovel.replace(/\D/g, "");
    if (!cleanedPhone) {
      newErrors.telemovel = "Telemóvel é obrigatório";
    } else if (!validatePhonePT(cleanedPhone)) {
      newErrors.telemovel = "Introduza um número de telemóvel válido (9 dígitos)";
    }

    if (!formData.endereco.trim()) {
      newErrors.endereco = "Endereço é obrigatório";
    }

    if (!formData.servico) {
      newErrors.servico = "Selecione o tipo de serviço";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmitWhatsApp = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    trackLeadFormSubmit("contactos_page", formData.servico);
    trackWhatsAppClick("contact_form", formData.servico);

    const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
    const message = `Olá! Gostava de pedir um orçamento à CLYON.

*Dados do pedido:*
- Nome: ${formData.nome}
- Telemóvel: ${formData.telemovel}
- Endereço: ${formData.endereco}
- Serviço: ${formData.servico}
${formData.mensagem ? `- Mensagem: ${formData.mensagem}` : ""}

Podem entrar em contacto comigo?`;

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    // Gravar lead na DB — fire-and-forget, não bloqueia nem depende do WhatsApp
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: formData.nome.trim(),
        telefone: formData.telemovel.replace(/\s/g, ""),
        email: "",
        localidade: formData.endereco.trim(),
        tipoServico: formData.servico,
        preferenciaContacto: "WhatsApp",
        mensagem: formData.mensagem.trim() || null,
        pagePath: window.location.pathname,
        pageUrl: window.location.href,
        origem: "formulario_contactos",
        canal: "whatsapp",
      }),
    }).catch(() => null);

    // Open WhatsApp
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    setIsSubmitting(false);
  }, [formData, validate]);

  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmitEmail = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setEmailStatus("sending");
    trackLeadFormSubmit("contactos_page_email", formData.servico);

    try {
      const utmParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pagePath: window.location.pathname,
          pageUrl: window.location.href,
          utmSource: utmParams.utm_source ?? null,
          utmMedium: utmParams.utm_medium ?? null,
          utmCampaign: utmParams.utm_campaign ?? null,
          gclid: utmParams.gclid ?? null,
        }),
      });

      if (response.ok) {
        setEmailStatus("success");
        // Reset form after 3 seconds
        setTimeout(() => {
          setFormData({
            nome: "",
            telemovel: "",
            endereco: "",
            servico: "",
            mensagem: "",
          });
          setEmailStatus("idle");
        }, 3000);
      } else {
        setEmailStatus("error");
        setTimeout(() => setEmailStatus("idle"), 3000);
      }
    } catch {
      setEmailStatus("error");
      setTimeout(() => setEmailStatus("idle"), 3000);
    }
  }, [formData, validate]);

  return (
    <form onSubmit={handleSubmitWhatsApp} className="space-y-5">
      {/* Nome */}
      <div>
        <label htmlFor="nome" className="block text-sm font-semibold text-slate-950">
          Nome <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="nome"
          name="nome"
          value={formData.nome}
          onChange={handleChange}
          onFocus={() => handleFocus("nome")}
          placeholder="O seu nome"
          className={`mt-2 w-full rounded-2xl border ${
            errors.nome ? "border-red-300 bg-red-50" : "border-cyan-100 bg-white"
          } px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100`}
        />
        {errors.nome && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {errors.nome}
          </p>
        )}
      </div>

      {/* Telemóvel */}
      <div>
        <label htmlFor="telemovel" className="block text-sm font-semibold text-slate-950">
          Telemóvel <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="telemovel"
          name="telemovel"
          value={formData.telemovel}
          onChange={handleChange}
          onFocus={() => handleFocus("telemovel")}
          placeholder="912 345 678"
          maxLength={11}
          className={`mt-2 w-full rounded-2xl border ${
            errors.telemovel ? "border-red-300 bg-red-50" : "border-cyan-100 bg-white"
          } px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100`}
        />
        {errors.telemovel && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {errors.telemovel}
          </p>
        )}
      </div>

      {/* Endereço */}
      <div>
        <label htmlFor="endereco" className="block text-sm font-semibold text-slate-950">
          Endere��o <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="endereco"
          name="endereco"
          value={formData.endereco}
          onChange={handleChange}
          onFocus={() => handleFocus("endereco")}
          placeholder="Rua, número, cidade (ex: Rua das Flores 123, Lisboa)"
          className={`mt-2 w-full rounded-2xl border ${
            errors.endereco ? "border-red-300 bg-red-50" : "border-cyan-100 bg-white"
          } px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100`}
        />
        {errors.endereco && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {errors.endereco}
          </p>
        )}
      </div>

      {/* Serviço */}
      <div>
        <label htmlFor="servico" className="block text-sm font-semibold text-slate-950">
          Tipo de Serviço <span className="text-red-500">*</span>
        </label>
        <select
          id="servico"
          name="servico"
          value={formData.servico}
          onChange={handleChange}
          onFocus={() => handleFocus("servico")}
          className={`mt-2 w-full rounded-2xl border ${
            errors.servico ? "border-red-300 bg-red-50" : "border-cyan-100 bg-white"
          } px-4 py-3.5 text-base text-slate-900 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100`}
        >
          <option value="">Selecione o serviço</option>
          {SERVICES.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
        {errors.servico && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {errors.servico}
          </p>
        )}
      </div>

      {/* Mensagem */}
      <div>
        <label htmlFor="mensagem" className="block text-sm font-semibold text-slate-950">
          Mensagem <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          id="mensagem"
          name="mensagem"
          value={formData.mensagem}
          onChange={handleChange}
          onFocus={() => handleFocus("mensagem")}
          placeholder="Descreva brevemente o que precisa (ex: tenho um sofá e 3 armários para retirar no 3º andar sem elevador)"
          rows={4}
          className="mt-2 w-full rounded-2xl border border-cyan-100 bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
        />
      </div>

      {/* Submit Options */}
      <div className="space-y-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-[0_18px_40px_-22px_rgba(37,211,102,0.75)] transition hover:-translate-y-0.5 hover:bg-emerald-400 disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {isSubmitting ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              A enviar...
            </>
          ) : (
            <>
              <MessageCircle className="h-5 w-5" />
              Enviar por WhatsApp
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSubmitEmail}
          disabled={emailStatus === "sending" || emailStatus === "success"}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-6 py-4 text-base font-semibold transition hover:-translate-y-0.5 disabled:hover:translate-y-0 ${
            emailStatus === "success"
              ? "border-emerald-500 bg-emerald-50 text-emerald-600"
              : emailStatus === "error"
              ? "border-red-500 bg-red-50 text-red-600"
              : "border-cyan-500 bg-white text-cyan-600 hover:bg-cyan-50"
          }`}
        >
          {emailStatus === "sending" ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              A enviar...
            </>
          ) : emailStatus === "success" ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Email enviado com sucesso!
            </>
          ) : emailStatus === "error" ? (
            <>
              <AlertCircle className="h-5 w-5" />
              Erro ao enviar. Tente novamente.
            </>
          ) : (
            <>
              <Mail className="h-5 w-5" />
              Enviar por Email
            </>
          )}
        </button>
      </div>

      <p className="text-center text-sm text-slate-500">
        Escolha como prefere enviar o seu pedido de orçamento.
      </p>
    </form>
  );
}
