import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Sparkles,
  Truck,
  UserCheck,
} from "lucide-react";

import { BUSINESS_PHONE, SITE_URL } from "@/lib/seo-data";

export const metadata: Metadata = {
  title: "Como Funciona — Preço Fixo por IA, Validado por um Assistente",
  description:
    "Descreva o serviço, receba um preço fixo calculado por IA em segundos e um assistente humano confirma tudo consigo antes de avançar. Sem negociação, sem surpresas.",
  alternates: {
    canonical: `${SITE_URL}/como-funciona`,
  },
  openGraph: {
    title: "Como Funciona — Preço Fixo por IA, Validado por um Assistente",
    description:
      "O modelo único da CLYON: velocidade da IA, confiança de um assistente humano, execução por um profissional verificado.",
    url: `${SITE_URL}/como-funciona`,
  },
};

const stages = [
  {
    step: "01",
    title: "Captação estruturada",
    icon: ClipboardList,
    accent: "cyan" as const,
    description:
      "No simulador, descreve o serviço que precisa, envia fotos (opcional) e indica a morada e as condições de acesso — andar, elevador, estacionamento.",
  },
  {
    step: "02",
    title: "Orçamento instantâneo por IA",
    icon: Sparkles,
    accent: "premium" as const,
    description:
      "A IA analisa a descrição e as fotos, e calcula um preço fixo em segundos com base no preçário oficial — distância, volume, acessos e urgência. Vê o preço final, com e sem IVA, sem fórmulas nem margens expostas.",
  },
  {
    step: "03",
    title: "Revisão humana",
    icon: UserCheck,
    accent: "cyan" as const,
    description:
      "Um assistente revê o pedido: confirma se a descrição é coerente com o preço calculado, ajusta se necessário e contacta-o para validar morada exata, data, hora e orçamento final. Normalmente em menos de 2 horas.",
  },
  {
    step: "04",
    title: "Execução verificada",
    icon: Truck,
    accent: "cyan" as const,
    description:
      "Depois de aprovado, o pedido é atribuído a um profissional verificado. Recebe uma notificação com os detalhes e acompanha o serviço até à conclusão.",
  },
];

const assistantRules = [
  "Verifica se a descrição e as fotos são coerentes com o preço calculado pela IA.",
  "Ajusta o preço final se a IA subestimou o volume ou a dificuldade de acesso.",
  "Confirma consigo os 5 dados essenciais: nome, morada exata, data/hora, descrição e orçamento.",
  "Só depois de aprovar é que o pedido fica visível para os profissionais da zona.",
];

export const revalidate = 86400;

export default function ComoFuncionaPage() {
  const whatsappNumber = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Olá! Tenho uma dúvida sobre como funciona a CLYON.",
  )}`;

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(90deg,rgba(236,254,255,0.95)_0%,rgba(255,255,255,1)_52%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-22 sm:px-6 lg:px-8 lg:pb-16">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700 shadow-sm">
            Como funciona
          </div>
          <h1 className="mt-5 max-w-[18ch] text-[2.4rem] font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-[3.4rem]">
            Preço fixo por IA. Confirmado por uma pessoa.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            A CLYON combina a velocidade de um motor de preços com IA com o
            controlo de qualidade de um assistente humano. O preço nunca sobe
            depois de confirmado, e nenhum pedido chega a um profissional sem
            ser validado primeiro.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/simulador" className="site-btn-primary px-6">
              Simular orçamento grátis
            </Link>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="site-btn-secondary px-6">
              <MessageCircle className="mr-2 h-4 w-4" />
              Tirar dúvidas por WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {stages.map((stage, index) => (
              <div key={stage.step} className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="absolute -top-4 left-8 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">
                  {index + 1}
                </div>
                <div
                  className={`mt-4 flex h-14 w-14 items-center justify-center rounded-xl ${
                    stage.accent === "premium" ? "bg-violet-50" : "bg-cyan-50"
                  }`}
                >
                  <stage.icon className={`h-7 w-7 ${stage.accent === "premium" ? "text-violet-600" : "text-cyan-600"}`} />
                </div>
                <h2 className="mt-5 text-xl font-bold text-slate-900">{stage.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600">{stage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-600">
              O papel do assistente
            </div>
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              Nenhum pedido avança sem revisão humana
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
              O assistente não recalcula o preço do zero — a sua função é garantir que o que a IA propôs faz sentido.
            </p>
          </div>

          <div className="space-y-4">
            {assistantRules.map((rule) => (
              <div key={rule} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-600" />
                <span className="text-sm font-medium text-slate-700">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-center sm:p-12 lg:p-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Pronto para experimentar?</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
              Descreva o serviço no simulador e receba um preço fixo em segundos.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/simulador" className="site-btn-primary px-8">
                Simular orçamento grátis
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
