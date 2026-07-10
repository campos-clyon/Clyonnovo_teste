"use client";

import { useState } from "react";
import { Clock3, Mail, MapPin, MessageCircle, Phone, CheckCircle2 } from "lucide-react";

export default function ContactosClient() {
  const [form, setForm] = useState({ nome: "", telemovel: "", email: "", morada: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/simulador/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: {
            serviceType: "outro",
            origemPedido: "formulario_contactos",
            description: `Contacto direto via página de contactos. Morada: ${form.morada}`,
            address: { formattedAddress: form.morada },
            receiver: {
              name: form.nome,
              phone: form.telemovel,
              email: form.email,
            },
          },
          estimate: null,
          chatHistory: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Erro ao enviar pedido.");
      }

      setStatus("success");
      setForm({ nome: "", telemovel: "", email: "", morada: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro inesperado.");
    }
  };

  const field = (
    id: keyof typeof form,
    label: string,
    type = "text",
    placeholder = ""
  ) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={form[id]}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F8FB]">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-24 sm:px-6 lg:px-8">

        {/* Header compacto */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#0B1929] sm:text-4xl">
            Fale connosco
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
            Orçamento grátis em 24h — por telefone, WhatsApp ou pelo formulário abaixo.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Contacto direto */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1929]">Contacto direto</h2>
            <ul className="mt-5 space-y-4">
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-700">Telefone</p>
                  <a href="tel:+351965785395" className="text-sm font-bold text-slate-900 hover:text-cyan-600">
                    +351 965 785 395
                  </a>
                  <p className="text-xs text-slate-400">Pedidos rápidos e marcações</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-700">Email</p>
                  <a href="mailto:geral@clyon.pt" className="text-sm font-bold text-slate-900 hover:text-cyan-600">
                    geral@clyon.pt
                  </a>
                  <p className="text-xs text-slate-400">Pedidos detalhados e dúvidas</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-700">Morada</p>
                  <p className="text-sm text-slate-700">Belverde, Amora · 2845-513</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Clock3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-700">Horário</p>
                  <p className="text-sm text-slate-700">Seg–Sáb 08:00–20:00</p>
                  <p className="text-xs text-slate-400">Domingo: por mensagem</p>
                </div>
              </li>
            </ul>

            <div className="mt-6 flex gap-3">
              <a
                href="tel:+351965785395"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400"
              >
                <Phone className="h-4 w-4" />
                Ligar
              </a>
              <a
                href="https://wa.me/351965785395?text=Ol%C3%A1!%20Gostava%20de%20pedir%20um%20or%C3%A7amento%20%C3%A0%20CLYON."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </div>

          {/* Formulário */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            {status === "success" ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-cyan-500" />
                <h2 className="text-lg font-bold text-[#0B1929]">Pedido recebido!</h2>
                <p className="text-sm text-slate-500">
                  A nossa equipa entra em contacto em breve. Obrigado!
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400"
                >
                  Novo pedido
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-[#0B1929]">Enviar pedido</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Preencha os dados — a nossa equipa responde em até 24h.
                </p>
                <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                  {field("nome", "Nome completo", "text", "Ana Silva")}
                  {field("telemovel", "Telemóvel", "tel", "+351 9xx xxx xxx")}
                  {field("email", "Email", "email", "ana@exemplo.com")}
                  {field("morada", "Morada do serviço", "text", "Rua ..., Lisboa")}

                  {status === "error" && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-xl bg-cyan-500 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {status === "loading" ? "A enviar…" : "Enviar pedido"}
                  </button>
                </form>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
